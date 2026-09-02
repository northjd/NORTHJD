# Information Architecture

Six areas, in the order a working day uses them.

```
Today       your finite daily brief
Companion   ask, research, prepare, be challenged
Learn       industry fundamentals and learning paths
Prepare     meeting preparation
Explore     companies, industries, technologies
Library     saved insights, notes, collections, transcripts
```

Plus global search, profile and preferences, and admin for authorised users.

---

## What is deliberately absent from the navigation

There is **no navigation entry for Accenture, for consulting firms, or for any single
company.** Consulting and professional services is a *company category inside Explore*,
reached through the same company pages, the same filters and the same watchlists as
every other company.

The test asserts it: the main navigation must not contain "Accenture", "Consulting" or
"Competitors". If a future change added one, the suite fails.

The reason is structural rather than political. Making one firm an organising principle
would bake it into the information architecture, and every later user — a different firm,
a corporate strategy team — would need a redesign rather than a preference change.
`workspaces.home_firm_entity_id` exists as an optional user preference and nothing in
ranking, ingestion or navigation branches on it.

---

## Today

A finite, personalised brief. Not a feed.

Sections, in display order — each rendered only if it has content:

| Section | Contains |
|---|---|
| The three that matter | Highest combined relevance, impact and evidence strength |
| Changed since your last visit | Only genuinely new, updated or corrected |
| Your companies | Watchlist developments |
| Your industries | Followed-industry signals |
| Technology radar | Vendor and platform activity |
| Broader market | Beyond the user's stated focus |
| **One adjacent signal** | Deliberately outside their interests |
| Learn one thing | A short fundamentals unit |

Then progress and a real caught-up state. **Nothing loads after it.** The user leaves by
choosing Explore or the Companion, not by running out of willpower.

The sidebar carries coverage and composition: how many sources are monitored, how many
await rights review, and how the brief was assembled — including the note that this
reflects monitored sources only and is not a claim about everything that happened.

No fixed quota for any company, firm or category. Ten section types, none
company-specific, asserted by an evaluation case that scans live brief items.

---

## Insight detail

Ordered so trust comes before interpretation:

1. **Verified facts** — verbatim, each linking to its evidence
2. What changed · What is genuinely new
3. Why it matters · Market context *(Depth)*
4. Counter-signals — contradictions and missing confirmation
5. **Consultant perspective, client implications, hypotheses, contrarian angle** — all
   under an interpretation label with a visible amber rule
6. Also stated in the sources — forecasts and interpretations the source made

Sidebar: conversation starters, known unknowns, learning connections, sources with
perspective and dates, copy actions, contextual Companion, reflection feedback.

The visual separation is load-bearing. Facts get a green rule; interpretation gets an
amber rule and an explicit "our interpretation" label. A reader skimming must not be
able to mistake one for the other.

---

## Evidence page

The bottom of the chain: the claim, its exact character range, and that range
highlighted inside the surrounding stored text. Then all six timestamps, the document
version, the storage scope, required attribution, and the rights review note.

One click from any factual statement anywhere in the product.

---

## Companion

Seven modes as a control strip, response length and depth as selects, one input that
accepts text or voice. Answers render facts, interpretation, hypotheses,
counter-evidence and unknowns as separately labelled sections, with numbered citations
linking to evidence.

Reachable from anywhere: the Companion page, a floating button, ⌘K, and contextual
prompts on insights.

---

## Explore

Industries and companies, plus three company groups: Companies, **Consulting &
professional services**, Regulators & institutions — with the hint that consulting firms
are monitored through the same mechanisms and with no ranking advantage.

An industry page is the Market Model made readable: definition, market structure, value
chain with profit-pool notes, business models, KPI tree, regulation, transformation
agenda, current signals, and **open questions** — what the model cannot currently
answer.

A company page is a timeline plus an implementation-maturity mix plus source coverage,
including the note that a thin timeline means limited monitoring rather than an inactive
company.

---

## Learn

Paths, units at three depths, knowledge checks. The sidebar shows knowledge state with
the reason for each value and whether the user set it themselves.

A unit page carries "what changed since" — recent events touching the same concept —
which is the mechanism that keeps fundamentals connected to now.

---

## Prepare

A form, then a brief: 60-second summary, what changed per window, verified facts,
labelled interpretation, five specific questions, contrarian angle, known unknowns,
sources, and the user's own notes kept visibly separate.

---

## Library

Saved insights, notes, meeting briefs, conversation transcripts. Notes are labelled as
the user's own thinking and never citable as evidence.

---

## Admin

Source registry with verbatim rights notes, coverage dashboard naming the gaps,
capability page distinguishing live from fallback from not-configured from
not-implemented, and a live evaluation suite.

The capability page is the honesty surface: it lists what is not built, with reasons.

---

## Cross-cutting

**Trust badges** appear wherever an item does: source perspective, evidence strength,
case maturity, verification status, novelty, generator, demo. Each maps 1:1 to an enum
value; none is decorative.

**Density** is high but calm — 13–15px type, restrained colour, generous whitespace.
Colour is reserved for meaning, so when something is coloured it tells you something.

**Mobile** carries the same six areas in a scrollable strip. No hidden hierarchy, no
reduced feature set.
