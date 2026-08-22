# Sun Ah (孙仔)

A one-tap letter reader for Singapore's seniors. Point the camera at an
official letter; Sun Ah says in your own language what it is, whether you need
to do anything, and whether it's a scam.

Built to the v4 blueprint. Section references below point at it.

---

## Corrections to the blueprint

Three things in the v4 document don't match what's actually shipping. They were
verified against the published package, not assumed.

| Blueprint says | Reality | Where it bites |
| --- | --- | --- |
| Pin `react-native-executorch` **0.8.0** | Latest stable is **0.9.3**; resource fetchers are **0.9.1** | 0.8.0 predates the model constants we rely on |
| Android loads the **XNNPACK** `.pte` | Android resolves to **Vulkan** (`gemma_4_e2b_vulkan_8da4w.pte`) | If load fails on the Pixel, it's a Vulkan problem, not an XNNPACK one |
| §1: clear the Gradle cache | **Keep it.** Deleting the emulator images frees more (6.9 GB) and a warm cache is an asset on hackathon day | An hour of re-downloading you don't have |

`models.llm.gemma4_e2b_multimodal()` is real and carries
`capabilities: ['vision', 'audio']`, exactly as §7a claims.

---

## Setup

### Phone side

```bash
npm install
npm run selftest      # no phone needed — proves parser + templates
npm run typecheck
npx expo run:android  # dev build onto the Pixel
```

**JDK 17 is required.** `JAVA_HOME` on this machine now points at
`C:\Program Files\Java\jdk-17`. If Gradle fails with a class-file version
error, that variable has drifted back to 22.

The Gemma `.pte` downloads to the phone on first launch, not to the laptop.
Budget a few GB of free space there.

### Laptop side

```bash
cd server
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
python make_voice_prompt.py ah_ma_5s.wav "<transcript in hanzi>"
uvicorn main:app --host 0.0.0.0 --port 8000
```

The server prints the LAN IP to type into the phone's settings. Check `/health`
from the phone's browser before pitching — no answer means the network, not the
code.

Driver 531.88 on this machine caps CUDA at 12.1, so **cu121** is the right
index. Not cu124.

---

## Running the viability test

§10 puts this first, before any UI: feed fixtures 2 and 6 to E2B at 09:00, not
at 16:00.

Open the app, tap the **⚑** icon, and hit **Run gate (2 & 6)**. It runs the
letters as *text*, which works before the camera is wired and isolates
classification from OCR. Scoring is automatic — pass/fail is a number, not a
judgement made while tired.

If the gate fails, §4 says switch to `useOCR` + text-only or to templated
output, then commit and stop switching.

If the gate passes but the camera path fails, the problem is vision
specifically, and mitigation 4 is the fix.

---

## Layout

```
src/types.ts       Status, Lang, LetterResult
src/prompt.ts      The §5 prompt, plus few-shot from fixtures 1, 2, 5
src/fixtures.ts    The six test letters with expected results and traps
src/parse.ts       Three layers of JSON recovery (§7g) + automatic scoring
src/speech.ts      Hokkien/EN/MS/CMN/TA templates — mitigation 5
src/audio.ts       The §9 fallback chain
src/config.ts      Language, address form, laptop IP, cloud toggle
src/theme.ts       Card colours — blue for CONDITIONAL (§9)
src/selftest.ts    Node-side smoke test, no phone required

components/ResultCard.tsx     Paints before any audio call (§7c)
components/SetupScreen.tsx    Five language buttons, shown once
components/FixtureRunner.tsx  The 09:00 viability test

server/main.py                FastAPI + OmniVoice, fp16, GPU lock
server/make_voice_prompt.py   Build ah_ma_voice.pt once, before Saturday
```

---

## Two things that still need a person

**The Hokkien needs a native speaker.** `src/speech.ts` carries the templates in
hanzi with Tâi-lô romanisation in the comments so a review is one pass over one
file. It has not had that pass. The person who records the voice reference is
the obvious reviewer. The Malay and Tamil lines want the same treatment.

**The voice reference must actually be Hokkien.** A Mandarin or English clip
carries its own accent into every generated line, and you won't notice until
you're in front of a judge.

---

## Design decisions worth knowing

**The model never writes the spoken sentence.** It returns structured fields;
`speech.ts` assembles the sentence from templates. That's §4 mitigation 5, and
it removes the failure mode where the model writes Mandarin-style Chinese that
the TTS pronounces as Hokkien-accented Mandarin.

**Numbers are spelled out in hanzi** for Hokkien and Mandarin — `一百三十二箍`,
not `132`. §13 flags number-heavy content as outside the TTS model's tested
range.

**Unknown English senders are dropped, not read aloud.** A Hokkien voice asked
to say "Ang Mo Kio Polyclinic" will mangle it, so `speech.ts` maps the agencies
we know to hanzi and omits the clause when it doesn't recognise one.

**An unclassifiable letter defaults to `CONDITIONAL`, not `INFO_ONLY`.**
Conditional means *read this*; defaulting to green would mean *ignore this*.

**A malformed date becomes `null`.** "27 August" and "next Thursday" are
rejected rather than guessed. A wrong date is the most dangerous output the
system can produce — fixture 2 exists for exactly this.
