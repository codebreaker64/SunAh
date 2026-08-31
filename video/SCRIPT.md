# SunAh — demo video

**Runs 2:26.** Built from `script.m4a` (the recorded narration, 2:07.9) plus two
real phone captures. This file describes the video that actually exists — it is
regenerated from the recording, not a plan written ahead of it.

## The one thing video changes

A live demo has to sit through inference. Measured on the Pixel 9 in these two
takes: **39 s** for the Hokkien run, **55 s** for the Malay one.

On video you cut. **But do not fake the speed** — a judge who later picks up the
phone and waits 40 seconds will feel misled, and that costs more than the seconds
saved. So both waits are labelled on screen: the polyclinic wait plays at ×5 with
a badge naming the real 39 s, and the language wait is replaced by a card that
says "≈ 55 s later — the same on-device inference, cut for length".

## Why the video is longer than the narration

The narration runs continuously; there is no gap in it anywhere long enough for
Sun Ah to speak. So the recording is cut into **three** clips on track 10, with
two deliberate holes between them. Nothing talks over the app's own voice.

| clip   | source range      | on the timeline  | ends on                                     |
| ------ | ----------------- | ---------------- | ------------------------------------------- |
| `vo-a` | 0 → 45.95         | 0 → 45.95        | "…a cancelled one and a new one."           |
| hole   | —                 | 45.95 → 53.80    | **Hokkien plays** (7.85 s)                  |
| `vo-b` | 45.95 → 61.30     | 53.80 → 69.15    | "…same letter, Malay."                      |
| hole   | —                 | 69.15 → 77.00    | **Malay plays** (7.85 s)                    |
| `vo-c` | 61.30 → 127.93    | 77.00 → 143.63   | "Six test letters, six correct."            |

Both split points sit inside a real pause in the recording, so no word is clipped.

## Shot list

| #   | Time      | Visual                                                        | Narration                                                        |
| --- | --------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | 0:00      | Title: SunAh, one line of Hokkien beneath                     | "This is the letter from the government."                        |
| 2   | 0:04      | Stat build: 1-in-4, 83,000, then the dialect line             | "By 2030, one in four Singaporeans will be 65 or older…"          |
| 3   | 0:17      | Stat build: S$913M, S$37,000, 8×                              | "Singapore lost 913 million dollars to scams last year…"          |
| 4   | 0:31      | Quote, phone enters framing the letter                        | "So when an official letter arrives, they wait for a grandchild." |
| 5   | 0:39      | **Capture** — the wait at ×5, the two dates called out        | "The polyclinic letter has two dates on it…"                      |
| 6   | 0:46      | Card lands, **Hokkien plays in full**; what it said, translated | *(silence — do not talk over it)*                                |
| 7   | 0:54      | Still of the card holds; source-quote panel                   | "It reads the new one, and it shows the line it got that from…"   |
| 8   | 1:03      | **Capture** — chooser, one tap onto Bahasa Melayu             | "One tap to switch languages. Same letter, Malay."                |
| 9   | 1:07      | "≈ 55 s later" cut card, then the Malay card                  | *(silence)*                                                       |
| 10  | 1:10      | **Capture** — **Malay plays in full**                         | *(silence)*                                                       |
| 11  | 1:17      | Diagram: phone lit, cloud crossed out and dimmed              | "Medical and financial letters shouldn't go to a cloud API…"      |
| 12  | 1:34      | Four languages on-device, 福建话 on the laptop                 | "For four of five languages the voice is on-device too…"          |
| 13  | 1:46      | Diagram: phone → one sentence → laptop GPU                    | "For Hokkien, and only Hokkien, one summary sentence…"            |
| 14  | 2:03      | The open ONNX issue upstream                                  | "It has no mobile build yet. The ONNX export is an open issue…"   |
| 15  | 2:20      | End card: SunAh + the six fixtures                            | "Six test letters, six correct."                                  |

Every reveal in `index.html` is placed on a **word timing** taken from a
word-level transcript of `script.m4a`, pulled 0.1–0.2 s early so the eye leads
the ear. The timings are written into the comments beside each tween; if the
narration is ever re-recorded, re-transcribe and move them together.

