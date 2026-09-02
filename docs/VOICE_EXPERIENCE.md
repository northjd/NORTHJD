# Voice Experience

Voice is the same product, asked out loud. Not a microphone in front of a search box,
and not a second answering path with weaker rules.

---

## The structural guarantee

Voice input is transcribed **on the client** and posted to the same `/api/companion`
endpoint as typed text. The spoken response is rendered from `response.voice`, which is
derived from the same validated `CompanionResponse` object as the text.

There is no second answering path. Speech therefore cannot assert anything the text does
not, and both go through `assertEvidenceIntegrity`. That is what makes "voice and text
share one evidence model" a property of the code rather than a promise.

---

## Privacy by default

`STT_PROVIDER=browser` and `TTS_PROVIDER=browser`. The Web Speech API runs on the user's
own device:

- **no audio reaches this server**
- **no credential exists to leak**
- nothing to retain, so nothing to have a retention policy about

The browser STT provider deliberately has **no** server-side `transcribe` method. The
absence is the guarantee — not a flag that could be flipped by accident.

Server-side alternatives sit behind the same interfaces (`deepgram`, `elevenlabs`) and
report themselves unavailable without a key. `VOICE_PERSIST_AUDIO=false` by default;
enabling it requires an explicit retention policy. Transcripts are personal data and are
deleted with the conversation.

---

## Availability is detected, never assumed

On mount the client checks for `SpeechRecognition` / `webkitSpeechRecognition`. Where it
is absent, the button does not appear and the UI says:

> Voice input is not available in this browser. The Companion works the same by typing —
> voice and text share one answering path and one evidence model.

A button that appears and does nothing is worse than no button. The same applies to
recognition errors: microphone permission denial produces *"Voice input failed. Check
microphone permission, or type instead."*

---

## Evidence stays visible while speaking

The panel keeps showing the transcript, the numbered citations with source and date, the
evidence links, the source perspective and the as-of date. A spoken answer remains
checkable — the eye can verify what the ear was told.

Spoken length is estimated at 150 wpm (against 220 for reading), so a session can say
how long it will take.

---

## Finite sessions

An estimated duration up front, a transcript after, and an end. No endless audio feed —
the same principle as the brief.

The transcript stores the full structured answer per turn, so a user can revisit an
answer and reach its evidence afterwards.

---

## Implemented

- Push-to-talk voice input via the browser
- Spoken responses with stop control
- Runtime availability detection with honest messaging
- One endpoint, one evidence model, shared with text
- Response length and depth controls that apply equally to spoken output
- Voice turns marked in the transcript; `hadVoice` on the conversation
- Text fallback that is genuinely equivalent, not degraded

## Not implemented, and not claimed

Conversational turn-taking · streaming transcription · interruption mid-answer ·
"tell me more" / "skip" / "slower" voice commands · wake word · always-on real-time
voice · driving mode · meeting recording or autonomous participation · real-time
translation.

The admin capabilities page lists these, so the reader does not have to infer the gap
from silence.

---

## Why not more, yet

The listed gaps are real product work, not configuration. Streaming transcription and
interruption need a persistent connection and a server-side STT provider, which would
mean audio reaching the server — a privacy trade worth making deliberately rather than
by default.

Voice commands need an intent layer that would sit between the user and the evidence
model. Doing that carelessly is how voice ends up with its own, weaker answering path,
which is the one thing this design refuses.
