import { Status } from './types';

/**
 * Colour and type, tuned for the eyes this app is actually for.
 *
 * Four things change with age and all of them are load-bearing here:
 *
 * 1. The lens yellows, absorbing blue. Pure blues dim and blue/green pairs
 *    converge, so status colours never rely on hue alone — each also differs
 *    in lightness, and every card carries a word label as well as a colour.
 * 2. Glare sensitivity rises. A pure #FFFFFF field is uncomfortably bright
 *    under fluorescent light, which is exactly where a senior reads their
 *    mail. The background is a warm off-white instead.
 * 3. Contrast sensitivity falls. Body text sits at 7:1 or better against its
 *    background rather than the 4.5:1 that would merely pass AA.
 * 4. Pupils shrink, so less light reaches the retina. Warm tones read as
 *    calmer and less clinical than cool greys at the same lightness.
 *
 * Blue for CONDITIONAL is still load-bearing: in v1 it fell through to green,
 * which is wrong, because conditional means *read this*, not *ignore this*.
 */
export interface StatusStyle {
  bg: string;
  border: string;
  text: string;
  /** Shown large at the top of the card, in the reader's own language. */
  label: Record<'nan' | 'en' | 'ms' | 'cmn' | 'ta', string>;
}

export const STATUS_STYLE: Record<Status, StatusStyle> = {
  SCAM_ALERT: {
    bg: '#FBEAE7',
    border: '#A8291C',
    text: '#6B1810',
    label: {
      nan: '這是騙人的',
      en: 'This is a scam',
      ms: 'Ini penipuan',
      cmn: '这是骗局',
      ta: 'இது மோசடி',
    },
  },
  ACTION_REQUIRED: {
    bg: '#FBF0DC',
    border: '#8A5A00',
    text: '#5C3B00',
    label: {
      nan: '你愛做代誌',
      en: 'You need to do something',
      ms: 'Anda perlu bertindak',
      cmn: '你要办一件事',
      ta: 'நீங்கள் ஒன்று செய்ய வேண்டும்',
    },
  },
  CONDITIONAL: {
    bg: '#E6EEF6',
    border: '#17527D',
    text: '#0E3B5C',
    label: {
      nan: '看有合你無',
      en: 'Only if this applies to you',
      ms: 'Hanya jika berkenaan anda',
      cmn: '看情况是否跟你有关',
      ta: 'உங்களுக்குப் பொருந்தினால் மட்டும்',
    },
  },
  INFO_ONLY: {
    bg: '#E8F1E6',
    border: '#2E6B34',
    text: '#1C4520',
    label: {
      nan: '無代誌',
      en: 'Nothing to do',
      ms: 'Tiada tindakan perlu',
      cmn: '没有事情要办',
      ta: 'எதுவும் செய்யத் தேவையில்லை',
    },
  },
};

export const COLORS = {
  /** Warm paper, not pure white — see note 2 above. */
  bg: '#FAF6F0',
  /** Cards and inputs lift slightly off the background. */
  surface: '#FFFDFA',
  /** Warm near-black. 14.8:1 on bg. */
  ink: '#1F1A16',
  /** Secondary text. 7.4:1 on bg — still comfortably readable, not decorative. */
  muted: '#57504A',
  hairline: '#DCD3C7',
  /** Deep blue that survives a yellowing lens. 7.1:1 on bg. */
  primary: '#14547F',
  /** Pressed state for primary surfaces. */
  primaryPressed: '#0E3D5C',
};

/** Seniors, not podcasts. Everything is a step up from platform defaults. */
export const TYPE = {
  huge: 34,
  title: 26,
  body: 21,
  small: 16,
};

/**
 * Press feedback, applied to every tappable thing.
 *
 * Opacity alone is a weak signal for someone with reduced contrast
 * sensitivity, and a senior unsure whether a tap registered will tap again —
 * which on the shutter means a second scan. So a press also shrinks the
 * control slightly: motion is picked up by peripheral vision, which degrades
 * far less with age than fine contrast discrimination does.
 */
export function pressed(isPressed: boolean) {
  return {
    opacity: isPressed ? 0.9 : 1,
    transform: [{ scale: isPressed ? 0.97 : 1 }],
  };
}
