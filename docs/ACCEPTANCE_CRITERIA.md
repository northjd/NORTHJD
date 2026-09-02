# Acceptance Criteria

The 67 criteria from the brief, assessed honestly. **Met** means built, exercised
against real data and — where the criterion is a property rather than a feature —
covered by a test. Where something is partial, the gap is stated rather than rounded up.

**Summary: 60 met · 6 partially met · 1 not met.**

---

## Recency (1–7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | User sees what changed since their last visit | **Met** | `lastVisitAt` read *before* the visit updates it; drives the `what_changed` brief section and a "new since your last visit" ranking reason |
| 2 | Publication date and event date shown separately | **Met** | Six distinct timestamps in `DocumentTimestamps`, never merged. Insight header and evidence page show event / published / discovered / last-verified separately. Unit-tested |
| 3 | Updated or corrected events are detectable | **Met** | Immutable document versions; `detectMaterialChange` distinguishes churn from rewrite; a likely correction flags dependent claims `needsReview` and the UI shows a "Needs re-check" badge |
| 4 | Sources show a freshness status | **Met** | `freshness()` buckets last-success into fresh/recent/ageing/stale/unknown — `unknown` rather than a guess when never synced. Shown per source in admin |
| 5 | The platform names its coverage gaps | **Met** | Coverage dashboard has an explicit "Known coverage gaps" section; every insight's known-unknowns states the monitored-source count; company pages say a thin timeline means limited monitoring |
| 6 | The daily brief is time-bounded and finite | **Met** | `composeBrief` stops at the reading budget; unit-tested that it never exceeds it and never repeats an item |
| 7 | A real "You are caught up" state | **Met** | Brief is composed once per day and stored, so the item set cannot grow while being read. Completion is explicit and **nothing auto-loads after it** |

---

## Depth (8–14)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 8 | At least four industry pages with structured fundamentals | **Met** | Retail, Fashion & Apparel, Consumer Goods, Technology & AI — 25 value chain stages with profit-pool notes, 21 KPIs in a parent/child tree, 13 business models, 17 capabilities, regulation, transformation agenda, open questions |
| 9 | Insights connected to industry concepts | **Met** | 275 learning connections; industry inferred from matched KPIs and value chain stages when the text never says the industry name |
| 10 | Basic learning paths exist | **Met** | 2 paths, 5 units, 91 concepts |
| 11 | Foundation / Executive / Expert distinguishable | **Met** | `depth` on every unit; the fashion path has all three on one subject; Companion respects the requested depth |
| 12 | Current events placed in a larger context | **Met** | Every insight has a market-context section naming industry, value chain stage, KPIs and capabilities — labelled as classification, not source statement |
| 13 | A cautious, transparent knowledge state | **Met** | Six states, a confidence value, a stored human-readable reason, and `userAsserted` which always wins. Visible and correctable in Profile and Learn |
| 14 | Weekly Learning Review at least as a prototype | **Not met** | The inputs exist — knowledge state, learning connections, feedback, review-due dates — but the surface that assembles them was not built. The one criterion in this section that is genuinely absent |

---

## Applicability (15–21)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 15 | Relevant insights carry conversation starters | **Met** | ~1,240 conversation applications; templates parameterised with the actual company, maturity, levers, KPIs and operating-model dimensions — never "what are your biggest challenges?" |
| 16 | A user can generate a meeting brief | **Met** | Prepare workspace; generation runs through the same evidence-checked Companion path as chat |
| 17 | Briefs contain facts, hypotheses and known unknowns | **Met** | All three as separate, differently-labelled sections |
| 18 | Hypotheses clearly separated from facts | **Met** | Different table (`conversation_applications` vs `claims`), different enum, different rendering — `InterpretationBlock` vs `label-evidence` |
| 19 | Executive summaries can be copied | **Met** | Copy buttons on insights, briefs and conversation starters; copied text retains sources |
| 20 | The Companion can turn an event into a specific question | **Met** | Verified: *Prepare me* on the demo retailer produced four specific starters |
| 21 | Challenge Me shows counter-arguments or names missing evidence | **Met** | Verified both paths, including the honest "No contradicting evidence exists — which is not the same as confirmation" |

