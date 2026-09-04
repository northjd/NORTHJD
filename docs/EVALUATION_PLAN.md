# Evaluation Plan

Fifteen invariants, run against the live database, checked from the CLI and rendered in
admin. These are **properties**, not benchmarks: a failure means a claim the product
makes about itself is currently untrue.

---

## Why invariants rather than scores

A relevance score of 0.72 tells you nothing actionable. "Zero FACT claims lack an
evidence span" tells you the central promise still holds — and when it stops holding,
exactly what broke.

`npm run eval` exits non-zero on any failure, so it works in CI. `/admin/evaluation`
runs the same suite live, so the number on screen is true of the code as it is now
rather than of a stored result.

---

## The suites

### Evidence integrity (3)

- Every `FACT` claim has at least one evidence span — **0 violations across 369 claims**
- Every stored quote still matches the document text at its offsets — 200 sampled, 0
  mismatches
- Every insight traces back to at least one evidenced claim

### Ranking neutrality (2)

- An identical item scores identically whichever company it involves
- No brief section is reserved for a company group — scans live brief items

### Hype filter (3)

- A self-reported quantified outcome is **not** classified as independently validated
- Marketing language does not promote a pilot to scaled deployment
- A discontinued programme is classified as reversed

### Entity resolution (1)

- An ambiguous alias does not resolve on its own; the unambiguous form does

### Deduplication (2)

- Two reports of one deal cluster into a single event
- Identically-worded releases from different companies stay separate

### Source rights (2)

- A source without a completed rights review is not fetched
- No source with a pending review has an active connector — checks the live database

### Claim extraction (2)

- A forward-looking statement is not extracted as a fact
- First-party claims carry `COMPANY_SELF_REPORTING` regardless of precision

**Current: 15/15 passing.**

---

## Layers below

| Layer       | Tool                   | Count            |
| ----------- | ---------------------- | ---------------- |
| Unit        | Vitest                 | 82               |
| Integration | Vitest + live database | 12               |
| Invariants  | `packages/evaluation`  | 15               |
| End-to-end  | Playwright             | 27 × 2 viewports |

Unit tests cover pure logic: offsets, sentence splitting, quantified-outcome detection,
classification, clustering, ranking, brief composition, rights evaluation, SSRF ranges,
feed parsing. Integration tests assert properties of real ingested data.

---

## The five bugs the tests found

Written down because it is the argument for having written them:

1. **`\b` after `%`** — a word boundary after `%` never matches, so `/\d+%\b/` silently
   failed on "markdown fell 18%". **Every percentage outcome** was being classified as
   unquantified, quietly weakening the hype filter.
2. **Outcome language matched verbs only** — "an 18% reduction" is the normal phrasing;
   noun forms were missed entirely.
3. **The adjacent slot was starved** — the anti-filter-bubble reservation silently
   disappeared when earlier sections consumed the budget.
4. **`USER_PROVIDED` counted as independent** — promoted a self-reported figure to
   `INDEPENDENTLY_VALIDATED_IMPACT`.
5. **Over-broad SSRF range** — blocking all of `192.0.0.0/16` killed a legitimate public
   source.

Three of those five would have produced _confidently wrong output_ rather than an error.
That is the class of bug this suite exists for.

---

## Golden sets — present and missing

**Present:** the demo fixtures deliberately encode a self-reported quantified claim, one
event across two sources, conflicting figures for one result, marketing language around
a pilot, and a reversal.

**Missing**, and named in the next steps:

| Case                                 | Why it matters                                                           |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Multilingual sources                 | No non-English fixtures exist                                            |
| Corrected articles                   | Version-diff correction detection is implemented but untested end to end |
| Ambiguous company names              | Unit-tested in isolation; no ingested fixture                            |
| One announcement across five sources | Clustering tested at two                                                 |
| Company comparison                   | The view does not exist                                                  |
| Time-sensitive questions             | Nothing asserts staleness handling in answers                            |

---

## Metrics prepared but not yet measured

The schema supports them; no dashboard computes them yet:

_Source freshness · ingestion and parse success · duplicate rate · correction detection
· citation coverage and support · unsupported claim rate · stale information rate ·
brief completion within budget · already-known and not-relevant rates · reading
completion · source and topic diversity · learning-path progress · concepts connected to
events · insights used in meetings · Challenge Me usage._

Deliberately absent: anything that rewards longer sessions. Time in app, session count
and scroll depth are not measured, because a metric that improves when people spend
longer would eventually shape the product toward doing so.

---

## Adversarial review

Run after each phase, against a fixed list: hallucinations, unsupported implications,
stale information, source misattribution, duplicate events, incorrect entity resolution,
first-party bias, consulting-firm bias, overconfident comparisons, cross-tenant leakage,
prompt injection, misleading completeness, filter bubbles, unlicensed storage, and
features that look complete but are mocked.

The most productive question has been: **where could this produce false confidence?**
Four of the five bugs above came from asking it.
