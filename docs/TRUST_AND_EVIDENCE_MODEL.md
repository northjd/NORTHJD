# Trust and Evidence Model

The mechanism by which the product's central promise — _evidence before eloquence_ —
is a property of the code rather than a claim in a document.

---

## The chain

```
source
  └─ raw_document            one row per (source, canonical URL)
      └─ document_version    immutable snapshot; offsets refer to THIS version
          └─ evidence_span   exact character range + the quote, copied out
              └─ claim       one checkable statement
                  └─ event   the real-world occurrence, across sources
                      └─ signal → insight → application / learning connection
```

Two properties make this load-bearing rather than decorative:

**Versions are immutable.** A re-fetch that changes materially creates a new version. An
evidence span points at a specific version, so an article edited after the fact can
never silently move a citation. The old version, and therefore the old citation, stays
valid and inspectable.

**Quotes are copied out.** `evidence_spans.quote` holds the text as well as the offsets.
A citation survives a retention policy that later purges the body, and the evidence
page can highlight the range inside surrounding context.

---

## Claim types

Only `FACT` may ever appear under "Verified facts". The classifier is deliberately
cautious: an unrecognised sentence becomes `UNVERIFIED_SIGNAL`, because over-claiming is
the failure that matters here.

| Type                | Meaning                                          | Rendered as                      |
| ------------------- | ------------------------------------------------ | -------------------------------- |
| `FACT`              | Stated in the source, backed by an evidence span | Verified facts, green rule       |
| `INTERPRETATION`    | A reading of the facts, stated by the source     | "Also stated in the sources"     |
| `HYPOTHESIS`        | A testable proposition we are putting forward    | Interpretation block, amber rule |
| `FORECAST`          | A claim about the future, stated by the source   | Labelled Forecast                |
| `UNVERIFIED_SIGNAL` | Noted, not established                           | Labelled Unverified              |

Ordering matters in the classifier: a sentence about the future is a `FORECAST` even
when it uses a reporting verb. "Announced it will open fifty stores by 2030" is a
forecast about the stores, and presenting it as an accomplished fact would be wrong.

---

## Evidence strength

Derived from source perspective and quantification — never from confidence or from how
precise the wording is.

| Strength                              | When                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `QUANTIFIED_PRIMARY_EVIDENCE`         | Regulator, public institution, academic, or an attested filing, **with** a figure |
| `UNQUANTIFIED_PRIMARY_EVIDENCE`       | The same, without a figure                                                        |
| `MULTIPLE_CREDIBLE_SECONDARY_SOURCES` | Two or more independent outlets (computed at event level)                         |
| `SINGLE_CREDIBLE_SECONDARY_SOURCE`    | One credible independent outlet                                                   |
| `COMPANY_SELF_REPORTING`              | Any first-party perspective                                                       |
| `WEAK_OR_UNVERIFIED_SIGNAL`           | Everything else, including user-provided                                          |

**A company describing itself is `COMPANY_SELF_REPORTING` however precise the numbers
are.** Precision is not independence. Regulatory filings and earnings releases are
first-party but legally accountable, so they are treated as primary evidence — the one
justified exception, and it is keyed on `sourceType`, not on the company's own framing.

---

## Independence is an allow-list

```ts
INDEPENDENT_PERSPECTIVES = [
  INDEPENDENT_BUSINESS_MEDIA,
  INDUSTRY_MEDIA,
  REGULATOR,
  PUBLIC_INSTITUTION,
  RESEARCH_INSTITUTION,
  ACADEMIC_SOURCE,
  LICENSED_PREMIUM,
];
```

Deliberately an allow-list rather than "not first party". A user-submitted page and an
internal document are neither first-party to the subject nor independent verification
of it.

This is not a hypothetical distinction. Defining independence as `!isFirstParty` caused
a real defect: the demo fixture source was `USER_PROVIDED`, so it counted as
corroboration, and a self-reported 18% markdown reduction was promoted to
`INDEPENDENTLY_VALIDATED_IMPACT` — exactly the false confidence the product exists to
prevent. Unit-tested since.

---

## Verification status

| Status                     | Meaning                                   |
| -------------------------- | ----------------------------------------- |
| `SINGLE_SOURCE`            | One source                                |
| `CORROBORATED`             | Reported by more than one source          |
| `PRIMARY_SOURCE_CONFIRMED` | A primary source confirms it              |
| `DISPUTED`                 | Sources conflict — surfaced, never merged |
| `CORRECTED`                | The source issued a correction            |
| `RETRACTED`                | The source withdrew it                    |

Conflicts are shown as conflicts. Merging two figures into an apparent consensus would
be the single most damaging thing this product could do, so `detectContradiction`
compares numeric claims sharing a unit and negation pairs with high overlap, and a
detected conflict marks the event `DISPUTED` and renders both figures.

Verified on live data: the demo pair reporting 18% and ~7% for the same result produced
a visible contradiction rather than an average.

---

