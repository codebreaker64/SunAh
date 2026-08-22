import { jsonrepair } from 'jsonrepair';
import { LetterResult, Status } from './types';

/**
 * Turning whatever E2B actually said into a LetterResult.
 *
 * Section 7g lists "E2B returns malformed JSON" as a moderate failure and
 * asks for a graceful path: show `summary_english` if we can find it, else
 * say we couldn't read the letter. A small model will wrap JSON in prose,
 * emit trailing commas, use single quotes, or stop mid-object — so this is
 * three layers of increasingly desperate recovery rather than one JSON.parse.
 */

const STATUSES: Status[] = [
  'INFO_ONLY',
  'ACTION_REQUIRED',
  'CONDITIONAL',
  'SCAM_ALERT',
];

export type ParseOutcome =
  | { ok: true; result: LetterResult; repaired: boolean }
  | { ok: false; partial: Partial<LetterResult>; raw: string };

/** Strip ```json fences and any prose either side of the outermost braces. */
function isolateJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  if (start === -1) return null;
  // Walk to the matching close brace so trailing commentary is dropped.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  // Unterminated — hand the tail to jsonrepair, which closes open structures.
  return body.slice(start);
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return fallback;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function coerceStatus(v: unknown): Status | null {
  const s = asString(v).toUpperCase().replace(/[\s-]/g, '_');
  return (STATUSES as string[]).includes(s) ? (s as Status) : null;
}

/** "$132", "SGD 132.00", "132.5" -> "S$132.00". Passes NIL/FREE through. */
function normaliseAmount(v: unknown): string {
  const s = asString(v).toUpperCase();
  if (!s) return 'NIL';
  if (/^(NIL|NONE|NA|N\/A|0|ZERO)$/.test(s)) return 'NIL';
  if (/FREE|NO CHARGE|NO FEE/.test(s)) return 'FREE';
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return 'NIL';
  return `S$${parseFloat(m[1]).toFixed(2)}`;
}

/**
 * Only ISO dates survive. A small model that writes "27 August" or "next
 * Thursday" gets null rather than a guess — section 5 is explicit that we
 * never invent a date, and a wrong date is the most dangerous output we can
 * produce (fixture 2).
 */
function normaliseDeadline(v: unknown): string | null {
  const s = asString(v);
  if (!s || /^(null|none|n\/a|unclear)$/i.test(s)) return null;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return null;
  const [, y, mo, d] = iso;
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Last-ditch: pull a summary out of prose when there is no usable JSON. */
function scavenge(raw: string): Partial<LetterResult> {
  const partial: Partial<LetterResult> = {};
  const status = raw.match(
    /\b(INFO_ONLY|ACTION_REQUIRED|CONDITIONAL|SCAM_ALERT)\b/
  );
  if (status) partial.status = status[1] as Status;
  const summary = raw.match(/"summary_english"\s*:\s*"([^"]{10,})"/);
  if (summary) {
    partial.summary_english = summary[1];
  } else {
    // No JSON at all — take the first substantial prose line.
    const line = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 25 && !l.startsWith('{') && !l.startsWith('```'));
    if (line) partial.summary_english = line;
  }
  const quote = raw.match(/"source_quote"\s*:\s*"([^"]{5,})"/);
  if (quote) partial.source_quote = quote[1];
  return partial;
}

export function parseLetterResponse(raw: string): ParseOutcome {
  const isolated = isolateJson(raw);

  if (isolated) {
    for (const [candidate, repaired] of [
      [isolated, false],
      [safeRepair(isolated), true],
    ] as [string | null, boolean][]) {
      if (!candidate) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(candidate);
      } catch {
        continue;
      }
      if (!obj || typeof obj !== 'object') continue;

      const status = coerceStatus(obj.status);
      const summary = asString(obj.summary_english);
      // A result with neither a status nor a summary is not worth showing.
      if (!status && !summary) continue;

      return {
        ok: true,
        repaired,
        result: {
          // Defaulting to CONDITIONAL rather than INFO_ONLY: an unclassifiable
          // letter is one to read, not one to ignore (section 9).
          status: status ?? 'CONDITIONAL',
          sender: asString(obj.sender, 'Unknown sender'),
          summary_english: summary,
          action_items: asStringArray(obj.action_items),
          // A scam letter states a sum, and E2B faithfully extracts it — on
          // fixture 5 it returned S$8,500.00. But the card renders `amount_due`
          // as "Amount", so a red SCAM_ALERT card would show a figure that
          // reads exactly like a bill to pay. Section 8 calls that the outcome
          // that makes the demo a liability. You never owe a scammer anything,
          // so this is decided here rather than asked of a small model.
          amount_due:
            status === 'SCAM_ALERT' ? 'NIL' : normaliseAmount(obj.amount_due),
          deadline: normaliseDeadline(obj.deadline),
          source_quote: asString(obj.source_quote),
        },
      };
    }
  }

  return { ok: false, partial: scavenge(raw), raw };
}

function safeRepair(s: string): string | null {
  try {
    return jsonrepair(s);
  } catch {
    return null;
  }
}

/**
 * Score one fixture. Used by the 09:00 viability test so pass/fail is a number
 * rather than a judgement call made while tired.
 */
export function scoreAgainst(
  actual: LetterResult,
  expected: LetterResult
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (actual.status !== expected.status) {
    failures.push(`status: got ${actual.status}, want ${expected.status}`);
  }
  if (actual.amount_due !== expected.amount_due) {
    failures.push(`amount: got ${actual.amount_due}, want ${expected.amount_due}`);
  }
  if (actual.deadline !== expected.deadline) {
    failures.push(
      `deadline: got ${actual.deadline ?? 'null'}, want ${expected.deadline ?? 'null'}`
    );
  }
  if (!actual.source_quote) {
    failures.push('source_quote: empty — nothing for a family member to check');
  }
  return { passed: failures.length === 0, failures };
}
