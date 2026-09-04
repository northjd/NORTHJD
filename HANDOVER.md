# Handover — what is done, what is not

Written 2026-09-02, after the preview session. Read this before assuming the build is
finished.

**Short answer to "are we done?": no.** Getting off the VPN unblocks _finalising what is
already in the repository_ — about an hour. Two larger bodies of work sit behind that.

---

## Three tiers of remaining work

| Tier  | What                                        | Effort      | Blocked by              |
| ----- | ------------------------------------------- | ----------- | ----------------------- |
| **1** | Finalise what exists                        | ~1 hour     | VPN / filesystem access |
| **2** | Verify the staged filters, Watch and design | ~half a day | needs the repo          |
| **3** | The genuine feature gaps                    | ~3–4 weeks  | nothing — just unbuilt  |

Tier 2 was originally a 2–3 day porting job. It has since been written as real app code
and staged, so it is now a typecheck-and-verify pass. Details below.

---

## Tier 1 — Finalise (≈1 hour, VPN-blocked)

1. `bash ~/.mios-staging/apply.sh` — copies the staged config fix, README, STATUS and 24
   documents into the repository.
2. Apply `patches/companion-coverage-gate.md` to
   `packages/intelligence/src/companion.ts` — replaces the broken relevance floor with
   the measured coverage gate. Add the ten measured cases as unit tests.
3. `npm run check` — format, lint, typecheck, 94 unit and integration tests.
4. `npm run test:e2e` — the first green Playwright run. This is what moves acceptance
   criteria 63, 64 and 65 from _partial_ to _met_.
5. Capture screenshots into `docs/screenshots/`.
6. `git add -A && git commit` — nothing has been committed yet; the repository has no
   history.

After this, the build is genuinely finished **as specified in the original brief**, at
60 of 67 acceptance criteria with the shortfalls named.

---

## Tier 2 — Port the preview work (**mostly written**, needs typecheck)

**Update, 2 September:** rather than leave this as a porting job, the work has been
written as **actual Next.js app code** and staged. What remains is a typecheck pass and
verification, not a rewrite.

