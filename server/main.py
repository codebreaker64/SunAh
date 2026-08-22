"""
Sun Ah TTS server — blueprint section 6.

The GPU is fully committed to speech. Model and voice prompt load once at
startup, never per request.

Run it:
    uvicorn main:app --host 0.0.0.0 --port 8000

Bind to 0.0.0.0, not 127.0.0.1 — the phone is a different machine on your
hotspot and localhost resolves to the phone (section 7e).
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import socket
import threading
import wave
from contextlib import asynccontextmanager
from typing import Optional

import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger("sunah")

app = FastAPI(title="Sun Ah TTS")

# sha1(text + lang) -> wav bytes. Rehearsing warms this; do NOT restart the
# server after rehearsal or every line goes back to 4-6 seconds live (7f).
CACHE: dict[str, bytes] = {}
CACHE_MAX = 256

# 4 GB card: one generation at a time. Two concurrent requests will OOM.
GPU_LOCK = threading.Lock()

MODEL = None
VOICE = None
LOAD_ERROR: Optional[str] = None

# How we are producing the voice, reported by /health so you know what the
# demo will actually sound like before you stand up.
#   "clone"  — cloned from a real Hokkien speaker (ah_ma_voice.pt). Best.
#   "design" — described in words, no recording needed. Good enough to demo.
VOICE_MODE = "none"

# Used when there is no reference recording. Section 6 wants a real Hokkien
# speaker and that is still the right answer — but refusing to start without
# one means no Hokkien at all, which is worse than a designed voice.
VOICE_INSTRUCT = (
    "An elderly Singaporean woman in her seventies speaking Hokkien, warm, "
    "unhurried and clear, as if explaining a letter to her grandchild."
)


def _load_model() -> None:
    """Load once at import. A failure here is recorded, not raised — /health
    must still answer so the phone can tell 'server down' from 'model down'."""
    global MODEL, VOICE, LOAD_ERROR, VOICE_MODE
    try:
        from omnivoice import OmniVoice, VoiceClonePrompt

        log.info("loading MERaLiON Hokkien TTS (fp16)...")
        MODEL = OmniVoice.from_pretrained(
            "MERaLiON/MERaLiON-OmniVoice-Hokkien-TTS",
            device_map="cuda:0",
            dtype=torch.float16,  # fp32 will not fit in 4 GB
        )

        voice_path = os.getenv("SUNAH_VOICE", "ah_ma_voice.pt")
        if os.path.exists(voice_path):
            VOICE = VoiceClonePrompt.load(voice_path)  # skips Whisper at runtime
            VOICE_MODE = "clone"
            log.info("voice cloned from %s", voice_path)
        else:
            VOICE_MODE = "design"
            log.warning(
                "%s not found — falling back to a DESIGNED voice. This works, "
                "but record 3-10s of a real Hokkien speaker and run "
                "make_voice_prompt.py for the voice you actually want. The "
                "reference clip must be Hokkien: a Mandarin or English clip "
                "carries its own accent into every line.",
                voice_path,
            )

        try:  # optional, ~2.4x at batch 1 on Ampere
            from omnivoice.models.omnivoice_flashinfer import apply_flashinfer

            apply_flashinfer(MODEL, enable_cuda_graph=True)
            log.info("flashinfer enabled")
        except Exception as e:  # noqa: BLE001
            log.warning("flashinfer unavailable, running baseline: %s", e)

        log.info(
            "ready. vram allocated: %.2f GB",
            torch.cuda.memory_allocated() / 1e9,
        )
    except Exception as e:  # noqa: BLE001
        LOAD_ERROR = f"{type(e).__name__}: {e}"
        log.error("model load failed: %s", LOAD_ERROR)


_load_model()


class SpeakRequest(BaseModel):
    text: str
    lang: str = "nan"
    allow_cloud: bool = False


def _cache_put(key: str, data: bytes) -> None:
    if len(CACHE) >= CACHE_MAX:
        CACHE.pop(next(iter(CACHE)))
    CACHE[key] = data


def _wav_response(data: bytes, source: str) -> Response:
    return Response(
        data,
        media_type="audio/wav",
        headers={"X-Sun-Ah-Source": source},
    )


@app.post("/api/speak")
def speak(req: SpeakRequest) -> Response:
    key = hashlib.sha1(f"{req.text}|{req.lang}".encode()).hexdigest()

    if key in CACHE:
        return _wav_response(CACHE[key], "cache")

    if req.lang == "nan":
        if MODEL is None:
            # 503, not 500: the phone retries once then falls back (7d). For
            # Hokkien there is no fallback, so the card shows the text large.
            raise HTTPException(503, f"Hokkien model unavailable: {LOAD_ERROR}")

        if not GPU_LOCK.acquire(timeout=30):
            raise HTTPException(503, "busy")
        try:
            # Clone when we have a reference, describe the voice when we
            # don't. Both produce Hokkien; only the timbre differs.
            kwargs = (
                {"voice_clone_prompt": VOICE}
                if VOICE is not None
                else {"instruct": VOICE_INSTRUCT}
            )
            audio = MODEL.generate(
                text=req.text,
                language="nan",
                num_step=16,
                **kwargs,
            )
            buf = io.BytesIO()
            sf.write(buf, audio[0], MODEL.sampling_rate, format="WAV")
            data = buf.getvalue()
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            log.error("CUDA OOM — close Chrome and anything else on the GPU")
            raise HTTPException(503, "out of memory")
        except Exception as e:  # noqa: BLE001
            log.exception("generation failed")
            raise HTTPException(503, str(e))
        finally:
            GPU_LOCK.release()

        _cache_put(key, data)
        return _wav_response(data, "local-gpu")

    if not req.allow_cloud:
        # A 404 is NORMAL, not an error — it means "use the device voice".
        raise HTTPException(404, "use device voice")

    data = gemini_tts(req.text, req.lang)
    _cache_put(key, data)
    return _wav_response(data, "cloud")


@app.get("/health")
def health() -> dict:
    """Hit this from the phone's browser before pitching. No answer means the
    network is the problem, not the code."""
    return {
        "ok": MODEL is not None,
        "model_loaded": MODEL is not None,
        "voice_mode": VOICE_MODE,
        "load_error": LOAD_ERROR,
        "vram_gb": round(torch.cuda.memory_allocated() / 1e9, 2)
        if torch.cuda.is_available()
        else None,
        "cached_lines": len(CACHE),
    }


# ── cloud path ────────────────────────────────────────────────────────────
# Opt-in only, proxied so the key never reaches the phone (section 7b).

_GEMINI_VOICE = {
    "en": "Kore",
    "ms": "Kore",
    "cmn": "Kore",
    "ta": "Kore",
}


def _pcm_to_wav(pcm: bytes, rate: int = 24000, channels: int = 1, width: int = 2) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def gemini_tts(text: str, lang: str) -> bytes:
    """Proxy to Gemini TTS. Key lives in the server's .env and never in the
    app bundle. Only reached when the user has switched the toggle on."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(503, "GEMINI_API_KEY not set on the server")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(503, "google-genai not installed")

    client = genai.Client(api_key=api_key)
    try:
        resp = client.models.generate_content(
            model="gemini-3.1-flash-tts-preview",
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=_GEMINI_VOICE.get(lang, "Kore")
                        )
                    )
                ),
            ),
        )
        pcm = resp.candidates[0].content.parts[0].inline_data.data
    except Exception as e:  # noqa: BLE001
        log.exception("gemini tts failed")
        raise HTTPException(503, f"cloud tts failed: {e}")

    return _pcm_to_wav(pcm)


def _lan_ip() -> str:
    """Best-effort LAN address, printed at startup so you can type it into the
    phone's settings without hunting through ipconfig."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packet is sent; this just picks a route
        return s.getsockname()[0]
    except Exception:  # noqa: BLE001
        return "127.0.0.1"
    finally:
        s.close()


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    log.info("=" * 58)
    log.info("  Put this in the phone's settings:")
    log.info("     http://%s:8000", _lan_ip())
    log.info("  Check from the phone's browser: /health")
    log.info("=" * 58)
    yield


app.router.lifespan_context = _lifespan
