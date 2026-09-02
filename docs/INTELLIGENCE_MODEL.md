# Intelligence Model

An article is not an insight. This document describes the seven levels between a fetched
document and something worth a consultant's attention, and what each level is for.

---

## The hierarchy

| Level | Table | What it is | Cardinality |
|---|---|---|---|
| **Source** | `sources` | Where information comes from, with a perspective and a rights policy | ~18 |
| **Raw document** | `raw_documents` | One article, filing or post, per canonical URL | ~191 |
| **Document version** | `document_versions` | An immutable snapshot; offsets refer to this | 1..n per document |
| **Evidence span** | `evidence_spans` | An exact character range plus the quote | ~369 |
| **Claim** | `claims` | One checkable statement | ~369 |
| **Event** | `events` | A real-world occurrence, independent of who reported it | ~185 |
| **Signal** | `signals` | An event placed against a larger pattern | 1 per event |
| **Insight** | `insights` | A signal interpreted for one workspace | ~184 |

Then the two links that make an insight more than a summary:

| Level | Table | Dimension |
|---|---|---|
| **Learning connection** | `learning_connections` | Depth — which market-model concept this touches |
| **Conversation application** | `conversation_applications` | Applicability — what to say or ask |

---

## Events before articles

The single most consequential modelling decision. Ten outlets covering one announcement
must become **one event with ten sources**, not ten items in a brief.

Everything downstream depends on it:

- a finite daily brief is only possible if repetition has been collapsed
- corroboration is meaningless without a unit that several sources can agree about
- "what changed" needs a stable identity to compare against
- source counting only means something when the unit is the occurrence

Clustering requires **all three** of:

1. at least one shared entity
2. proximity in time (5 days, or 2 for the multi-entity rule)
3. sufficient text overlap

All three are necessary. Shared entities alone would merge every H&M story of the week.
Text similarity alone would merge two different companies' identically-worded press
releases — both cases are unit-tested.

There is a fourth path, added after observing a real miss: **two shared entities within
two days at lower overlap**. "Meridian and Halden AI announce partnership" and "Halden
AI signs Meridian as anchor customer" share little vocabulary but obviously describe one
deal. Requiring *two* shared entities plus a tight window keeps it from over-merging a
company's busy week.

Clustering is single-link agglomeration, O(n²) on the batch. A run processes tens to low
hundreds of documents, so that is fine and the simplicity is worth more than the
asymptotics.

---

## Claims are sentences, verbatim

A claim's text **is** a sentence from the stored document version, and its evidence span
is that sentence's exact character range. Nothing is paraphrased, so a citation cannot
drift from its source.

This constrains what the pipeline can produce, and that is the point: the strongest
guarantee available is that the claim text and the quoted evidence are the same string.
An integration test verifies that every stored quote still matches the document text at
its offsets — currently across 200 sampled spans, with zero mismatches.

Classification is a lexicon, not a model, and is deliberately cautious. Order matters:
forecast markers are checked before reporting verbs, so "announced it will open fifty
stores by 2030" is a `FORECAST`. An unrecognised sentence becomes `UNVERIFIED_SIGNAL`
rather than `FACT`.

Feed furniture is filtered out. WordPress-style feeds append a syndication footer to
every item, and extracting it produces claims like "The post X appeared first on Y" —
true of the feed, and saying nothing about the world.

---

## Entity resolution, and the failure it guards against

Alias-driven, with an explicit ambiguity flag. The failure this exists to prevent is the
one that quietly ruins a company timeline: "Meta" matching a sentence about metadata,
"Next" matching an adverb, and a company page filling with events that have nothing to
do with the company.

An alias marked `requiresContext` — ordinary words, or anything under four characters
like "EY", "H&M", "TCS" — will not resolve on its own. It needs corroboration:

- an unambiguous alias of the same entity nearby, **or**
- the publishing source's domain matching the entity, **or**
- the entity being the declared subject of a first-party source