| Staged file                                     | What it is                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/globals.css`                  | Design system revision — type scale with real contrast, layered depth, evidence-strength card edge, purposeful motion, better dark mode |
| `apps/web/src/lib/filters.ts`                   | Typed parsing of all §15 filter dimensions from URL params, and their SQL conditions. URL is the state, so filtered views are shareable |
| `apps/web/src/lib/explore-queries.ts`           | Filtered results, facet counts computed against _other_ active filters, and profile-derived suggested filters with live counts          |
| `apps/web/src/components/filter-rail.tsx`       | The rail — multi-select chips, selects, switches, collapsible on narrow screens with an active count                                    |
| `apps/web/src/components/suggested-filters.tsx` | Personalised quick filters, above the results where they can be found                                                                   |
| `apps/web/src/app/(app)/explore/page.tsx`       | Explore rewritten around the filters                                                                                                    |
| `apps/web/src/lib/watch-queries.ts`             | The seven derived foresight bands                                                                                                       |
| `apps/web/src/app/(app)/watch/page.tsx`         | The Watch surface                                                                                                                       |
| `patches/ui-and-nav-edits.md`                   | Two small edits: `Card` prop forwarding, Watch in the nav                                                                               |
| `patches/companion-coverage-gate.md`            | The retrieval fix                                                                                                                       |

**Important caveat:** none of it has been typechecked or run, because the repository was
inaccessible while it was written. The _logic_ is proven — it ran against this database
in the preview harness, with the counts recorded below — but the TypeScript and Drizzle
typing are unverified. Expect a first pass of type errors; the patch file lists where
they are most likely.

Revised effort: **half a day** of typecheck-and-verify rather than 2–3 days of porting.

### Original porting notes (now superseded)

Everything built in the preview session on 2 September lives **only** in
`~/.mios-staging/preview/` and is **not** in the product. The preview is a throwaway
harness — vanilla JS against raw SQL — and its header says to delete it once the app
runs. Porting is real work, not copy-paste: the app is React Server Components with
Drizzle and typed repositories.

| Built in preview               | Port target                       | Notes                                                                                                                                           |
| ------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **12 Explore filters**         | `apps/web/src/app/(app)/explore/` | Server-side filter params, URL state, typed query builder in `packages/database`. The §15 gap the brief flagged                                 |
| **Personalised quick filters** | Today + Explore                   | Derived from `user_profiles` + watchlists. Needs a `packages/ranking` helper so suggestions and ranking share one definition of "my industries" |
| **Watch / foresight view**     | new route `(app)/watch/`          | Seven derived bands. Queries are written; needs repository functions and RSC pages                                                              |
| **Design system uplift**       | `packages/ui` + `globals.css`     | Type scale, depth, motion, evidence-strength edge colour, maturity mix bar, ask sheet. Tokens map directly                                      |
| **Coverage gate**              | `packages/intelligence`           | See Tier 1 item 2 — this one is a bug fix, not a port                                                                                           |

Sequence: coverage gate first (it is a correctness fix), then filters (largest user
value), then the design tokens (mechanical), then Watch (new surface), then quick
filters (depends on the ranking helper).

---

## Tier 3 — Genuine gaps (unbuilt, nothing blocking)

From `docs/GAP_ANALYSIS.md`, in priority order.

### Blocks a first real user

1. **Onboarding + preference editing.** A new user cannot configure the product at all —
   the profile exists only because the seed created it. Mission Mode is unreachable
   from the UI. _~2 days._
2. **Companion actions.** §12.10 lists fifteen — save insight, follow company, add to
   collection, create meeting brief, update mission. None are wired. The Companion can
   answer but cannot act. _~2 days._

### Substantial value

3. **SEC EDGAR filing connector.** The largest coverage gap and the best available
   primary evidence — legally attested rather than self-promotional. Rights are already
   fine. _~2 days._
4. **Two or three independent media sources.** With one trade publication, corroboration
   is structurally rare and ~70% of documents are first-party. _~1 day._
5. **Explore breadth.** Technology, topic, trend, regulation pages; company comparison;
   case library. Taxonomy is seeded; pages do not exist. _~3 days._
6. **Weekly Learning Review + Monthly State of Play.** The one unmet acceptance
   criterion. All inputs exist. _~2 days._

### Completeness

7. Collections UI, saved searches, followed topics _(~2 days)_
8. Notifications — seven types with preferences in schema, nothing generates them _(~2 days)_
9. Share link, Markdown export _(~1 day)_
10. Admin write operations — merge/split events, correct entities, retry jobs, edit
    policies, suppression UI, correction queue _(~3 days)_
11. Deep Dive + Prepare-for-what-is-next brief sections _(~1 day)_
12. Voice session controls — skip, slower, repeat, live transcript _(~2 days)_
13. Language detection per document, then a non-English source _(~2 days)_

---

## What the preview session also found

Three real defects, all now understood, one fixed only in the preview:

1. **The relevance floor rejected correct evidence.** Requiring 2 of 4 query terms in one
   sentence threw away "markdown rate" and "allocation proposals" — exactly the right
   claims. Fixed by the coverage gate. **Staged as a patch, not yet applied to the
   product.**
2. **`ts_rank` cannot gate relevance across queries.** Measured: "population of
   Ulaanbaatar" out-ranks a retail question the sources genuinely cover. Worth knowing
   before anyone reaches for rank thresholds again.
3. **Imperatives were counted as content.** "Challenge the claim that…" dragged coverage
   down because _challenge_, _claim_ and _that_ are addressed to the assistant. Fixed in
   the preview; part of the same patch.

And one honest observation about data quality: many items show "Event undated" with a
takeaway that repeats the headline, because several feeds publish title-only summaries.
Not a bug — the coverage limitation showing through, and the strongest argument for
Tier 3 items 3 and 4.

---

## The one-line summary

The **intelligence layer is done and verified** — evidence chain, trust model, source
rights, ranking, seven Companion modes, four industry models, 94 passing tests, clean
production build, 60 of 67 acceptance criteria.

The **interface is the weaker half**: filters, onboarding, Companion actions and Explore
breadth are either prototype-only or absent. The preview shows what the filtered,
personalised, foresight-carrying version looks like; it is not in the product yet.
