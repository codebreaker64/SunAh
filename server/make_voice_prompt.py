"""
Build the voice clone prompt once — blueprint section 6, "Prerequisite".

    python make_voice_prompt.py ah_ma_5s.wav "<transcript in hanzi>"

Two things matter and both are easy to get wrong:

1. The reference clip must ACTUALLY BE HOKKIEN. A Mandarin or English clip
   carries its own accent into every generated line, and you will not notice
   until you are standing in front of a judge.

2. Pass `ref_text` explicitly. If you omit it, OmniVoice auto-transcribes with
   Whisper, which downloads ~1.5 GB you budgeted zero for (section 1) and is
   slower besides.

3-10 seconds of clean speech is enough. Record on the phone, not the laptop
mic, and keep it quiet in the background.
"""

from __future__ import annotations

import os
import sys

import torch
from omnivoice import OmniVoice


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2

    ref_audio, ref_text = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else "ah_ma_voice.pt"

    if not os.path.exists(ref_audio):
        print(f"reference clip not found: {ref_audio}")
        return 1

    print(f"loading model (fp16)...")
    model = OmniVoice.from_pretrained(
        "MERaLiON/MERaLiON-OmniVoice-Hokkien-TTS",
        device_map="cuda:0",
        dtype=torch.float16,
    )

    print(f"building voice prompt from {ref_audio}")
    prompt = model.create_voice_clone_prompt(ref_audio=ref_audio, ref_text=ref_text)
    prompt.save(out)
    print(f"saved {out}")
    print("The server loads this at startup. Do not regenerate it mid-demo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
