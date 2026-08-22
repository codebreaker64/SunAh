# SunAh — demo video script

**Target: 2:00.** Structure follows blueprint §11, adapted for video rather
than a live demo.

## The one thing video changes

A live demo has to sit through inference. Measured on the Pixel 9: **25–39
seconds per letter**, text path. §11 budgets 45 seconds for the whole demo
section, so live you would spend it all watching a spinner.

On video you cut. **But do not fake the speed** — a judge who later picks up
the phone and waits 35 seconds will feel misled, and that costs more than the
seconds saved. The honest edit is to show the wait compressed with a visible
speed indicator, and say the real number out loud. That is the line taken
below at 0:52.

---

## Shot list

| # | Time | Duration | Visual | Narration |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | 6s | Title card: SunAh, one line of Hokkien beneath | *(silence, then)* "This is a letter from the government." |
| 2 | 0:06 | 12s | Stat build: 1-in-4, 83,000 | "By 2030, one in four Singaporeans will be 65 or older. Eighty-three thousand will live alone. Many were never English-educated, and are most comfortable in dialect." |
| 3 | 0:18 | 8s | Stat build: S$913M / S$37,000 / 8× | "Singapore lost nine hundred and thirteen million dollars to scams last year. The average elderly victim lost thirty-seven thousand — about eight times what a younger victim loses." |
| 4 | 0:26 | 5s | Hands placing a letter on a table, phone beside it | "So when an official letter arrives, they wait for a grandchild to visit." |
| 5 | 0:31 | 10s | **PHONE FOOTAGE** — scam letter, one tap, card turns red | *(let the Hokkien audio play in full — do not talk over it)* |
| 6 | 0:41 | 6s | Subtitle overlay of the Hokkien, with English gloss | "That's Hokkien. It says: don't believe this, don't send money, go tell someone at home." |
| 7 | 0:47 | 10s | **PHONE FOOTAGE** — polyclinic letter, card shows 27 August | "The polyclinic letter has two dates on it. A cancelled one, and a new one. It reads the new one." |
| 8 | 0:57 | 6s | Zoom on the `source_quote` line | "And it shows the line it got that from — so a family member can check it." |
| 9 | 1:03 | 7s | **PHONE FOOTAGE** — language switch to Malay, replay | "One tap to switch languages. Same letter, Malay." |
| 10 | 1:10 | 14s | Architecture diagram: phone lit, cloud crossed out | "Medical and financial letters shouldn't go to a cloud API. Gemma 4 E2B reads the letter on the phone, through ExecuTorch. Image, reasoning, classification — all on-device. The letter never crosses the network." |
| 11 | 1:24 | 8s | Diagram: four languages offline on-device | "For four of five languages the voice is on-device too. We had to name the offline voice explicitly to get that — the platform default quietly used a server." |
| 12 | 1:32 | 12s | Diagram: one arrow, phone → laptop, labelled "one sentence" | "For Hokkien, and only Hokkien, one summary sentence goes to a laptop on our own hotspot. A*STAR released open Hokkien TTS this year, and it beats every general Chinese model we tested at not collapsing into Mandarin. It has no mobile build yet." |
| 13 | 1:44 | 10s | Text: the open issue, upstream repo | "The ONNX export is an open issue on their repo. When it lands, SunAh is fully on-device with no change to our code. That's the piece Singapore's open speech stack is still missing." |
| 14 | 1:54 | 6s | End card: SunAh + the six fixtures, 6/6 | "Six test letters. Six correct." |

---

## Narration, clean copy

> This is a letter from the government.
>
> By 2030, one in four Singaporeans will be 65 or older. Eighty-three thousand
> will live alone. Many were never English-educated, and are most comfortable
> in dialect.
>
> Singapore lost nine hundred and thirteen million dollars to scams last year.
> The average elderly victim lost thirty-seven thousand — about eight times
> what a younger victim loses.
>
> So when an official letter arrives, they wait for a grandchild to visit.
>
> *(scam letter plays in Hokkien — no narration)*
>
> That's Hokkien. It says: don't believe this, don't send money, go tell
> someone at home.
>
> The polyclinic letter has two dates on it. A cancelled one, and a new one.
> It reads the new one. And it shows the line it got that from — so a family
> member can check it.
>
> One tap to switch languages. Same letter, Malay.
>
> Medical and financial letters shouldn't go to a cloud API. Gemma 4 E2B reads
> the letter on the phone, through ExecuTorch. Image, reasoning,
> classification — all on-device. The letter never crosses the network.
>
> For four of five languages the voice is on-device too. We had to name the
> offline voice explicitly to get that — the platform default quietly used a
> server.
>
> For Hokkien, and only Hokkien, one summary sentence goes to a laptop on our
> own hotspot. A*STAR released open Hokkien TTS this year, and it beats every
> general Chinese model we tested at not collapsing into Mandarin. It has no
> mobile build yet.
>
> The ONNX export is an open issue on their repo. When it lands, SunAh is
> fully on-device with no change to our code. That's the piece Singapore's
> open speech stack is still missing.
>
> Six test letters. Six correct.

---

## Capturing the phone footage

Record on the device, not with a camera pointed at it:

```bash
adb shell screenrecord --size 1080x2400 --bit-rate 8000000 /sdcard/shot.mp4
# ...perform the scan, then Ctrl-C...
adb pull /sdcard/shot.mp4 video/assets/
```

Three shots needed: **scam**, **polyclinic**, **language switch**. Take each
twice — the second run hits the server cache, so the Hokkien audio starts
instantly and cuts better.

**Before recording, every time:**

1. `adb reverse tcp:8000 tcp:8000` — this drops silently and is the single
   most common reason Hokkien falls back to Mandarin mid-take.
2. Turn **off NordVPN**. It routes the laptop onto 10.5.0.2 and the phone
   cannot reach it.
3. Close Brave. It holds ~1.4 GB of the 3050's 4 GB and leaves ~360 MB of
   headroom.
4. Check `/health` returns `"ok":true` and note `voice_mode`.
5. Run each line once before recording so it is cached.

---

## Two claims to keep honest

**Do not say "fully offline".** Hokkien needs the laptop. The wording above is
deliberate: *four of five languages* on-device, *one sentence* for Hokkien.

**Do not say the voice is a real ah-ma** unless you have recorded one. Until
`ah_ma_voice.pt` exists, `/health` reports `voice_mode: design` and the voice
is synthesised from a description, not cloned from a person.
