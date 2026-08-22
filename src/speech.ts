import { Lang, LetterResult, Status } from './types';

/**
 * Speech-text assembly — blueprint section 4, mitigation 5.
 *
 * The model returns structured fields only. The spoken sentence is built here,
 * in JS, from templates keyed on `status`. That is deliberate: it guarantees
 * idiomatic Hokkien and removes the failure mode where the model writes
 * Mandarin-style Chinese that the TTS then pronounces as Hokkien-accented
 * Mandarin.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REVIEW REQUIRED BEFORE THE DEMO
 *
 * The Hokkien below is written in hanzi with Tâi-lô romanisation in comments
 * so a native speaker can check it in one pass over this file. It has NOT
 * been reviewed by one. The person who records `ah_ma_voice.pt` is the
 * obvious reviewer — ask them to read each line aloud and correct it here.
 * The Malay and Tamil lines want the same treatment.
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ── numbers ──────────────────────────────────────────────────────────────
 * Hokkien and Mandarin TTS read hanzi far more reliably than digits, and
 * section 13 flags number-heavy content as outside the model's tested range.
 * So we spell numbers out for nan/cmn and leave digits for en/ms/ta, where
 * the platform voices handle them fine.
 */

const HANZI_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 0–9999 to hanzi. Covers every amount and date part we produce. */
export function toHanzi(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 10) return HANZI_DIGITS[n];
  if (n < 20) return n === 10 ? '十' : `十${HANZI_DIGITS[n % 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${HANZI_DIGITS[tens]}十${ones ? HANZI_DIGITS[ones] : ''}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    if (rest === 0) return `${HANZI_DIGITS[hundreds]}百`;
    // 102 -> 一百零二, 132 -> 一百三十二
    if (rest < 10) return `${HANZI_DIGITS[hundreds]}百零${HANZI_DIGITS[rest]}`;
    return `${HANZI_DIGITS[hundreds]}百${toHanzi(rest)}`;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (rest === 0) return `${HANZI_DIGITS[thousands]}千`;
  if (rest < 100) return `${HANZI_DIGITS[thousands]}千零${toHanzi(rest)}`;
  return `${HANZI_DIGITS[thousands]}千${toHanzi(rest)}`;
}

/** "S$132.00" | "NIL" | "FREE" -> dollars and cents, or null if not money. */
export function parseAmount(
  amount: string | null | undefined
): { dollars: number; cents: number } | null {
  if (!amount) return null;
  const cleaned = amount.replace(/[,\s]/g, '');
  const m = cleaned.match(/(\d+)(?:\.(\d{1,2}))?/);
  if (!m || /^(NIL|FREE|NONE|N\/A)$/i.test(cleaned)) return null;
  const dollars = parseInt(m[1], 10);
  const cents = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  if (!Number.isFinite(dollars)) return null;
  return { dollars, cents };
}

function speakAmount(amount: string, lang: Lang): string | null {
  const parsed = parseAmount(amount);
  if (!parsed) return null;
  const { dollars, cents } = parsed;
  switch (lang) {
    case 'nan': {
      // 箍 (khoo) is the everyday Hokkien word for a dollar; 角 (kak) for 10c.
      const d = `${toHanzi(dollars)}箍`;
      return cents ? `${d}${toHanzi(Math.round(cents / 10))}角` : d;
    }
    case 'cmn': {
      const d = `${toHanzi(dollars)}块`;
      return cents ? `${d}${toHanzi(Math.round(cents / 10))}毛` : d;
    }
    case 'en':
      return cents ? `${dollars} dollars ${cents} cents` : `${dollars} dollars`;
    case 'ms':
      return cents ? `${dollars} dolar ${cents} sen` : `${dollars} dolar`;
    case 'ta':
      return cents ? `${dollars} டாலர் ${cents} சதம்` : `${dollars} டாலர்`;
  }
}

/* ── dates ─────────────────────────────────────────────────────────────── */

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_MS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];
const MONTHS_TA = [
  'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
  'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்',
];

/** "2026-08-27" -> spoken date, or null if the model gave us nothing usable. */
function speakDate(deadline: string | null, lang: Lang): string | null {
  if (!deadline) return null;
  const m = deadline.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  switch (lang) {
    case 'nan':
      return `${toHanzi(month)}月${toHanzi(day)}號`;
    case 'cmn':
      return `${toHanzi(month)}月${toHanzi(day)}号`;
    case 'en':
      return `${day} ${MONTHS_EN[month - 1]}`;
    case 'ms':
      return `${day} ${MONTHS_MS[month - 1]}`;
    case 'ta':
      return `${MONTHS_TA[month - 1]} ${day}`;
  }
}

/* ── sender names ──────────────────────────────────────────────────────────
 * A Hokkien TTS asked to read "Ang Mo Kio Polyclinic" mid-sentence will do
 * something bad with it — section 13 flags acronym-heavy content as outside
 * the model's tested range. So for nan and cmn we map the senders we know to
 * hanzi, and when we don't recognise one we drop the clause entirely rather
 * than hand English to a dialect voice.
 *
 * This is the "Singapore lexicon injected in-context" from section 12, just
 * applied on our side of the model instead of inside it.
 */
const SENDER_HANZI: [RegExp, string][] = [
  [/central provident fund|\bCPF\b/i, '公積金局'],
  [/polyclinic/i, '政府診所'],
  [/town council/i, '市鎮理事會'],
  [/\bCHAS\b|community health assist/i, '社保援助計劃'],
  [/ministry of health|\bMOH\b/i, '衛生部'],
  [/housing.*development board|\bHDB\b/i, '建屋局'],
  [/inland revenue|\bIRAS\b/i, '稅務局'],
  [/\bSingPost\b|singapore post/i, '新加坡郵政'],
  [/hospital/i, '醫院'],
  [/clinic/i, '診所'],
];

/** Simplified forms for Mandarin, where the same lookup applies. */
const SENDER_SIMPLIFIED: Record<string, string> = {
  公積金局: '公积金局',
  政府診所: '政府诊所',
  市鎮理事會: '市镇理事会',
  社保援助計劃: '社保援助计划',
  衛生部: '卫生部',
  建屋局: '建屋局',
  稅務局: '税务局',
  新加坡郵政: '新加坡邮政',
  醫院: '医院',
  診所: '诊所',
};

/**
 * Returns a speakable sender, or null when the clause should be dropped.
 * English-script senders pass through unchanged for en/ms/ta.
 */
function localiseSender(sender: string, lang: Lang): string | null {
  const s = (sender || '').trim();
  if (!s) return null;
  if (lang !== 'nan' && lang !== 'cmn') return s;

  // Already in Chinese script — the model or the letter gave us usable text.
  if (/[一-鿿]/.test(s)) return s;

  for (const [pattern, hanzi] of SENDER_HANZI) {
    if (pattern.test(s)) {
      return lang === 'cmn' ? SENDER_SIMPLIFIED[hanzi] ?? hanzi : hanzi;
    }
  }
  // Unknown English sender: say nothing rather than mangle it.
  return null;
}

/* ── templates ─────────────────────────────────────────────────────────── */

/**
 * How the app addresses the reader. Set once on the language screen; there is
 * no neutral Hokkien equivalent, so it is a choice rather than a guess.
 */
export type Address = 'a-kong' | 'a-ma' | 'none';

const ADDRESS: Record<Lang, Record<Address, string>> = {
  nan: { 'a-kong': '阿公，', 'a-ma': '阿嬤，', none: '' },   // A-kong / A-má
  cmn: { 'a-kong': '阿公，', 'a-ma': '阿嬷，', none: '' },
  en: { 'a-kong': '', 'a-ma': '', none: '' },
  ms: { 'a-kong': '', 'a-ma': '', none: '' },
  ta: { 'a-kong': '', 'a-ma': '', none: '' },
};

interface Slots {
  /** Already localised, and already dropped if it wasn't speakable. */
  head: string;
  amount: string | null;
  date: string | null;
}

type Template = (s: Slots) => string;

/** Opening clause. Falls back to a senderless form rather than reading
 *  English aloud in a dialect voice. */
const HEAD: Record<Lang, (sender: string | null) => string> = {
  nan: (s) => (s ? `這張信是${s}寄來的。` : '這張信，'),
  cmn: (s) => (s ? `这封信是${s}寄来的。` : '这封信，'),
  en: (s) => (s ? `This letter is from ${s}. ` : 'This letter. '),
  ms: (s) => (s ? `Surat ini daripada ${s}. ` : 'Surat ini. '),
  ta: (s) => (s ? `இந்தக் கடிதம் ${s} அனுப்பியது. ` : 'இந்தக் கடிதம். '),
};

/**
 * Hokkien (Min Nan), hanzi. Tâi-lô given for the reviewer.
 */
const NAN: Record<Status, Template> = {
  // Bô tāi-tsì, bián tsò siánn-mih, mā bián lap-tsînn.
  INFO_ONLY: ({ head }) => `${head}無代誌，免做啥物，嘛免納錢。`,

  // Lí ài lap {amount}, siōng bān {date}. / {date} lí ài khì.
  ACTION_REQUIRED: ({ head, amount, date }) => {
    if (amount && date) return `${head}你愛納${amount}，上慢${date}。`;
    if (amount) return `${head}你愛納${amount}。`;
    if (date) return `${head}${date}你愛去。免納錢。`;
    return `${head}你愛做一項代誌，請你揣厝內的人鬥看覓。`;
  },

  // Nā-sī ha̍h lí, lí tsiah ài phah tiān-uē; nā bô, tō bián.
  CONDITIONAL: ({ head, date }) => {
    const when = date ? `${date}有代誌。` : '有一項代誌。';
    return `${head}${when}若是合你，你才愛拍電話；若無，就免。`;
  },

  // Sè-jī! Tse sī phiàn-lâng ê. M̄-thang siong-sìn, m̄-thang kià-tsînn hōo lâng,
  // kín khì kā tshù-lāi ê lâng kóng.
  // No head clause: naming the "sender" of a scam letter lends it authority.
  SCAM_ALERT: () =>
    `細膩！這張是騙人的。毋通相信，毋通寄錢予人，緊去共厝內的人講。`,
};

const EN: Record<Status, Template> = {
  INFO_ONLY: ({ head }) =>
    `${head}There is nothing you need to do, and nothing to pay.`,
  ACTION_REQUIRED: ({ head, amount, date }) => {
    if (amount && date) return `${head}You need to pay ${amount} by ${date}.`;
    if (amount) return `${head}You need to pay ${amount}.`;
    if (date) return `${head}You need to go on ${date}. There is nothing to pay.`;
    return `${head}There is something you need to do. Please ask someone at home to help.`;
  },
  CONDITIONAL: ({ head, date }) => {
    const when = date ? `Something happens on ${date}. ` : '';
    return `${head}${when}You only need to do something if it applies to you. If it does not, you can ignore it.`;
  },
  SCAM_ALERT: () =>
    `Careful. This is a scam. Do not believe it, do not send any money, and tell someone at home right now.`,
};

const MS: Record<Status, Template> = {
  INFO_ONLY: ({ head }) =>
    `${head}Tiada apa-apa perlu dibuat, dan tiada bayaran diperlukan.`,
  ACTION_REQUIRED: ({ head, amount, date }) => {
    if (amount && date) return `${head}Anda perlu bayar ${amount} sebelum ${date}.`;
    if (amount) return `${head}Anda perlu bayar ${amount}.`;
    if (date) return `${head}Anda perlu pergi pada ${date}. Tiada bayaran diperlukan.`;
    return `${head}Ada sesuatu yang perlu anda buat. Sila minta bantuan ahli keluarga.`;
  },
  CONDITIONAL: ({ head, date }) => {
    const when = date ? `Ada sesuatu berlaku pada ${date}. ` : '';
    return `${head}${when}Anda hanya perlu bertindak jika keadaan itu berkenaan dengan anda. Jika tidak, abaikan sahaja.`;
  },
  SCAM_ALERT: () =>
    `Hati-hati. Ini penipuan. Jangan percaya, jangan hantar wang, dan beritahu ahli keluarga anda sekarang.`,
};

const CMN: Record<Status, Template> = {
  INFO_ONLY: ({ head }) => `${head}没有事情要做，也不用付钱。`,
  ACTION_REQUIRED: ({ head, amount, date }) => {
    if (amount && date) return `${head}你要付${amount}，最迟${date}。`;
    if (amount) return `${head}你要付${amount}。`;
    if (date) return `${head}${date}你要去。不用付钱。`;
    return `${head}有一件事情要做，请家里人帮你看看。`;
  },
  CONDITIONAL: ({ head, date }) => {
    const when = date ? `${date}有事情。` : '有一件事情。';
    return `${head}${when}如果情况跟你有关，你才需要处理；如果没有关系，就不用。`;
  },
  SCAM_ALERT: () =>
    `小心！这是骗局。不要相信，不要汇钱给别人，马上告诉家里人。`,
};

const TA: Record<Status, Template> = {
  INFO_ONLY: ({ head }) =>
    `${head}நீங்கள் எதுவும் செய்யத் தேவையில்லை, பணமும் கட்டத் தேவையில்லை.`,
  ACTION_REQUIRED: ({ head, amount, date }) => {
    if (amount && date) return `${head}நீங்கள் ${date}க்கு முன் ${amount} கட்ட வேண்டும்.`;
    if (amount) return `${head}நீங்கள் ${amount} கட்ட வேண்டும்.`;
    if (date) return `${head}நீங்கள் ${date} அன்று செல்ல வேண்டும். பணம் கட்டத் தேவையில்லை.`;
    return `${head}நீங்கள் ஒன்று செய்ய வேண்டும். வீட்டில் யாரிடமாவது உதவி கேளுங்கள்.`;
  },
  CONDITIONAL: ({ head, date }) => {
    const when = date ? `${date} அன்று ஒரு விஷயம் உள்ளது. ` : '';
    return `${head}${when}அது உங்களுக்குப் பொருந்தினால் மட்டுமே நீங்கள் நடவடிக்கை எடுக்க வேண்டும். இல்லையென்றால் ஒன்றும் செய்யத் தேவையில்லை.`;
  },
  SCAM_ALERT: () =>
    `கவனம்! இது மோசடி. நம்ப வேண்டாம், பணம் அனுப்ப வேண்டாம், உடனே வீட்டில் சொல்லுங்கள்.`,
};

const TEMPLATES: Record<Lang, Record<Status, Template>> = {
  nan: NAN,
  en: EN,
  ms: MS,
  cmn: CMN,
  ta: TA,
};

/**
 * Build the sentence Sun Ah speaks. Pure function of the model's fields —
 * no model text reaches the TTS, which is the whole point of mitigation 5.
 */
export function buildSpeechText(
  result: LetterResult,
  lang: Lang,
  address: Address = 'none'
): string {
  const status = TEMPLATES[lang][result.status] ? result.status : 'CONDITIONAL';
  const slots: Slots = {
    head: HEAD[lang](localiseSender(result.sender, lang)),
    amount: speakAmount(result.amount_due, lang),
    date: speakDate(result.deadline, lang),
  };
  return ADDRESS[lang][address] + TEMPLATES[lang][status](slots);
}
