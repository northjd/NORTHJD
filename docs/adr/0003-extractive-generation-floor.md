# ADR 0003 — Extractive generation as the floor, not the fallback

- **Status** accepted
- **Date** 2026-09-01

## Context

No model credentials were available in the target environment (`ANTHROPIC_API_KEY`
unset). The brief requires a provider-agnostic AI layer, a controlled fallback, and
transparent status — and it forbids fake functionality.

Three options:

1. Ship a UI that shows where AI output _would_ appear, disabled without a key.
2. Generate plausible-looking text without a model.
3. Make a non-model generation path that is genuinely honest, and treat the model as an
   enhancement.

Option 2 is out — it is exactly the "looks like it works" failure the brief prohibits.
Option 1 would leave the product's central value unexercised and untested: a Companion
that cannot answer proves nothing about whether the evidence chain works.

## Decision

Build an **extractive** generation path as the default, and treat a language model as
an enhancement whose output must pass the same checks.

`getTextProvider()` returns `null` when no model is configured. Callers must handle null
by using the extractive path — never by substituting prose of their own.

The extractive path performs only operations that cannot invent:

| Operation      | Method                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Factual text   | Sentences reused **verbatim** from stored evidence spans                                              |
| Classification | Lexicons and rules — event type, maturity, value levers, executive owner                              |
| Structure      | Assembled from the data model — industry, value chain stage, KPIs, capabilities                       |
| Applicability  | Templates parameterised by the event's actual company, maturity, lever and KPI                        |
| Known unknowns | **Computed from what is absent** — no independent source, no quantified outcome, no stated event date |

Everything it produces is labelled `deterministic_extractive` and rendered as
_Extractive_ in the UI, with an explanation that nothing is paraphrased.

## Rationale

The inversion is the point. In the usual arrangement a model generates and a fallback
degrades; here **the checkable path is the default** and the model is optional.

That has three consequences worth having:

- **The evidence chain gets exercised for real.** Every claim, span, citation and
  integrity check runs on every request, with no credentials. The hard part of the
  product is tested rather than deferred.
- **The floor cannot hallucinate.** Verbatim reuse plus rule-based classification has no
  mechanism for inventing a fact. When a model is added, the comparison is against a
  working baseline rather than against nothing.
- **The honest-status story is real rather than aspirational.** The UI reports
  _Extractive_ because that is what ran, not because a flag is set.

The known-unknowns sections turned out to be the most trustworthy text in the product,
precisely because they are computed from absence and cannot flatter the data.

## Consequences

Good: works with zero credentials; cannot fabricate; deterministic, so it is testable
and the golden set is stable; forces the evidence plumbing to be correct.

Costs, stated plainly:

- **It reads as assembled, not written.** Sentences are stitched rather than composed.
  A consultant will notice. The UI says so.
- **Recall is limited.** Lexicons miss what they do not list, and they are
  English-specific.
- **No synthesis across sources.** It cannot say "these three announcements suggest a
  pattern" — only that they touch the same concept.
- **Conversation starters are templated.** Specific by construction, but a model would
  write better ones.

## Enabling a model

Set `AI_PROVIDER=anthropic` with a key. Model output then goes through:

1. **Tool-use constrained decoding** — the model must call one tool whose input schema
   is the required JSON Schema
2. **Zod validation** — a tool call is a strong hint, not a guarantee
3. **One retry** with the validation errors fed back, instructed _not_ to invent facts
   to satisfy the schema
4. **`assertEvidenceIntegrity`** before display
5. **Fallback to extractive** if any of that fails

Failing closed is the design. A model that cannot produce a validated,
evidence-supported answer must not be allowed to produce an unvalidated one.

## What would change this

If model-assisted generation measurably improves usefulness _without_ loosening citation
support — measured on the golden set, not by reading a few samples — it becomes the
default for prose while the extractive path stays as the fallback and as the test
baseline. The evidence checks do not move either way.
