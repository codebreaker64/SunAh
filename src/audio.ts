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

/** A wrong or absent laptop IP is the common case, not the rare one — the
 *  default is a guess and hotspots reassign addresses. Waiting the full
 *  timeout on every single utterance makes the app feel broken, so once we
 *  know the laptop is down we stop asking for a while. */
const LAPTOP_DOWN_MS = 60000;
let laptopDownUntil = 0;

function markLaptopDown() {
  laptopDownUntil = Date.now() + LAPTOP_DOWN_MS;
}

/** Called when the user edits the IP, so a fix takes effect immediately. */
export function resetLaptopState(): void {
  laptopDownUntil = 0;
}

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

/**
 * Offline voice identifiers, resolved once at startup.
 *
 * This is load-bearing for the privacy claim in section 3. Google TTS ships
 * both on-device and server-side voices, and when you pass only a `language`
 * it picks its own default — which on this Pixel is `cmn-cn-x-ssa-server`,
 * i.e. the audio is synthesised by Google's servers. Seven offline zh voices
 * were installed and sitting unused.
 *
 * So we name the voice explicitly, preferring one whose identifier says local.
 * If none exists we still speak, but `offlineVoices` records the miss so the
 * diagnostics screen can warn rather than let the claim quietly become false.
 */
const offlineVoices = new Map<Lang, string | null>();

export async function resolveOfflineVoices(): Promise<void> {
  let voices: Speech.Voice[] = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch {
    return;
  }
  for (const lang of Object.keys(PLATFORM_VOICE) as Lang[]) {
    const tag = PLATFORM_VOICE[lang];
    if (!tag) continue;
    const prefix = tag.split('-')[0].toLowerCase();
    const candidates = voices.filter((v) =>
      v.language?.toLowerCase().startsWith(prefix)
    );
    // Engines label on-device voices differently: Google uses -local on the
    // identifier and reports -embedded when dispatching. Match both.
    const local = candidates.find((v) =>
      /local|embedded|offline/i.test(v.identifier ?? '')
    );
    offlineVoices.set(lang, local?.identifier ?? null);
    voiceReports.set(lang, {
      total: candidates.length,
      offline: candidates.filter((v) =>
        /local|embedded|offline/i.test(v.identifier ?? '')
      ).length,
      chosen: local?.identifier ?? null,
    });
  }
}

/**
 * What the diagnostics screen shows. `chosen` is null when the language has no
 * on-device voice at all, which means speaking it goes over the network and
 * the section 3 claim does not hold for it.
 */
export interface VoiceReport {
  total: number;
  offline: number;
  chosen: string | null;
}

export function voiceReport(lang: Lang): VoiceReport {
  return (
    voiceReports.get(lang) ?? { total: 0, offline: 0, chosen: null }
  );
}

const voiceReports = new Map<Lang, VoiceReport>();

function deviceSpeak(text: string, lang: Lang): AudioSource {
  const tag = PLATFORM_VOICE[lang];
  if (!tag) return 'none';
  const voice = offlineVoices.get(lang);
  Speech.speak(text, {
    language: tag,
    rate: RATE,
    // Naming the voice is what keeps this offline; without it the engine
    // reaches for its server voice.
    ...(voice ? { voice } : {}),
  });
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
  settings: Settings,
  /**
   * What to say when the primary voice is unavailable. Section 7d: "For
   * Hokkien a 404 means there is no fallback: show the text large on screen
   * and offer the English voice instead."
   *
   * We pass Mandarin rather than English. A Singaporean who chose Hokkien is
   * far more likely to follow 华语 than English — and critically this must be
   * the Mandarin *template*, not the Hokkien string read by a zh voice, which
   * would pronounce 毋通 as "wu tong" and mean nothing.
   */
  fallback?: { text: string; lang: Lang }
): Promise<AudioSource> {
  stopAudio();
  if (!text.trim()) return 'none';

  const needsLaptop = lang === 'nan' || settings.allowCloud;
  if (!needsLaptop) return deviceSpeak(text, lang);

  const giveUp = (): AudioSource => {
    const own = deviceSpeak(text, lang);
    if (own !== 'none') return own;
    // No platform voice for this language (Hokkien). Say it in the fallback
    // language rather than leaving the senior in silence.
    if (!fallback) return 'none';
    return deviceSpeak(fallback.text, fallback.lang) === 'none'
      ? 'none'
      : 'device-fallback';
  };

  if (Date.now() < laptopDownUntil) return giveUp();

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
    if (res.status === 404) return giveUp();

    // 503 is model busy or OOM. One retry, then fall back (section 7d).
    if (res.status === 503) {
      const retry = await fetch(`${settings.laptopBaseUrl}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang, allow_cloud: settings.allowCloud }),
        signal: controller.signal,
      });
      if (!retry.ok) { markLaptopDown(); return giveUp(); }
      return finish(retry, text, lang, giveUp);
    }

    if (!res.ok) { markLaptopDown(); return giveUp(); }
    return await finish(res, text, lang, giveUp);
  } catch {
    // Timeout, no route, hotspot dropped. Fall back silently — the card is
    // already on screen.
    markLaptopDown();
    return giveUp();
  } finally {
    clearTimeout(timer);
  }
}

async function finish(
  res: Response,
  text: string,
  lang: Lang,
  giveUp: () => AudioSource
): Promise<AudioSource> {
  const buf = await res.arrayBuffer();
  // A 200 with no body is a server bug, not a "use device voice" signal, but
  // the senior still deserves audio — so treat it like any other miss.
  if (buf.byteLength === 0) return giveUp();
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
