import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { AudioSource, Lang, PLATFORM_VOICE } from './types';
import { Settings } from './config';

/**
 * The audio fallback chain, blueprint section 9.
 *
 *   1. Hokkien            -> POST to laptop; cache hit instant, else 4-6 s
 *   2. other language     -> Speech.speak(text, { language, rate: 0.85 })
 *   3. better-voice on    -> laptop proxies Gemini TTS, show cloud icon
 *   4. laptop unreachable -> caller shows speech_text large, no audio
 *
 * Every branch returns an AudioSource so the card can decide whether to show
 * the cloud glyph. Audio is an enhancement and never a gate — the card has
 * already painted before any of this runs (section 7c).
 */

/** Platform defaults are tuned for podcasts, not seniors (section 9). */
const RATE = 0.85;

/** Long enough for a 4-6 s cold generation plus slack; short enough that a
 *  dead hotspot doesn't leave the senior staring at a silent screen. */
const TIMEOUT_MS = 12000;

let current: { remove: () => void } | null = null;
let lastClip: File | null = null;
let clipCounter = 0;

/** Stop whatever is playing. Called before every new utterance. */
export function stopAudio(): void {
  Speech.stop();
  if (current) {
    try {
      current.remove();
    } catch {
      /* already gone */
    }
    current = null;
  }
}

function deviceSpeak(text: string, lang: Lang): AudioSource {
  const voice = PLATFORM_VOICE[lang];
  if (!voice) return 'none';
  Speech.speak(text, { language: voice, rate: RATE });
  return 'device';
}

async function playWav(bytes: Uint8Array): Promise<void> {
  // expo-audio wants a URI, so the response goes to a cache file first.
  // A fresh filename each time rather than one reused path: the player may
  // hold a decoded asset for a URI it has already seen, and reusing the path
  // risks the senior hearing the previous letter's audio for this one. A
  // query string would cache-bust on http but breaks file:// resolution.
  const previous = lastClip;
  const file = new File(Paths.cache, `sunah-speech-${clipCounter++}.wav`);
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
  lastClip = file;

  if (previous) {
    try {
      previous.delete();
    } catch {
      /* the system may already have reclaimed the cache */
    }
  }

  const player = createAudioPlayer(file.uri);
  current = player;
  player.play();
}

/**
 * Speak `text`. Returns where the audio came from, or 'none' if nothing could
 * be played and the caller should show the text large on screen instead.
 */
export async function speak(
  text: string,
  lang: Lang,
  settings: Settings
): Promise<AudioSource> {
  stopAudio();
  if (!text.trim()) return 'none';

  const needsLaptop = lang === 'nan' || settings.allowCloud;
  if (!needsLaptop) return deviceSpeak(text, lang);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${settings.laptopBaseUrl}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, allow_cloud: settings.allowCloud }),
      signal: controller.signal,
    });

    // 404 is normal, not an error: it means "use the device voice".
    if (res.status === 404) return deviceSpeak(text, lang);

    // 503 is model busy or OOM. One retry, then fall back (section 7d).
    if (res.status === 503) {
      const retry = await fetch(`${settings.laptopBaseUrl}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang, allow_cloud: settings.allowCloud }),
        signal: controller.signal,
      });
      if (!retry.ok) return deviceSpeak(text, lang);
      return finish(retry, text, lang);
    }

    if (!res.ok) return deviceSpeak(text, lang);
    return await finish(res, text, lang);
  } catch {
    // Timeout, no route, hotspot dropped. Fall back silently — the card is
    // already on screen.
    return deviceSpeak(text, lang);
  } finally {
    clearTimeout(timer);
  }
}

async function finish(res: Response, text: string, lang: Lang): Promise<AudioSource> {
  const buf = await res.arrayBuffer();
  // A 200 with no body is a server bug, not a "use device voice" signal, but
  // the senior still deserves audio — so treat it like any other miss.
  if (buf.byteLength === 0) return deviceSpeak(text, lang);
  await playWav(new Uint8Array(buf));
  const header = res.headers.get('X-Sun-Ah-Source');
  if (header === 'cache' || header === 'local-gpu' || header === 'cloud') {
    return header;
  }
  return 'local-gpu';
}

/**
 * Is the laptop there? Section 6: hit this from the phone before pitching.
 * No answer means the network is the problem, not the code.
 */
export async function checkHealth(
  baseUrl: string
): Promise<{ ok: boolean; vramGb?: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const json = await res.json();
    return { ok: !!json.ok, vramGb: json.vram_gb };
  } catch {
    return { ok: false };
  }
}