---

## Companion (22–40)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 22 | User can ask in writing | **Met** | `/companion`, global ⌘K launcher, contextual entry points on insights |
| 23 | Visible page context is used | **Met** | Route-derived context; a question on a company page is entity-scoped, and the answer lists the context objects it used |
| 24 | Current statements carry an as-of date | **Met** | `asOf` is required by the schema; rendered on every answer |
| 25 | Factual claims are navigable to evidence | **Met** | Every citation carries `claimId` and `evidenceSpanId`, linking to the highlighted passage |
| 26 | Facts, interpretations and hypotheses separated | **Met** | Separate fields on `CompanionResponse`, separately labelled in the UI |
| 27 | First-party content is marked | **Met** | `PerspectiveBadge` shows "Company itself" with a tooltip explaining it is not independent confirmation |
| 28 | User can choose short or deep answers | **Met** | Six response lengths, three depths |
| 29 | Brief Me works | **Met** | Verified |
| 30 | Explain It works | **Met** | Verified |
| 31 | Explore It works | **Met** | Verified — cited facts from real feeds |
| 32 | Prepare Me works | **Met** | Verified |
| 33 | Challenge Me works | **Met** | Verified |
| 34 | Teach Me works | **Met** | Verified |
| 35 | Capture and Reflect works | **Met** | Verified; stored as a note, explicitly never citable as evidence |
| 36 | A transcript is available | **Met** | Searchable transcript with the structured answer preserved per turn |
| 37 | Content can be saved from a conversation | **Partially met** | Notes save from Capture mode and insights save from their own page. Saving an arbitrary answer *fragment* directly out of a transcript is not implemented |
| 38 | Voice input works, or is honestly reported unavailable | **Met** | Browser Web Speech API with runtime detection; where absent the UI says so and explains that text uses the same path |
| 39 | Text and voice share the same evidence rules | **Met** | Structurally true: voice is transcribed client-side and enters the *same* endpoint, and speech renders from `response.voice`, derived from the same validated object. There is no second answering path |
| 40 | No invented answer when evidence is insufficient | **Met** | Verified with a deliberately unanswerable question; `insufficientEvidence` set, zero facts, gaps named. Backed by a relevance floor and an integration test |

---

## Accenture and consulting sources (41–50)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 41 | Accenture Newsroom registrable as an optional candidate | **Met** | Registered, `pending_review`, connector off, probe result recorded verbatim |
| 42 | Competitor sources registrable through the same mechanism | **Met** | McKinsey active through exactly the same path; 13 consulting firms seeded as ordinary entities |
| 43 | The platform works fully without those sources | **Met** | Every consulting source could be deleted and nothing would break — the nine other active sources are unrelated |
| 44 | Accenture receives no automatic ranking advantage | **Met** | `WEIGHTS` contains no entity-specific term; `scoreIsEntityNeutral` asserts identical scores when only the entity changes. Unit-tested and in the evaluation suite |
| 45 | No fixed Accenture section in the daily brief | **Met** | Ten section types, none company-specific; an evaluation case scans live brief items for company-specific sections |
| 46 | No fixed consulting quota in the daily brief | **Met** | Same mechanism |
| 47 | First-party consulting content marked as self-reported | **Met** | McKinsey is `FIRST_PARTY_CONSULTING_FIRM`; excluded from `INDEPENDENT_PERSPECTIVES`, so it can never corroborate |
| 48 | Consulting firms followable via the generic mechanisms | **Met** | Same entity table, same watchlists, same company pages |
| 49 | Company comparisons show source set and coverage limitations | **Partially met** | Company pages show source coverage, the implementation-maturity mix and an explicit caveat that counting announcements is not a measure of leadership. A dedicated side-by-side comparison view was not built |
| 50 | No market-leadership claim from announcement counts | **Met** | Stated explicitly on the company page; nothing in ranking or classification derives standing from volume |

