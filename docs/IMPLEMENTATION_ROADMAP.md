# Implementation Roadmap

What was built, in what order, and what comes next.

---

## Delivered

### Phase 0 — Discovery and foundation
Repository investigated; environment surveyed (no Node, npm, Docker or PostgreSQL);
stack chosen and recorded in ADR 0001; product documentation written.

### Phase 1 — Project and data foundation
Monorepo, toolchain, 82-table schema, migrations, FTS objects, idempotent seed, working
reset, credential auth, tenancy, design system.

### Phase 2 — Vertical intelligence slice
The first mandatory milestone, complete: rights gate, SSRF-safe fetcher, three
connectors, document versioning with correction detection, claim extraction with
offset-exact evidence, entity resolution with an ambiguity guard, event clustering,
contradiction detection, insight assembly, citations navigable to the highlighted
passage, grounded Companion answers.

### Phase 3 — Personal experience
Baseline profile, Mission Mode, watchlists, finite brief with a real caught-up state,
ranking explanations, reflection feedback, library.

### Phase 4 — Companion
Seven modes, one structured response shared by text and voice, evidence gate, honest
refusal, length and depth controls, page context, transcripts, browser voice.

### Phases 5–7 — Learning, meetings, explore *(partial)*
Four industry market models, two learning paths at three depths, knowledge checks,
knowledge state, meeting briefs, company timelines with maturity mix and coverage
honesty, consulting as an ordinary category.

### Phase 8 — Operations *(partial)*
Source registry, coverage dashboard, capability page, 15 live invariants, 94 tests,
clean production build.

---

## Next

### Immediate — finish verification
1. Apply the staged `packages/config` fix (the `process.cwd()` EPERM).
2. One green Playwright run; capture screenshots.
3. Copy the staged documents into `docs/`.

Blocked only by the filesystem restriction described in STATUS, not by missing work.

### Near term — the coverage gap
4. **SEC EDGAR filing connector.** The largest single gap and the best available primary
   evidence: legally attested rather than self-promotional. Rights are already fine;
   EDGAR permits automated access under a declared user agent and rate limit.
5. **Two or three independent business media sources.** With one trade publication,
   corroboration is structurally rare and roughly 70% of documents are first-party. This
   is the fix for the highest-standing product risk.
6. **Language detection per document**, then a non-English source, to make the
   multilingual model mean something.

### Near term — close the honest gaps
7. **Weekly Learning Review.** The one acceptance criterion not met. All inputs exist —
   knowledge state, learning connections, feedback, review-due dates — only the surface
   is missing.
8. **Trend objects.** Signals record their placement without a curated trend to attach
   to, which limits "gaining or losing momentum".
9. **Monthly State of Play** per industry.
10. **Company comparison view** and saving a fragment from a transcript — the two
    partially-met criteria.

### Medium term — quality
11. **Enable a language model and compare** against the extractive floor on the golden
    set, measuring citation support rather than fluency. Keep extractive as the fallback
    and the test baseline.
12. **Expand the golden set:** multilingual, corrections, ambiguous entities, one
    announcement across five sources.
13. **Semantic retrieval.** Enable pgvector, add hybrid retrieval; the interface exists.
    Would address the paraphrase-clustering gap.
14. **Metrics dashboard** for the prepared-but-unmeasured evaluation metrics.

### Medium term — operations
15. Real PostgreSQL in CI, to exercise the concurrency PGlite cannot.
16. Admin event merge/split, entity correction, taxonomy editing, correction workflow.
17. Notification generation — schema and preferences exist, nothing produces them.
18. AI cost dashboard over the existing `ai_usage` table.

### Longer term — enterprise
19. SSO/OIDC with MFA; remove password auth.
20. Permission-aware internal retrieval, and only then internal connectors.
21. Team collaboration: shared notes, comments, curated team briefings, editorial review.
22. Calendar integration; PDF and PowerPoint export.

---

## Deliberately not planned

Infinite scroll · engagement metrics · social features · sentiment scoring ·
trending-by-volume · streak mechanics · autonomous external actions · meeting recording.

Each was considered against the traceability matrix and serves no user outcome the
product is for.

---

## Sequencing logic

The next steps are ordered by **what limits the product now**, which is source coverage
and independence rather than features. A fifth Companion capability adds less than a
second independent source, because independence is what makes corroboration — and
therefore trust — possible at all.

The second ordering principle: close the honestly-declared gaps before adding new
surface. One unmet acceptance criterion and two partial ones are worth more than a new
feature, because they are what the next reader will check.
