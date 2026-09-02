# UX and design decisions — 2 September session

Written after a working session against the live database. Every count below was
measured, not estimated.

---

## 1. Visual language: console, not document

The first design read as a well-typeset report — card lists, generous whitespace, a
centred column, muted greys. Correct, and lifeless. Two rounds of feedback moved it:

**Round one — "more state of the art platform designed".** Restructured into an operator
console: persistent left sidebar, master–detail so the reader never navigates away from
the list, a filter row with its own place in the grid, dense rows, a status bar carrying
system state, keyboard-first (`⌘K`, `⌘J`, `f`, `j`/`k`, `1`–`7`), and a table mode with
sortable columns beside the list mode.

**Round two — "cleaner, more modern, like paulkalkbrenner.net".** The reference is
near-black, grayscale-dominant, high type contrast, generous space at the seams, aligned
columnar data, numbered indices, almost no colour. Transferred as:

| Before | After | Why |
|---|---|---|
| Blue used for nav, selection, links, accents | Grayscale ramp; one accent (near-white on dark) used only for the active state | Colour that appears everywhere means nothing. Now a coloured element on screen always carries information |
| Filled badge pills | Hairline outlines, uppercase, wide tracking | Fewer boxes. The rule does the work the fill was doing |
| Card borders and shadows | 1px rules and spacing | The single biggest shift: containers removed, structure kept |
| Gradient logo mark | Flat square | A gradient mark is the most template-looking element on any page |
| `letter-spacing: .09em` labels | `.17em`–`.2em` | Tracked uppercase micro-labels become the structural device, as in the reference |
| 22px page titles | 27px, `-.028em`, balanced wrap | Real contrast against 13px body |
| Unnumbered rows | `01`, `02`, `03` … | Orientation in a long list, and the anchor for `j`/`k`. Lifted directly from the reference's `01/08` pagination |

Semantic colours (evidence strength, maturity) survive but desaturated hard — they are
the only place colour is allowed to mean something.

---

## 2. Filters are the primary surface; corpus size is not

**Feedback:** *"this view on how many documents you checked I would make this much less
prominent. The content filter and so on should be much more the key view."*

Right, and it exposed a real gap: the console had saved views in the sidebar but no
filter surface at all.

- The filter row now has **its own row in the CSS grid**, always visible, above the
  results. It is the first thing on the page after the breadcrumb.
- Corpus statistics moved to the **footer**, in `--fg-3`, first to be hidden as the
  window narrows. Two verbose header chips collapsed into one health dot.
- On the Sources page the numbers are kept but framed: *"Corpus size is here rather than
  on the reading surfaces: it describes our monitoring, not the market."*

### Filter semantics

Values **OR** within a dimension, dimensions **AND** together. Verified live:

| Selection | Results |
|---|---|
| none | 184 |
| Maturity: Pilot | 8 |
| Maturity: Pilot **or** Scaled | 15 |
| … **and** Corroborated | 4 |
| cleared | 184 |

Every option carries a count computed with **that dimension's own selection removed**, so
the number tells you what adding it would give you. Zero-count options stay visible but
dimmed — a dead end you can see beats one you discover by clicking. Multi-select popovers
stay open across picks; single-select ones close.

---

## 3. Maturity and evidence: keep, but stop speaking taxonomy

**Feedback:** *"maturity and evidence, not sure if we need to also have this in the
filter."*

These are the two filters that make this product different from a news reader —
"measured outcomes, not announcements" is the entire pitch. Removing them would remove
the point. But as raw vocabulary they are jargon, and twelve dropdowns crowded the bar.

Resolution: **one plain-language `Confidence` filter in front, the precise taxonomy behind
`More`.** Nothing is lost; the primary row went from twelve controls to six.

| Confidence option | Expands to | Live count |
|---|---|---|
| Measured outcomes | quantified/validated maturity **and** independent source | **0** |
| Actually deployed | scaled/limited/quantified/validated | 10 |
| Independently reported | independent source present | 53 |
| Announcements only | announced/concept | 165 |
| Reversals | discontinued or reversed | 1 |

**"Measured outcomes: 0" is the most useful number in the product.** Both quantified-impact
events in the corpus are self-reported only. The maturity and evidence models exist to
surface exactly that, and it is the strongest argument for the independent-source gap.

---

## 4. Company search: aliases, and a bug worth recording

**Feedback:** *"if I go on consumer goods you have a sub set of companies but if I want to
see news on PMI I can't select it — we need a field where we can type the company."*

Three changes:

1. **A search field inside the popover**, matching name, legal name, slug and
   `entity_aliases`. "Zara" now resolves to Inditex; "AWS" to Amazon; "Mi" to Microsoft.
2. **All 36 entities are selectable, including the 22 with no coverage.** A company you
   cannot select is a question you cannot ask; a company you select and find empty is an
   answer. The popover says so.
3. **A coverage check** for terms that match nothing — see §5.

### The DeepMind bug

The first implementation matched `%term%`. Searching **"PMI" returned Google** — because
"Deep**Mi**nd" contains the substring, case-insensitively. A client's short name returning
Google is the kind of defect that ends a demo.

Fixed by anchoring short terms (≤4 characters) to the **start of a word** rather than
matching anywhere, with longer terms keeping substring matching:

| Query | Before | After |
|---|---|---|
| `PMI` | Google (via DeepMind) | no match — correct, untracked |
| `Mi` | Google | Microsoft |
| `amaz` | Amazon | Amazon |
| `Zara` | Inditex | Inditex |
| `morris` | — | no match — confirms PMI is genuinely absent |