## Case maturity — the hype filter

```
DISCONTINUED_OR_REVERSED ← informative, ranks as news
ANNOUNCED → CONCEPT → PILOT → LIMITED_DEPLOYMENT → SCALED_DEPLOYMENT
         → QUANTIFIED_BUSINESS_IMPACT → INDEPENDENTLY_VALIDATED_IMPACT
```

The rules are **asymmetric on purpose**: promotion requires explicit evidence of
deployment scope or a measured outcome; demotion needs only a hint of reversal.

- `INDEPENDENTLY_VALIDATED_IMPACT` requires a quantified outcome **and** an independent
  source. A company cannot validate itself.
- `QUANTIFIED_BUSINESS_IMPACT` is where a self-reported figure stops.
- Scope language decides deployment level. Marketing adjectives decide nothing:
  "a revolutionary, best-in-class partnership… an initial proof of concept in 40 stores"
  classifies as `PILOT`, because the scope is what the source actually states.

Three evaluation invariants and four unit tests hold this in place.

---

## The gate

Nothing reaches a user without passing `assertEvidenceIntegrity`:

```ts
for (const fact of response.verifiedFacts) {
  if (fact.citationIndexes.length === 0) throw new EvidenceIntegrityError(…)
  for (const i of fact.citationIndexes) {
    const citation = response.citations[i]
    if (!citation)                  throw new EvidenceIntegrityError(…)
    if (!citation.evidenceSpanId)   throw new EvidenceIntegrityError(…)
  }
}
```

It **rejects rather than repairs**. Silently stripping the offending citation would hide
the defect; a discarded response surfaces it. The API returns an explicit message
saying the answer failed its evidence check and nothing unverified is shown.

Four layers enforce the same rule, so no single mistake defeats it:

1. **Write time** — a claim and its evidence link are inserted together
2. **Schema** — a Zod refinement rejects a `FACT` with no evidence
3. **Display time** — `assertEvidenceIntegrity` on every Companion response
4. **Continuously** — an integration test and an evaluation invariant count violations
   across the whole database, and a second test confirms every stored quote still
   matches its offsets

Current state: **0 violations across 369 claims.**

---

## Timestamps

Six, never merged:

| Field               | Question                                     |
| ------------------- | -------------------------------------------- |
| `event_at`          | When did it happen?                          |
| `published_at`      | When did the source publish?                 |
| `source_updated_at` | When did the source last change it?          |
| `discovered_at`     | When did we first see it?                    |
| `processed_at`      | When did we last process it?                 |
| `last_verified_at`  | When were the derived claims last confirmed? |

`event_at` is null whenever no source states it. Guessing would be the easy way to make
a timeline look complete and the fastest way to make it wrong. Sorting prefers
`event_at` and falls back to `published_at`, but both are always displayed, and
`formatAbsolute` renders "on 28 August 2026" rather than "recently" — vagueness about
dates is how stale information passes for current.

---

## Corrections propagate

A materially changed re-fetch creates a new version, and if the change looks like a
correction — low similarity, or explicit correction language in the opening — every
claim extracted from the previous version is flagged `needsReview` with the reason
stored. The UI shows a "Needs re-check" badge on the claim and on its evidence page.

Whitespace churn does not trigger this: comparison is on token overlap, not string
equality.

---

## Honest refusal

When retrieval finds nothing relevant enough, the Companion sets
`insufficientEvidence`, returns zero facts, and names what is missing:

> I do not have sufficient verified evidence in the monitored sources to answer this
> reliably. Rather than answer from general knowledge, here is what is missing.

Two mechanisms make that trustworthy rather than a fallback message:

**A relevance floor.** OR-based retrieval is necessary to find anything, but on its own
it matched an NVIDIA earnings release to a question about an unlisted Uzbek textile mill
on the words "revenue" and "quarterly" — and then presented four irrelevant statements
as evidence bearing on the question. A claim must now contain a minimum share of the
query terms. Verified: that question now refuses.

**Mode-aware judgement.** Insufficiency is decided on what a mode actually produced, not
on whether claim retrieval returned rows. _Capture_ needs no evidence; _Brief me_ reads
insights; _Explain it_ and _Teach me_ can answer from a learning unit; _Explore it_ and
_Prepare me_ genuinely need claims; _Challenge me_ may legitimately answer that nothing
contradicts the view — while saying that absence of contradiction is not confirmation.

---

## Coverage honesty

"No results" is never rendered as "nothing happened".

- Empty brief → _"No new events were found in the currently monitored sources."_
- Thin brief → the item count, and an explicit statement that nothing was added to fill
  the time
- Empty company timeline → whether any source is monitored for that company, and a note
  that a thin timeline means limited monitoring rather than an inactive company
- Every insight → a computed known-unknowns list naming the monitored-source count
- Coverage dashboard → a "Known coverage gaps" section listing what is missing

Every one of those is computed from what is actually absent, which is why it can be
trusted: it cannot flatter the data.