## What is used from each capture

Both files are normalised to CFR 30 fps into `assets/` first — `Language.mp4` is
variable-frame-rate with audio as stream 0, which is not safe to render from
directly.

**`assets/poly-cap.mp4`** (from `Polyclinic.mp4`, 57.27 s)

| source        | used as                          | rate |
| ------------- | -------------------------------- | ---- |
| 5.90 → 10.10  | framing the letter, then the tap | 1×   |
| 10.10 → 49.50 | the wait — all 39.4 s of it      | 5×   |
| 49.50 → 56.15 | the card, Hokkien voice          | 1×   |

The Hokkien voice runs 50.87 → 56.81 in source. The capture cuts back to the
language chooser at 56.23, so `assets/poly-card-still.png` (grabbed at 55.5)
fades in at 51.80 and holds the card while the narration explains the source
quote.

**`assets/lang-cap.mp4`** (from `Language.mp4`, 81.11 s)

| source        | used as                                        | rate |
| ------------- | ---------------------------------------------- | ---- |
| 1.00 → 5.70   | the chooser; the tap onto Bahasa Melayu at 2.01 | 1×   |
| 67.60 → 75.75 | the Malay card, Malay voice                     | 1×   |

The Malay voice runs 69.25 → 75.01. Two further utterances at 75.81 → 81.11 are
left out, and the take is cut before 78.5 because the screen recorder's own stop
control slides in on the right after that.

Gains are set against the narration's measured **−19.7 LUFS**: the Hokkien
region sits at −21.9 (so `data-volume="1.58"`) and the Malay at −19.0
(`data-volume="1.26"`).

## Three claims to keep honest

**Do not say "fully offline".** Hokkien needs the laptop. The wording is
deliberate: *four of five languages* on-device, *one sentence* for Hokkien.

**Do not say the voice is a real ah-ma** unless you have recorded one. Until
`ah_ma_voice.pt` exists, `/health` reports `voice_mode: design` and the voice is
synthesised from a description, not cloned from a person.

**"It reads the new one" is not supported by either take on file.** The letter
says PREVIOUS Tue 18 Aug 2026 9:30 AM (cancelled), NEW Thu 27 Aug 2026 10:00 AM.
The Hokkien run quoted "Tue 14 March 2020, 10:00 am", which is on neither the
letter nor the calendar; the Malay run said 17 Ogos / 17 August 2020. Both are
wrong, and they disagree with each other. The narration line at 0:54 claims
otherwise, so the video deliberately puts **no date claim on screen there** — it
shows the source-quote mechanism, which is real and demonstrable, and leaves the
letter's own two dates (shot 5) as the only dates asserted. Fix the extraction or
re-record that line before this goes in front of judges.

## Capturing more phone footage

Record on the device, not with a camera pointed at it:

```bash
adb shell screenrecord --size 1080x2400 --bit-rate 8000000 /sdcard/shot.mp4
# ...perform the scan, then Ctrl-C...
adb pull /sdcard/shot.mp4 video/
```

**Before recording, every time:**

1. `adb reverse tcp:8000 tcp:8000` — this drops silently and is the single most
   common reason Hokkien falls back to Mandarin mid-take.
2. Turn **off NordVPN**. It routes the laptop onto 10.5.0.2 and the phone cannot
   reach it.
3. Close Brave. It holds ~1.4 GB of the 3050's 4 GB and leaves ~360 MB of
   headroom.
4. Check `/health` returns `"ok":true` and note `voice_mode`.
5. Stop the recording from the notification shade, not the floating control —
   the floating control slides into frame and has to be cut around.

## Rebuilding

```bash
cd video
npx hyperframes check
npx hyperframes render --quality high --fps 30 --video-frame-format png --workers 3 \
  --output renders/sunah-demo.mp4
```

`--video-frame-format png` matters: both sources are screen recordings, and JPEG
frame extraction softens the UI text inside the phone panel.
