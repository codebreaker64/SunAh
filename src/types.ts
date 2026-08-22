/** Classification returned by Gemma. See blueprint section 5. */
export type Status =
  | 'INFO_ONLY'
  | 'ACTION_REQUIRED'
  | 'CONDITIONAL'
  | 'SCAM_ALERT';

/** BCP-47-ish codes. `nan` is Hokkien (Min Nan) and is the only one that
 *  needs the laptop; everything else has an offline voice on the Pixel. */
export type Lang = 'nan' | 'en' | 'ms' | 'cmn' | 'ta';

export const LANGS: Lang[] = ['nan', 'en', 'ms', 'cmn', 'ta'];

/** Labels are in the reader's own script, never in English. */
export const LANG_LABELS: Record<Lang, string> = {
  nan: '福建话',
  en: 'English',
  ms: 'Bahasa Melayu',
  cmn: '华语',
  ta: 'தமிழ்',
};

/** What `expo-speech` wants. Hokkien has no platform voice, hence null. */
export const PLATFORM_VOICE: Record<Lang, string | null> = {
  nan: null,
  en: 'en-SG',
  ms: 'ms-MY',
  cmn: 'zh-CN',
  ta: 'ta-IN',
};

/** The exact shape section 5 asks Gemma for. Every field is suspect until
 *  validated — a small model will happily return prose here. */
export interface LetterResult {
  status: Status;
  sender: string;
  summary_english: string;
  action_items: string[];
  /** "S$132.00" | "NIL" | "FREE" */
  amount_due: string;
  /** "YYYY-MM-DD" or null when unclear. Never guessed. */
  deadline: string | null;
  /** The line the conclusion rests on. This is the mechanism by which a
   *  family member can catch a wrong answer, so it is not optional. */
  source_quote: string;
}

/** Where a played clip came from, for the cloud glyph in section 3.
 *  'device-fallback' means we spoke a DIFFERENT language than the one chosen,
 *  because the chosen one had no available voice. The card must say so. */
export type AudioSource =
  | 'device'
  | 'device-fallback'
  | 'cache'
  | 'local-gpu'
  | 'cloud'
  | 'none';
