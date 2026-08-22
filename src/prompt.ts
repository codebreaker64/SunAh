import type { Message } from 'react-native-executorch';

/**
 * The Gemma prompt, blueprint section 5.
 *
 * Deliberately short — small models degrade with long system prompts — and
 * leaning on worked examples instead, per section 4 mitigation 2.
 *
 * Note what is NOT here: the dialect composition. `speech_text` is assembled
 * in JS from templates (see speech.ts), which removes the failure mode where
 * the model writes Mandarin-style Chinese that the TTS then pronounces as
 * Hokkien-accented Mandarin.
 *
 * These build `Message[]` for `llm.generate()` rather than a single string for
 * `llm.sendMessage()`, and that matters: `sendMessage` appends to the
 * conversation history, so the second letter of a demo would be classified
 * with the first one still in context. Every letter is an independent
 * judgement, so every call starts clean.
 */

const SCHEMA = `STATUS is one of:
  INFO_ONLY       nothing to do, nothing to pay
  ACTION_REQUIRED a date to attend, a form to renew, or a bill to pay,
                  and it applies to EVERY reader of the letter
  CONDITIONAL     an action that applies only to SOME readers, described by a
                  condition ("residents who...", "if you...", "those with...").
                  If the letter says other readers need do nothing, it is
                  CONDITIONAL, never ACTION_REQUIRED.
  SCAM_ALERT      threats, personal-account transfer, 24-hour ultimatum,
                  gold bars or vouchers, or a demand for secrecy

{
  "status": "...",
  "sender": "...",
  "summary_english": "2 short sentences",
  "action_items": ["..."],
  "amount_due": "S$X.XX" | "NIL" | "FREE",
  "deadline": "YYYY-MM-DD" | null,
  "source_quote": "the exact line this conclusion rests on"
}

If a letter shows a cancelled date and a new date, use ONLY the new date.
Never invent an amount or a date. Use null if unclear.

Money CREDITED, DEPOSITED, PAID TO or GIVEN TO the reader is money they
RECEIVED. That is INFO_ONLY with amount_due NIL. Only money the reader must
PAY OUT is ACTION_REQUIRED. Read the direction of the money before deciding.

The words "ACTION REQUIRED" often appear as a printed LABEL on the letter. Read
what follows them. "ACTION REQUIRED: None" means INFO_ONLY. Never classify a
letter as ACTION_REQUIRED merely because that phrase appears on it.

source_quote must be copied EXACTLY from the letter, word for word. If you
cannot read a line clearly enough to copy it, use "" rather than paraphrasing
or guessing. A quote that is not in the letter is worse than no quote.`;

/**
 * Four worked examples: the credit-not-debit case, the cancelled-date case, a
 * conditional, and the scam. A smaller model leans on examples far more than a
 * larger one, so these are the highest-value tokens in the prompt.
 *
 * Section 4 says to few-shot fixtures 1, 2 and 5 — but those are INFO_ONLY,
 * ACTION_REQUIRED and SCAM_ALERT, which leaves CONDITIONAL with no example at
 * all. E2B duly flattened fixture 6 into ACTION_REQUIRED on the first gate run.
 * The conditional example below is a DIFFERENT letter (water, not lifts) so
 * fixture 6 stays an honest test rather than one we trained on.
 */
const FEW_SHOT = `Here are four worked examples.

LETTER: "We are pleased to inform you that a sum of S$450.00 has been CREDITED
to your CPF Retirement Account on 5 August 2026. No action is required on your
part."
JSON: {"status":"INFO_ONLY","sender":"Central Provident Fund Board","summary_english":"CPF has put S$450 into your Retirement Account. This is money you received, not money you owe.","action_items":[],"amount_due":"NIL","deadline":null,"source_quote":"a sum of S$450.00 has been CREDITED to your CPF Retirement Account"}

LETTER: "Your appointment on 18 August 2026, 9.30am has been CANCELLED as the
attending doctor is on medical leave. Your NEW appointment is confirmed for:
Thursday, 27 August 2026 at 10.15am."
JSON: {"status":"ACTION_REQUIRED","sender":"Ang Mo Kio Polyclinic","summary_english":"Your 18 August appointment was cancelled. Your new appointment is 27 August 2026 at 10.15am.","action_items":["Attend Ang Mo Kio Polyclinic on 27 August 2026 at 10.15am"],"amount_due":"NIL","deadline":"2026-08-27","source_quote":"Your NEW appointment is confirmed for: Thursday, 27 August 2026 at 10.15am"}

LETTER: "Water supply to Blocks 120 to 125 will be shut off on 3 September 2026
from 10.00am to 4.00pm for pipe replacement. Residents who use dialysis or other
medical equipment needing water should call our office at 6555 4000 before 1
September so we can arrange a temporary supply. All other residents need only
store water in advance."
JSON: {"status":"CONDITIONAL","sender":"Town Council","summary_english":"Water will be off on 3 September 2026 from 10am to 4pm. Only call the office beforehand if you use dialysis or medical equipment that needs water.","action_items":["If you use dialysis or medical equipment needing water, call 6555 4000 before 1 September 2026"],"amount_due":"NIL","deadline":"2026-09-01","source_quote":"Residents who use dialysis or other medical equipment needing water should call our office"}

LETTER: "Your bank accounts will be FROZEN within 24 HOURS unless you transfer
S$8,500 to Account Name: LIM WEI SENG. DO NOT DISCUSS THIS CASE WITH FAMILY
MEMBERS."
JSON: {"status":"SCAM_ALERT","sender":"Unknown — not a real government agency","summary_english":"This is a scam. Real agencies never demand transfers to a personal bank account and never tell you to keep it secret from your family.","action_items":["Do not transfer any money","Tell a family member or neighbour now","Call the ScamShield helpline 1799"],"amount_due":"NIL","deadline":null,"source_quote":"DO NOT DISCUSS THIS CASE WITH FAMILY MEMBERS OR ANY OTHER PERSON"}`;

export const SYSTEM_PROMPT = `You read Singapore official letters for an elderly reader. Reply with JSON only, no other text.

${SCHEMA}

${FEW_SHOT}`;

/** Vision path: the image rides on the user message as `mediaPath`. */
export function visionMessages(imagePath: string): Message[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: 'Read the letter in this image and reply with JSON only.',
      mediaPath: imagePath,
    },
  ];
}

/**
 * Text path: the escape hatch from section 4 mitigation 4. If E2B's vision
 * underperforms at the 14:00 decision point, `useOCR` extracts the text and
 * this takes over — removing the hardest part of the task from a small
 * multimodal model. It is also how the 09:00 viability test runs, since it
 * works before the camera is wired.
 */
export function textMessages(letterText: string): Message[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Read this letter and reply with JSON only.\n\nLETTER:\n${letterText}`,
    },
  ];
}
