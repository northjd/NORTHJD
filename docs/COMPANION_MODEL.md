# Companion Model

The Companion is the natural-language interface to the whole system, not a chatbot
bolted onto a news app. It is the same intelligence, the same evidence layer and the
same trust rules, reached by asking.

---

## One structured response

Every mode produces the same object, and both the text renderer and the speech renderer
read from it.

```ts
CompanionResponse {
  mode, depth, length, generator
  directAnswer          // must not contain claims absent from verifiedFacts
  verifiedFacts[]       // { text, citationIndexes[] } — citationIndexes non-empty
  interpretations[]      // our reading, labelled
  hypotheses[]           // testable propositions, labelled
  counterEvidence[]      // cited, like facts
  unknowns[]             // what this cannot tell you
  coverageLimitations[]
  suggestedFollowUps[]
  learningConnections[]
  conversationStarters[]
  citations[]            // claimId + evidenceSpanId + perspective + strength + dates
  asOf                   // required
  coverageFrom, coverageTo
  contextUsed[]          // what the answer actually saw
  voice { spokenSummary, estimatedSeconds, segments[] }
  insufficientEvidence   // not a failure state
}
```

This is what makes "voice and text share one evidence model" a property of the code.
Voice input is transcribed client-side and enters the **same** endpoint; the spoken
response renders from `response.voice`, derived from the same validated object. There is
no second answering path, so speech cannot assert anything the text does not.

Zod enforces the structure, including that citation indexes are in range and that a
response cannot claim insufficient evidence while asserting facts.

---

## Retrieval is claim-level

Not document-level. An answer cites the *sentence* that supports it, with the evidence
span it came from.

**Query construction.** Interrogatives and stopwords are stripped, then terms are joined
with **OR**. `websearch_to_tsquery` treats whitespace as AND, so a seven-word question
requires all seven stems in one claim and matches essentially nothing — the engine then
reports "insufficient evidence" for questions it could answer. OR retrieves candidates
and `ts_rank` orders them.

**The relevance floor.** OR retrieval on its own is dangerous. A question about an
unlisted Uzbek textile mill matched an NVIDIA earnings release on "revenue" and
"quarterly", and the answer presented four irrelevant statements as "evidence bearing
on this". A claim must now contain a minimum share of the query terms:

```
1 term → 1 · 2–3 terms → 2 · 4+ terms → max(2, ceil(terms × 0.35))
```

Below the floor, the honest refusal is the correct answer. Verified: that question now
refuses.

**Entity scoping.** A question asked on a company page is scoped to that company;
otherwise company names in the question are resolved through the alias table, with the
same ambiguity guard the pipeline uses.

**Ordering.** FACT before FORECAST before INTERPRETATION, then rank, then recency.

---

## Seven modes

| Mode | Purpose | Needs |
|---|---|---|
| **Brief me** | A time-boxed update | Recent insights |
| **Explain it** | Fundamentals and mechanics | A learning unit, or claims |
| **Explore it** | Evidence-grounded research | Claims — this is the mode |
| **Prepare me** | One specific conversation | Claims |
| **Challenge me** | Counter-arguments, weak assumptions | May legitimately find none |
| **Teach me** | Structured learning | A learning unit |
| **Capture** | The user's own thought | Nothing |

### Mode-aware insufficiency

Insufficiency is judged on **what the mode actually produced**, not on whether claim
retrieval returned rows. Getting this wrong is subtle and was a real defect: after the
relevance floor was added, *Brief me*, *Explain it*, *Teach me* and *Capture* all began
refusing to answer, because they were being judged on a retrieval they do not depend on.

```
capture_reflect            never insufficient — it stores your own note
brief_me                   insufficient only if no insights were produced
explain_it / teach_me      insufficient only if no unit and no claims
explore_it / prepare_me    insufficient if no cited claims
challenge_me               may answer "nothing contradicts this" — and say that
                           absence of contradiction is not confirmation
```

### Challenge Me is not adversarial theatre

It does three things and refuses a fourth:

1. names the assumptions — self-report accepted at face value, baseline stability
   assumed, stated intent equated with delivery
2. retrieves genuine counter-evidence from `contradictions`
3. offers an alternative explanation — market conditions rather than the initiative

What it does not do is **manufacture opposition without evidence**. When nothing
contradicts the view, it says so, and adds that absence of contradiction in a limited
source set is weak evidence of correctness. An invented counter-argument would be the
same failure as an invented fact.

---

## The gate

`assertEvidenceIntegrity` runs on every response before it can be returned, and it
**rejects rather than repairs**. Silently dropping a bad citation would hide the defect.
The API returns:

> The generated answer failed its evidence check and was discarded. Nothing unverified
> is shown.

---

## Response shape controls

Six lengths (`one_sentence` → `deep_dive`) mapped to word budgets and item counts, and
three depths (`foundation` / `executive` / `expert`) which select the matching learning
unit and, where a model is configured, set the register.

Length affects how much is shown. It never affects whether something is cited.

---

## Context

Route-derived and always disclosed. A question on a company page is entity-scoped; on an
insight, the insight is the subject. `contextUsed` records what the answer actually saw
and is rendered in the transcript.

Context may **add** to a question. It may never silently change what was asked.

---

## Memory boundaries

| Kind | Lifetime | Notes |
|---|---|---|
| Session context | The conversation | Turns, in order |
| Preference memory | Until changed | Explicit settings only |
| Knowledge state | Long-lived | Cautious, visible, correctable |
| Personal notes | Until deleted | **Never cited as evidence** |
| Organisation knowledge | — | Not implemented |

The Companion does not persist casual remarks. Anything durable is explicit,
inspectable and deletable. The separation of personal notes from claims is
architectural — different table, different perspective — so a user's own thinking cannot
be laundered into evidence.

---

## Voice

`browser` by default in both directions: the Web Speech API runs on the user's device,
no audio reaches the server, no credential exists to leak. The browser STT provider has
**no** server-side `transcribe` method — the absence is the guarantee.

Availability is detected at runtime. Where the browser lacks the API, the UI says voice
input is unavailable in this browser and notes that text uses the same path and the same
evidence model.

During a session the transcript, sources and evidence links stay visible, so a spoken
answer remains checkable. Sessions are finite: an estimated duration up front, a
transcript after.

Not implemented, and not claimed: always-on real-time voice, wake word, driving mode,
meeting recording. Interfaces exist for server-side STT/TTS and report themselves
unavailable without a key.

---

## Extractive vs. model-assisted

With no model configured, every mode still works. Answers reuse claim sentences
verbatim, structure comes from the data model, and the UI labels output *Extractive*
throughout. It reads as assembled rather than written — the honest trade.

With `AI_PROVIDER=anthropic` and a key, the same structure is filled by a model whose
output is schema-validated and evidence-checked before display. Anything failing those
checks is discarded, and the caller falls back to the extractive path.

The important asymmetry: **the checkable path is the default and the model is the
enhancement**, not the other way round.

---

## Actions

Read actions (search, filter, compare, open evidence) run directly. Write, delete and
share actions require confirmation. Nothing acts outside the product on its own.
