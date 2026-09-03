# Port checklist — preview harness → real application

Everything built and verified in the preview harness during the 2 September session,
tracked until it exists in the Next.js app. The preview is throwaway; this list is what
stops its work being thrown away with it.

Last updated after the first commit (`e9f0634`). Status key: **done** = in the app and verified · **porting** = in progress ·
**todo** = still only in the preview.

---

## Design language

| # | Item | Status |
|---|---|---|
| 1 | Grayscale palette, one accent, desaturated semantic colours | **done** |
| 2 | Hairline badges — uppercase, wide tracking, no fills | **done** |
| 3 | Flat surfaces — rules instead of shadows | **done** |
| 4 | Sidebar console shell: sidebar, top bar, main, status bar | **done** |
| 5 | Tracked uppercase micro-labels as the structural device | **done** |
| 6 | Corpus stats demoted from header to status bar | **done** |
| 7 | Numbered list rows (`01`, `02`, …) | **done** |
| 8 | Master–detail | **done differently** — filters carry into the detail page, which shows "3 of 59" with previous/next through the same sequence. Delivers not-losing-your-place without restructuring a server-rendered page into a client one |
| 9 | Larger display type, balanced wrap, generous seams | **todo** |

## Filtering

| # | Item | Status |
|---|---|---|
| 10 | Filter bar as a primary, always-visible surface | **done** |
| 11 | OR within a dimension, AND across dimensions | **done** — verified 184→65→1 |
| 12 | Facet counts computed with that dimension's own selection removed | **done** |
| 13 | Zero-count options shown but dimmed | **done** |
| 14 | Multi-select popovers stay open across picks | **not applicable** — the rail is inline and always open, so nothing closes on a pick |
| 15 | Plain-language `Confidence` filter (measured / deployed / corroborated / announced / reversed) | **done** |
| 16 | `More` overflow for the precise taxonomy | **done differently** — plain-language Confidence leads the rail and the taxonomy sits below it, so nothing is hidden behind a disclosure |
| 17 | Personalised saved views in the sidebar with live counts | **done** |
| 18 | Active filters as removable chips | **done** |
| 19 | Sort: date / impact / evidence / sources / reading time | **done** — in the URL, so a sorted view is shareable |
| 20 | List ↔ table toggle with sortable columns | **not built** — sort covers the need it was for, and a second rendering of the same rows is upkeep without a matching gain |

## Search and coverage

| # | Item | Status |
|---|---|---|
| 21 | Company typeahead inside the filter | **done** — and the facet now includes zero-coverage companies, which was the PMI bug at its source |
| 22 | Alias matching — "Zara" → Inditex, "AWS" → Amazon | **done** |
| 23 | Word-boundary matching for short terms, so "PMI" no longer returns Google via "Deep**Mi**nd" | **done** — 5 tests |
| 24 | Zero-coverage companies listed and selectable | **done** |
| 25 | Coverage check for terms matching no entity: what we have, what we do not, and the three routes that would fix it | **done** — `/coverage` |

## Widening — never return an empty screen

| # | Item | Status |
|---|---|---|
| 26 | Time ladder: 7 → 30 → 90 → 365 → all, reporting the window actually used | **done** |
| 27 | Scope ladder: company → peers → industry → topics → market, reporting the level led with | **done** |
| 28 | Widening notice, so results are never passed off as fresher than they are | **done** |

## My client

| # | Item | Status |
|---|---|---|
| 29 | Account view driven by `user_missions`, falling back to watchlist | **done** — `/account` |
| 30 | Five rings, each stating its own scope and its own kind of empty | **done** |
| 31 | Industry override when an entity is unclassified | **done** |
| 32 | "Compared against", never "competitors" — the taxonomy records a shared industry, not rivalry | **done** |

## Interaction

| # | Item | Status |
|---|---|---|
| 33 | Command palette (⌘K): navigation, companies, topics, confidence filters, coverage check | **done** |
| 34 | Keyboard | **done** — `⌘K` palette, `⌘J` Companion, `j`/`k`/`↑↓` through results, `⏎` opens, `esc` clears |
| 35 | Docked Companion pane with seven modes and voice | partial — `CompanionLauncher` exists |

## Fixed after the first commit

| Item | Status |
|---|---|
| **Companion 500** — `PGLiteSocketServer` defaulted to `maxConnections: 1`, so the API route's connection evicted the page renderer's | **done** |
| Retrieval dropped two-letter acronyms: "AI" never reached the query | **done** — 5 tests |
| Retrieval counted filler ("happening", "latest", "news") as content, refusing answerable questions | **done** |
| Renamed to **NORTH**, with landing page and wordmark | **done** |

## Correctness fixes (not design)

| # | Item | Status |
|---|---|---|
| 36 | Companion coverage gate replacing the per-claim overlap floor | **done** |
| 37 | Refusal names the specific missing words | **done** |
| 38 | `QUESTION_NOISE` extended with imperatives addressed to the assistant | **done** |
| 39 | `formatAbsolute` / `formatRelative` never throw on an invalid or string date | **done** |
| 40 | `Card` forwards `data-evidence` and `style` | **done** |
| 41 | Widening must not apply when no window was requested | **done** |

---

## Deliberately not built, with reasons

- **Article summaries.** Measured: median stored document is 208 characters, longest in a
  40-document sample is 716. There is no long article to summarise. Needs full-text or
  user-provided ingestion first, and should then be extractive, never generative.
  See `UX_DECISIONS.md` §8.
- **Mission editor.** The account view reads `user_missions` but nothing can write one.
- **Adding an entity, alias or source from the UI.** The coverage check names the fix but
  cannot apply it.

## Empty states that explain themselves

Three places now treat "nothing here" as information rather than as failure, because on
this corpus the emptiness usually *is* the finding:

- **Confidence = measured outcomes → 0.** No quantified outcome in the corpus has
  independent corroboration. The page says so, explains that this reflects a source set
  dominated by announcements and self-reporting, and offers the nearest looser filters.
- **Coverage check on an untracked term.** Names the three routes that would change it and
  refuses to answer from general knowledge.
- **My client with no direct coverage.** Widens to peers, industry, topics and finally the
  market, and states which level it is speaking at.