---

## Trust (51–58)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 51 | Every factual claim has at least one evidence span | **Met** | **Verified 0 violations** across 369 claims. Enforced at write time, by a Zod refinement, by `assertEvidenceIntegrity` before display, and by three separate tests |
| 52 | Sources navigable to the original document | **Met** | Evidence page links to the original; the quoted range is highlighted in the stored text with surrounding context |
| 53 | Company self-reporting visibly marked | **Met** | `COMPANY_SELF_REPORTING` badge with the explanation that precision is not independence |
| 54 | Announcement distinguished from implementation | **Met** | Eight-stage maturity ladder; promotion requires stated scope or a measured outcome. Four unit tests plus three evaluation invariants |
| 55 | Conflicting sources can be surfaced | **Met** | 3 contradictions detected on live data; event marked `DISPUTED`; shown as a disagreement rather than silently merged |
| 56 | Insufficient evidence communicated openly | **Met** | Every insight has computed known-unknowns; the Companion refuses rather than guesses |
| 57 | Demo data clearly marked | **Met** | `isDemo` propagates source → document → event → insight → citation; `DemoBadge` everywhere |
| 58 | Source perspective visible | **Met** | On insights, evidence pages, company pages and every citation |

---

## Technical (59–67)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 59 | The application runs locally from documented steps | **Met** | Four commands, no Docker, no database install. Documented in the README and verified on a machine that started with no Node.js at all |
| 60 | Migrations and seed data work | **Met** | 82 tables, 31 enums, 215 indexes; idempotent seed; `db:reset` rebuilds from empty |
| 61 | At least one real permitted connector works | **Met** | Ten, verified fetching 191 documents |
| 62 | Missing credentials produce controlled states | **Met** | No key at all was configured throughout; the extractive path ran and the UI reported *Extractive* / *not configured* rather than failing or pretending |
| 63 | Core journeys have end-to-end tests | **Partially met** | 27 Playwright tests × 2 viewports are written and cover every core journey. Last full run was cut short by the `process.cwd()` defect in STATUS; the fix is staged but the green run is not yet on record. Prior desktop run: 20 passed, 7 failed — all failures from the dev-server hydration issue, not the application |
| 64 | Production build, typecheck and tests pass | **Partially met** | Build clean (25 routes), typecheck clean, **94/94** unit and integration tests pass. E2E as above |
| 65 | Works on desktop and mobile | **Partially met** | Responsive throughout, mobile navigation, print styles, PWA manifest. Verified by server-rendered assertions on a Pixel 7 viewport; the interactive mobile assertions share the e2e gap |
| 66 | Admins can inspect source and pipeline status | **Met** | Source registry with verbatim rights notes and connector health, pipeline runs with per-stage records, coverage dashboard, capability page, live evaluation |
| 67 | The first vertical slice works from source to citation to Companion answer | **Met** | Verified end to end on real feed data: NVIDIA/H&M/Retail Dive documents → evidence spans → claims → clustered events → insights → brief items → visible citations → grounded Companion answers |

---

## The honest shortfalls

Six partial and one absent, all for the same two reasons:

**Not built (1):** the Weekly Learning Review surface (#14). Its inputs all exist.

**Not built (2):** a dedicated company comparison view (#49), and saving an arbitrary
answer fragment from a transcript (#37).

**Verification incomplete (3):** #63, #64 and #65 all hinge on one green Playwright run.
The suite exists and covers the journeys; the blocker is the staged `process.cwd()` fix
and the corporate-VPN filesystem restriction described in STATUS, not missing
functionality.

Nothing in this document is marked met on the strength of code existing. Where a
criterion is a property — evidence integrity, ranking neutrality, announcement-vs-impact
— it is asserted by a test that fails if the property stops holding.