An intermediate version anchored **both** ends, which broke `amaz` → Amazon. Start-anchoring
is strictly better. The regex is escaped in JavaScript and passed as a bound parameter:
building it inside SQL produced `invalid regular expression: brackets [] not balanced`,
which is what escaping through two layers of string quoting does.

---

## 5. Coverage check: a gap that names its own remedy

Searching a term with no tracked entity used to give an empty list. It now gives an
answer: matching entities, events mentioning the term, claims mentioning the term, and
three concrete routes to fix it — register the company and its newsroom, add an alias, or
ingest a single URL.

Measured for the user's own example:

| Term | Entities | Events | Claims |
|---|---|---|---|
| `PMI` | 0 | 0 | 0 |
| `iqos` | 0 | 0 | 0 |
| `markdown` | 0 | 2 | 3 |

So the honest state is: **Philip Morris International is not a tracked entity, and no
monitored source mentions IQOS.** The remedy is a source, not a better query. The view
closes by refusing the alternative explicitly: *"It will not answer from general
knowledge. A plausible paragraph assembled from memory would be indistinguishable, on
screen, from a sourced one — and that is the failure this product exists to avoid."*

---

## 6. Progressive time widening

**Feedback:** *"if there is no news today at least do a search on the past week and if
nothing then also the past month."*

Implemented as a ladder — 1 day → 7 → 30 → 90 → 365 → all time — that stops at the first
window with results and **reports which window it used**. The list header says
*"nothing in 24 hours — showing 7 days"* in warning colour, so results are never passed
off as fresher than they are.

| Asked | Used | Widened | Results |
|---|---|---|---|
| all | all | no | 184 |
| 1 day | 7 days | yes | 80 |
| 7 days | 7 days | no | 80 |
| 30 days | 30 days | no | 156 |
| 1 day + reversals only | 30 days | yes | 1 |

That last row is the behaviour worth having: a narrow filter over a rare category walks
the ladder until it finds the one thing that exists.

**One bug caught here:** the first version widened even when no timeframe was requested,
so the default view silently became "last 1 day, then widen" — 80 items instead of 184, a
filter nobody selected. Widening now requires an explicit window.

---

## 7. My client — three rings

**Feedback:** *"would it not also be an idea to have a section relevant to my client? If I
am at PMI and want to see news relevant to the client and its industry."*

Yes, and the schema already anticipated it: `user_missions` carries name, description,
`industry_slugs`, `topic_slugs`, `technology_slugs`, `entity_ids` and a date range. That
is the brief's Mission Mode, modelled but never surfaced.

A new area, `My client`, second in Practice — where a consultant on an engagement starts.
Three rings:

| Ring | Content | Live for H&M Group |
|---|---|---|
| 1 | Events on the client itself | 9 |
| 2 | The client's industry, **with the client's own events removed** so it reads as context | 20 |
| 3 | Companies sharing the client's primary industry | 8 |

Ring 3 is labelled **"compared against"**, not "competitors". The taxonomy records a
shared industry; inferring rivalry from that would be a claim the data does not support.

Where a ring is empty the view says which kind of empty it is — *"no source is registered
for them, so this silence is about our monitoring, not about the company. The fix is a
source, not a better query."* Four generated questions sit at the bottom, wired to the
Companion.

**No client is hard-coded.** The account comes from a configured mission, falling back to
the watchlist, falling back to the user picking. With no mission configured the view says
so and names the missing editor.

---

## 8. Article summaries: right idea, wrong order

**Question:** *"if there is an article often it's very long — can we include a create
summary option to get the highlights? Or is this too complicated and not bringing value?"*

Not too complicated. Genuinely valuable. **But it has no input today**, and I would rather
say that than ship a button that produces nothing useful.

Measured across 40 documents, stored text length in characters:

| min | p25 | median | p75 | max |
|---|---|---|---|---|
| 63 | 148 | **208** | 491 | **716** |

Nothing over 2,000 characters. Nothing over 4,000. **There is no long article to
summarise** — the corpus is RSS feed summaries, stored as excerpts under each source's
rights policy, averaging 2.1 evidenced claims per document. A summariser over a
208-character document would restate the headline, which the takeaway field already does.

Two things must land first, in this order:

1. **Full-text ingestion where rights allow**, or **user-provided documents** — paste a
   long article or client report and have it extracted and evidenced like any other
   source. The second is rights-clean, needs no publisher negotiation, and is where a
   consultant's long documents actually come from. It is the higher-value path.
2. **Then extractive summarisation, never generative paraphrase.** Select the most
   informative *verbatim* sentences with their character offsets, ranked by figures,
   dates, named entities and outcome language. Nothing rewritten, so nothing can be
   introduced that the document did not say.

The machinery for step 2 already exists — offset-preserving sentence splitting,
quantified-outcome detection, boilerplate filtering, the evidence-span model. It is
roughly a day's work **once there is text worth summarising**. Building it now would be a
feature with no input, which the brief names as fake functionality.

`/api/passages` is implemented and returns the verbatim spans with offsets, so the data
path is proven. It currently reports `no_stored_text` for most documents, which is the
honest answer.

---

## Still unbuilt after this session

- Mission editor — a user cannot configure an engagement; the view falls back to the watchlist
- Adding an entity, alias or source from the UI (the coverage check names the fix but cannot apply it)
- Full-text or user-provided document ingestion, and therefore summaries
- Companion actions (§12.10, fifteen of them, none wired)
- Everything else in `HANDOVER.md` Tier 3
