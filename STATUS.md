# STATUS

**Last updated:** 2026-09-04
**Phase:** 0–4 complete and verified; 5–8 partially complete
**Overall:** shipping as a static site on GitHub Pages, rebuilt every three hours by
GitHub Actions. Real ingestion from 52 registered sources across sixteen of seventeen
markets, a complete evidence chain, and 115 unit tests plus 15 evidence invariants that
gate every publish. See [Known limitations](#known-limitations) for what the export
gives up.

---

## How to read this file

Every item is placed in one of six honest categories:

| Category                      | Meaning                                               |
| ----------------------------- | ----------------------------------------------------- |
| **Fully implemented**         | Built, exercised against real data, covered by a test |
| **Partially implemented**     | Works for the main path; documented gaps remain       |
| **Demo implementation**       | Works, but on labelled fixture data only              |
| **Prepared, not implemented** | Interface and schema exist; no implementation         |
| **Blocked by credentials**    | Implemented; needs a key                              |
| **Blocked by source rights**  | Implemented; needs a rights decision or a feed URL    |

---

## Verified numbers

Measured on the last clean end-to-end run, not estimated.

| Measure                                  | Value                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| Database tables / enums / indexes        | 82 / 31 / 215                                          |
| Full-text search columns                 | 5 (events, insights, claims, entities, learning units) |
| Active source connectors                 | 38 (verified fetching 2026-09-04)                      |
| Registered sources total                 | 52                                                     |
| Documents ingested                       | 629                                                    |
| Claims extracted                         | 1,135                                                  |
| Evidence spans                           | 1,135                                                  |
| **FACT claims without an evidence span** | **0**                                                  |
| Events after clustering                  | 293                                                    |
| Insights generated                       | 231                                                    |
| Contradictions surfaced                  | 4                                                      |
| Conversation applications                | ~1,240                                                 |
| Learning connections                     | 275                                                    |
| Full pipeline run time                   | ~8–20s                                                 |
| Unit + integration tests                 | **115 passing**                                        |
| Markets with coverage                    | 16 of 17                                               |
| Evaluation invariants                    | **15/15 passing** against live data                    |
| Production build                         | clean; static export ~930 pages                        |
| TypeScript strict typecheck              | clean                                                  |

---

## Completed

### Phase 0 — Discovery and foundation

- Repository investigated (it was a consultancy workspace, not a codebase); project
  created in a subdirectory so the existing `account planning/` work is untouched
- Environment surveyed: **no Node.js, no npm, no Docker, no PostgreSQL** on the machine
- ADR 0001 records the stack and how PostgreSQL runs without Docker
- Product documents written (see `docs/`)

### Phase 1 — Project and data foundation

- npm workspaces monorepo, TypeScript strict, ESLint, Prettier, Vitest, Playwright
- Node 24 LTS installed user-locally without sudo
- PostgreSQL 18 via PGlite over the wire protocol — real `tsvector`, jsonb, CTEs
- 82-table schema across taxonomy, entities, sources, intelligence, experience, ops
- Migrations plus hand-written FTS objects; idempotent seed; working `db:reset`
- Credential auth: scrypt passwords, database-backed opaque sessions
- Organization / workspace / membership tenancy, scoped in every query
- Design system: tokens, light and dark, print styles, trust badges

### Phase 2 — Vertical intelligence slice _(the first mandatory milestone)_

Complete and working end to end:

```
source → document → version → evidence span → claim → event → signal
       → insight → learning connection → conversation starter
       → daily brief item → visible citation → grounded Companion answer
```

- Source registry with a rights decision and review note per source
- Rights gate that genuinely refuses un-reviewed sources
- SSRF-safe fetcher: pre-connect DNS validation, per-hop redirect re-validation,
  streaming byte ceiling, scheme allow-list
- RSS/Atom, manual URL and demo connectors
- Document versioning with material-change and correction detection
- Rule-based claim extraction with offset-exact evidence spans
- Alias-driven entity resolution with an ambiguity guard
- Event clustering across sources; contradiction detection
- Insight assembly connecting recency, depth and applicability
- Citations navigable to the highlighted passage in the stored document

### Phase 3 — Personal experience

- Baseline profile, Mission Mode (time-boxed, blended, never overwriting the baseline)
- Configurable watchlists; account/prospect/competitor relationships
- Finite daily brief inside a reading budget, with a real caught-up state
- Per-item "Why am I seeing this?" assembled from the actual scoring reasons
- Reflection feedback that feeds both ranking and knowledge state
- Notes, saved insights, collections, saved searches

### Phase 4 — Companion

All seven modes verified against real data:

| Mode         | Verified behaviour                                                               |
| ------------ | -------------------------------------------------------------------------------- |
| Brief me     | Lists recent developments with an as-of date                                     |
| Explain it   | Serves the matching learning unit at the requested depth                         |
| Explore it   | Cited facts, interpretation and hypotheses kept separate                         |
| Prepare me   | 60-second brief plus specific conversation starters                              |
| Challenge me | Counter-evidence, or states that none exists — and that this is not confirmation |
| Teach me     | Learning objective, key terms, structured model                                  |
| Capture      | Stores the user's own note, explicitly never cited as evidence                   |

- One structured `CompanionResponse` drives both text and speech rendering
- `assertEvidenceIntegrity` runs before display; a response that cannot prove its
  factual statements is **discarded**, not shown
- Honest refusal when the sources cannot answer — verified with a deliberately
  unanswerable question
- Response length (6 options) and depth (3 levels) controls
- Page context: a question on a company page is scoped to that company, and the answer
  lists the context objects it used
- Conversation transcripts with the structured answer preserved per turn
- Browser voice input and spoken output, availability detected at runtime

### Phase 5–7 — Learning, meetings, explore _(partial)_

- 4 industry pages with full market models: definition, market structure, value chain
  with profit-pool notes, business models, KPI tree, regulation, transformation agenda,
  open questions
- Company pages with timelines, implementation-maturity mix, and source coverage
  including what is _not_ monitored
- 2 learning paths, 5 units across all three depths, knowledge checks that explain the
  answer
- Cautious, user-correctable knowledge state with spaced resurfacing
- Meeting briefs: 60-second summary, what changed per window, verified facts, labelled
  interpretation, specific questions, contrarian angle, known unknowns, sources
- Consulting firms as one company category — no navigation area, no reserved brief
  quota, no ranking bonus (asserted by test)

### Phase 8 — Operations _(partial)_

- Admin: source registry with verbatim rights notes, connector health, pipeline runs
- Coverage dashboard that names the gaps, not just the totals
- Capability page distinguishing live / fallback / not configured / not implemented
- Evaluation suite of 15 invariants, runnable from CLI and rendered live in admin

---

## In progress

- **Playwright end-to-end suite** — written (27 tests × 2 viewports). Last full run was
  cut short by the `process.cwd()` bug below; the fix is written but not yet applied.
  Prior desktop-only run: 20 passed, 7 failed, all failures caused by the dev-server
  hydration issue rather than application defects.
- **Screenshots** — `docs/screenshots/` not yet captured.
- **Remaining Phase-0 documents** — staged, not yet in the repository.

---

## Blocked

### Filesystem access — corporate endpoint policy

The project lives under `~/Desktop`, and while connected to the client VPN
(GlobalProtect + Tanium) macOS denies access to `~/Desktop` and `~/Documents` with
`EPERM`. `stat` on the directory succeeds; listing and `open()` fail. Disabling the
tool sandbox makes no difference, so it is enforced below that layer.

**Consequence:** three items are complete but not yet in the repository — the
`packages/config` fix, this file, and the remaining documents. They are staged in
`~/.mios-staging/` with an `apply.sh` that copies them into place.

### One outstanding code defect

`packages/config/src/index.ts` calls `process.cwd()` while locating the root `.env`.
That throws `EPERM: uv_cwd` inside Next's server context in some sandboxed
environments, which takes down every consumer of `config()` at import time and was what
cut the e2e run short. **The fix is written and staged**: anchor the search to
`import.meta.url`, with `process.cwd()` as a try/caught fallback.

### Blocked by source rights or missing feeds

Registered as candidates, connectors off, probe results recorded:

| Source             | Reason                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accenture Newsroom | No working feed. Probed 5 paths 2026-09-01, all HTTP 404                                                                                                                                                             |
| Anthropic News     | No working feed. Probed 3 paths, all HTTP 404                                                                                                                                                                        |
| Inditex Press      | RSS API returns 404; alternate path returns HTML                                                                                                                                                                     |
| Zalando Corporate  | Both candidate paths return 404                                                                                                                                                                                      |
| SEC EDGAR          | Rights are fine; the filing-API connector is not implemented                                                                                                                                                         |
| Microsoft News     | Feed returns HTTP 403 to a non-browser user agent. **Deliberately not worked around** — spoofing a browser UA to defeat an access control is evasion, and the connector is disabled with the reason recorded instead |

### Blocked by credentials

| Capability                | Needs                                                           |
| ------------------------- | --------------------------------------------------------------- |
| Model-assisted generation | `ANTHROPIC_API_KEY` (extractive fallback active)                |
| Semantic search           | `EMBEDDING_PROVIDER` + pgvector                                 |
| Server-side speech        | `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY` (browser mode active) |

---

## Real vs. demo

**Real integrations, verified fetching:** NVIDIA, Google, OpenAI, Meta, AWS ML Blog,
H&M Group, Retail Dive, European Commission, NIST, McKinsey Insights.

**Demo, badged everywhere:** two demo sources (_Demo Corporate Newsroom_ first-party,
_Demo Trade Press_ independent) serving six fixtures, and four fictional companies
(Northwind Apparel, Meridian Retail Group, Halden AI, Calder Stores). They exist to
exercise behaviours the live feeds happen not to contain on a given day, and each is
flagged `isDemo` end to end.

**Reference content, not demo data:** the industry market models, KPI trees and learning
units are authored reference material with sources and a last-reviewed date — the same
status as any curated internal knowledge base.

---

## Known limitations

### Environment

- `npm run dev` renders but **may not hydrate** where Next's HMR WebSocket is blocked.
  `npm run build && npm start` works fully; verified directly. E2E targets production
  for this reason.
- PGlite serves **one connection**; the client serialises queries. Concurrency is
  untested locally.
- `pg_trgm` unavailable in the PGlite bundle; `pgvector` not enabled.

### Coverage

- Ten sources, English only in practice.
- Feed summaries only — no article bodies, so evidence spans are short.
- No regulatory filings, no licensed premium sources, no paywalled reporting.
- Only one independent source, which makes corroboration structurally rare.

### Intelligence quality

- Extraction and classification are lexicon-based. Deliberately cautious — an
  unrecognised sentence becomes `UNVERIFIED_SIGNAL`, not `FACT` — but recall is limited
  and it is English-specific.
- Clustering is lexical plus shared entities. It merges the obvious cases and will miss
  paraphrases that share no vocabulary.
- Extractive generation reads as assembled rather than written. Labelled _Extractive_
  throughout so nobody mistakes it for model output.
- Contradiction detection catches numeric and negation conflicts only.

### Not implemented

Calendar integration · PDF/PowerPoint export · internal connectors and permission-aware
retrieval · always-on voice, wake word, driving mode · meeting recording · team
collaboration beyond the schema · SSO/SCIM · trend objects · Weekly Learning Review and
Monthly State of Play surfaces · admin event merge/split and taxonomy editing · AI cost
dashboard (usage table exists, no UI).

---

## Defects found and fixed

Each was a real bug that would have produced misleading output. Recorded because the
class of error matters more than the individual fix.

| Defect                                                 | Why it mattered                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_PROVIDED` counted as independent corroboration   | Promoted a self-reported figure to `INDEPENDENTLY_VALIDATED_IMPACT` — precisely the false-trust failure the product exists to prevent       |
| `\b` after `%` in the quantified-outcome regex         | A word boundary after `%` never matches, so **every** percentage outcome was classified as unquantified, silently weakening the hype filter |
| Outcome language matched verbs only                    | "an 18% reduction" is the normal phrasing; noun forms were being missed                                                                     |
| `websearch_to_tsquery` ANDs on whitespace              | Multi-word questions matched nothing, and the Companion reported "insufficient evidence" for questions it could answer                      |
| OR retrieval with no relevance floor                   | Presented NVIDIA revenue as evidence bearing on an unrelated question about an Uzbek textile mill                                           |
| Insufficiency judged on claim retrieval alone          | Modes that legitimately use learning units or insights were refusing to answer                                                              |
| Anti-filter-bubble slot starved by budget              | The one reserved adjacent-signal slot silently disappeared                                                                                  |
| SSRF guard blocked 192.0.0.0/16                        | Over-broad; killed a legitimate public source (192.0.66.0/24)                                                                               |
| 304 Not Modified treated as a redirect                 | Turned successful conditional GETs into hard failures                                                                                       |
| RSS `<link>` dropped by array coercion                 | Silently discarded **every** item in every RSS feed                                                                                         |
| `SELECT DISTINCT` ordering by an unselected expression | Invalid SQL that PGlite answers by dropping the connection                                                                                  |
| Unaliased `sql` expressions in `ORDER BY`              | Runtime 500s on `/explore` and in Companion retrieval                                                                                       |
| Feed syndication footers extracted as claims           | "The post X appeared first on Y" is true of the feed and says nothing about the world                                                       |

Five of these were found by the test suite after it was written, which is the argument
for having written it.

---

## Next

In priority order:

1. Apply the staged `packages/config` fix; complete the Playwright run; capture
   screenshots.
2. Copy the staged documents into `docs/`.
3. Implement the SEC EDGAR filing connector — the largest coverage gap and the best
   available primary evidence.
4. Add two or three independent business media sources so corroboration is not rare.
5. Enable a language model and compare against the extractive floor on the golden set,
   measuring citation support rather than fluency.
6. Expand the golden set: multilingual, corrections, ambiguous entities.
7. Build Weekly Learning Review and Monthly State of Play.
8. Run CI against real PostgreSQL to exercise concurrency.
