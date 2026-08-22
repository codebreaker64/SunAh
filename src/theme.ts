import { Status } from './types';

/**
 * Card semantics, blueprint section 9.
 *
 * Blue for CONDITIONAL is load-bearing: in v1 it fell through to green, which
 * is wrong, because conditional means *read this*, not *ignore this*.
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
    bg: '#FDE8E8',
    border: '#C62828',
    text: '#7F1414',
    label: {
      nan: '這是騙人的',
      en: 'This is a scam',
      ms: 'Ini penipuan',
      cmn: '这是骗局',
      ta: 'இது மோசடி',
    },
  },
  ACTION_REQUIRED: {
    bg: '#FFF4E0',
    border: '#E08600',
    text: '#7A4A00',
    label: {
      nan: '你愛做代誌',
      en: 'You need to do something',
      ms: 'Anda perlu bertindak',
      cmn: '你要办一件事',
      ta: 'நீங்கள் ஒன்று செய்ய வேண்டும்',
    },
  },
  CONDITIONAL: {
    bg: '#E7F0FB',
    border: '#1565C0',
    text: '#0B3C73',
    label: {
      nan: '看有合你無',
      en: 'Only if this applies to you',
      ms: 'Hanya jika berkenaan anda',
      cmn: '看情况是否跟你有关',
      ta: 'உங்களுக்குப் பொருந்தினால் மட்டும்',
    },
  },
  INFO_ONLY: {
    bg: '#E8F5E9',
    border: '#2E7D32',
    text: '#14401A',
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
  bg: '#FFFFFF',
  ink: '#141414',
  muted: '#5A5A5A',
  hairline: '#D8D8D8',
  primary: '#0B5FA5',
};

/** Seniors, not podcasts. Everything is a step up from platform defaults. */
export const TYPE = {
  huge: 34,
  title: 26,
  body: 21,
  small: 16,
};