A first-party source is always treated as being about its own subject, even when the
newsroom article never spells the company name out in the body.

---

## Signals, and their current limit

A signal is an event placed against a larger pattern, with a direction (`supports` /
`contradicts`), a rationale and a strength.

Being honest about the current state: **trend objects exist in the schema but no curated
trend model has been authored**, so signals record their placement without a trend to
attach to. The structure is right; the content is missing. This is the main thing
limiting "what is gaining or losing momentum", and it is in the next steps.

---

## Insights connect three dimensions

An insight is not a summary. It is required to answer all three North Star questions
about one event:

| Section | Dimension | Source of the text |
|---|---|---|
| What happened | Recency | Top FACT claims, verbatim |
| What changed | Recency | Computed against prior events for the same entity |
| What is genuinely new | Recency | Derived from novelty and maturity — flags a restated announcement as adding nothing |
| Market context | **Depth** | Assembled from the taxonomy: industry, value chain stage, KPIs, capabilities |
| Why it matters | **Depth** | Value levers and operating-model dimensions, with the measurable expression named |
| Client implications | **Applicability** | Templates parameterised by lever and industry |
| Conversation starters | **Applicability** | Templates parameterised by company, maturity, KPI, dimensions |
| Hypotheses | Applicability | Testable propositions with the test named |
| Contrarian angle | Applicability | Sceptical reading, or an honest statement that none is supported |
| Known unknowns | Trust | **Computed from what is absent** |
| Counter-signals | Trust | Contradictions plus missing independent confirmation |

Everything is **assembled, not written**: factual sections reuse claim sentences,
structural sections compose from the data model, applicability sections use
parameterised templates. Less elegant than model prose and considerably harder to make
untrue.

The known-unknowns section is the one to trust most, because it is computed from what is
missing and therefore cannot flatter the data: no independent source, no quantified
outcome, no stated event date, no linked KPI, and always the monitored-source count.

---

## Conversation starters, concretely

The brief is explicit that "what are your biggest challenges?" is a failure. Starters
are parameterised with the actual company, event type, maturity, value levers, KPIs and
operating-model dimensions from *this* event.

For a partnership still at announcement stage:

> The announcement sets out intent rather than deployment. Between decision rights and
> adoption, which is the binding constraint on getting from signed agreement to
> something running in production?

For a self-reported quantified outcome:

> The reported figure is self-reported. How is the baseline defined, over what period,
> and what share is attributable to this initiative rather than to trading conditions?

Specific by construction. If the event has no maturity, no lever and no KPI, the
template degrades to a general question rather than inventing detail.

---

## Consulting intelligence dimensions

Each event is classified against dimensions a consultant actually reasons with: industry,
value chain stage, capability, business value lever, operating-model dimension, likely
executive owner, technology layer, transformation maturity.

All of it is marked `inferred` and rendered under an interpretation affordance, because
none of it is stated in the source. A reader must always be able to tell what the source
said from what we concluded.

One inference is worth calling out because it materially improved Depth coverage:
**industry is inferred from matched KPIs and value chain stages when the text never says
the industry name.** A press release about markdown and sell-through never contains the
word "retail", but "full-price sell-through" and "markdown rate" belong to exactly one
industry in the model. That single change took market context from 10 insights out of
180 to 186 out of 186.

---

## What this model does not do

- **No sentiment scoring.** It would be a number without evidence.
- **No importance model learned from engagement.** Popularity is not impact, and an
  unexplainable ranking is what this product replaces.
- **No entity extraction beyond the seeded set.** A company not in `entities` is not
  resolved. Precision over recall: a wrong resolution corrupts a timeline, a missing
  one only leaves a gap.
- **No cross-lingual clustering.** The schema supports multilingual documents; the
  clustering does not.
- **No causal inference.** "Event affects trend" is a typed edge with a rationale, not a
  causal claim.
