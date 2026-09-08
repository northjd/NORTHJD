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

### Phases 5–7 — Learning, meetings, explore _(partial)_

Four industry market models, two learning paths at three depths, knowledge checks,
knowledge state, meeting briefs, company timelines with maturity mix and coverage
honesty, consulting as an ordinary category.

### Phase 8 — Operations _(partial)_

Source registry, coverage dashboard, capability page, 15 live invariants, 94 tests,
clean production build.

---

## Next

_Last reviewed 2026-09-08. Items are ordered by what limits the product now._

### Delivered since the last review

The previous list here — finish verification, an EDGAR connector, independent business
media, non-English sources — is done. The site is published at
`northjd.github.io/NORTHJD`, rebuilt every three hours by GitHub Actions; the registry is
71 sources across 17 of 18 markets in six languages; 19 companies carry filed financials
from SEC EDGAR; and an Atom feed delivers what changed without storing anything about
anyone.

### 1. ~~Stop serialising the company list into every page~~ — done, and the premise was wrong

`MarketSearchControls` now fetches `palette.json` rather than receiving all 119 companies
as a prop on each of the 138 market and company pages. Audemars Piguet is no longer
embedded in H&M's page.

**Measured A/B on one corpus: 1 MB saved, 0%.** The reasoning for putting this first — that
it would buy headroom before adding sources — was wrong, and the earlier 290 MB → 246 MB
figure quoted for it was the corpus changing between builds rather than the change itself.
119 companies at roughly 50 bytes across 138 pages is about 800 KB, which is what turned
up. The command-palette version of this saved 28 MB because it touched all 831 pages and
carried aliases too; the arithmetic does not transfer.

Kept because it is still correct — a page should not carry a list it does not use — but
it is a tidiness fix, not a capacity one.

**Where the size actually is**, measured on the 247 MB export:

| Area     | Pages | Size   | Per page |
| -------- | ----- | ------ | -------- |
| evidence | 1,064 | 125 MB | 109 KB   |
| account  | 138   | 73 MB  | 391 KB   |
| insights | 158   | 39 MB  | 186 KB   |

Evidence dominates by volume; account pages are the heaviest individually, at more than
three times an evidence page. Next writes each page's RSC payload twice — `index.txt` and
`__next._full.txt`, about 91 KB each on a company page — which is a larger lever than
anything in the page's own markup. Worth investigating before assuming more sources need
more room: at 247 MB of a 1 GB soft limit there is roughly 4× headroom regardless.

### 2. ~~A keep-alive so the schedule cannot lapse~~ — done

GitHub disables scheduled workflows on a repository with no activity for 60 days. It does
not error; the cron simply stops and the site freezes at its last build, which is the kind
of failure noticed late. A monthly workflow that touches the repository removes the whole
class.

### 3. ~~Per-language text search~~ — done

`claims`, `events` and `insights` carry the language of the document they came from, and
their `search_vector` is generated with that language's PostgreSQL configuration rather
than `english`. Queries run through every configuration in use and are OR-ed: a row can
only match the stemming that built it, so German rows are found by the German branch and
English rows by the English one, with no cross-contamination.

Measured before and after on the live corpus: a search for **Handelspraktik** returned
nothing and now returns the claim about _Handelspraktiken_. `Filialen→filial`,
`supermarkten→supermarkt`, `butikker→butik` and `butiker→butik` all unify under their own
configuration and none under `english`.

Two limits, recorded rather than papered over: Snowball's Dutch stemmer leaves
"overnames" whole while reducing "overname" to "overnam", and Finnish consonant gradation
defeats it outright (`kauppa→kaup`, `kaupat→kaupa`). Those are stemmer limitations, not
indexing ones.

### 4. ~~Extend financial coverage beyond EDGAR~~ — done, and the premise was half wrong

**EDGAR was never US-only. We were reading only half of it.** Foreign private issuers
file a 20-F under the `ifrs-full` taxonomy rather than a 10-K under `us-gaap`, and the
script read only `us-gaap`. Stellantis, Nokia, Ericsson, Unilever, Novo Nordisk, British
American Tobacco and Diageo were in EDGAR the whole time, in a shape nothing looked at.

**19 → 32 companies with filed financials**, from three changes:

- **The IFRS taxonomy**, with its own tag names — `Revenue` and
  `ProfitLossFromOperatingActivities` rather than
  `RevenueFromContractWithCustomerExcludingAssessedTax` and `OperatingIncomeLoss` — and
  `20-F`/`40-F` accepted alongside `10-K` as annual report forms.
- **The filing currency, carried and never converted.** These filers report in DKK, SEK,
  GBP, EUR and CHF, and the previous code would have printed €153.51bn with a dollar
  sign. Converting would need an exchange rate, and a rate needs a date the filing does
  not give — the balance-sheet date, the average for the year, today? So Novo Nordisk
  reads DKK 309.06bn and the reader knows they are the one doing the conversion.
- **The newest year across revenue tags, not the first tag with one.** Companies change
  the concept they report under and the old tag keeps its history, which is why NVIDIA
  resolved to a 2022 figure and Kraft Heinz to 2014 — then both were dropped by the
  staleness guard, so the page said "not available" about two of the best-documented
  companies in the corpus. NVIDIA now shows $215.94bn for FY2026.

**The matcher.** The 0.75 length ratio that rejected Amazon ("amazon" against
"amazon com") is still there, but it now operates on better-parsed names and is no longer
the only route. `com`, `adr` and depositary plumbing are dropped; "N.V." and "P.L.C."
arrive as runs of single letters once punctuation is stripped, and are glued back into a
recognised legal form.

The legal form is then treated as **evidence rather than noise** — Metro AG wholesales in
Düsseldorf and METRO INC. grocers in Montreal, and stripping both suffixes without
comparing them handed one the other's accounts. Two forms that disagree mean two
companies. A ticker may confirm a name overlap and never create one; all six historical
mis-attributions are held as regression tests in `tests/unit/edgar-matching.test.ts`.

**What remains genuinely out of reach:** Aldi, Migros, Breuninger, Bestseller and Rewe
file nowhere in the United States, and there is no free, licence-clean, structured
financials API for private or Europe-only-listed companies. Investor-relations feeds
carry press releases, not tagged accounts. Anything else would be estimation, which the
brief forbids.

### 5. ~~One source for Public Sector~~ — done

Seventeen of eighteen markets have coverage. Public Sector has none, and the page says so
honestly rather than looking broken. OECD, IMF and the World Bank all refused a feed
request; a national procurement or policy publication is the likelier route.

### 6. Email delivery, if the feed proves too indirect

The Atom feed reaches Outlook, Slack and Teams and stores nothing about anybody. If
colleagues do not adopt it, Buttondown's free tier holds the addresses and handles
unsubscribe, and the existing workflow would POST the digest. That is a deliberate step
into processing personal data and should not be taken until the cheaper option has been
shown to fail.

### 7. ~~The corpus does not accumulate~~ — done

`data/pglite` is cached between runs under a rolling key, restored before the database
starts and saved after ingestion — before the site builds, deliberately, because
`actions/cache`'s own post step does not run on a failed job and a corpus is worth
keeping whether or not the site built that time.

Three things had to come with it:

- **Two retention ceilings**, or "it accumulates" means "for ever". `npm run db:retain`
  deletes documents past `CORPUS_RETENTION_DAYS` (400) _and_ past
  `CORPUS_MAX_DOCUMENTS` (2,500, oldest first), then any event left with no documents
  behind it, then vacuums and checkpoints. Demo material is exempt. The count is the one
  that binds: a window alone works until the day the feeds get busy and then fails every
  build, which is worse than not accumulating, because a failing build publishes
  nothing.
- **Recovery from a cache that will not open.** `PGLITE_RESET_ON_CORRUPT=1` rebuilds from
  empty and publishes a warning rather than failing the run. Losing the history is bad;
  freezing the published site at its last good build until somebody notices is worse, and
  quieter — the same failure mode the keep-alive exists to prevent.
- **A size budget on the export.** This is the constraint accumulation actually pushes
  on, and the arithmetic is unkind: an evidence page costs ~110 KB to carry a quote
  averaging 284 bytes, because Next writes each RSC payload twice. `build:static` now
  reports size by section and fails above `PAGES_SIZE_BUDGET_MB` (850), warning from 75%.
  Crossing the 1 GB Pages limit silently would fail at the deploy step minutes later with
  a message about artifact size and no hint of the cause.

The market index copy has been corrected a second time. It claimed "events published
since monitoring began" when nothing was kept; it now prints the date of the oldest
document actually held, read from the material it is describing so it cannot drift from
it.

### 8. An evidence page costs 109 KB to carry a 284-byte quote

The new limit, and it is the one that decides how deep the archive can go.

Measured on the 206.5 MB export, by section:

| Area     | Pages | Size     | Per page |
| -------- | ----- | -------- | -------- |
| evidence | 1,123 | 118.9 MB | 109 KB   |
| account  | 138   | 50.9 MB  | 369 KB   |
| insights | 152   | 27.8 MB  | 183 KB   |

Evidence is 58% of the site and the only section that scales one-for-one with the corpus.
One page is six files: `index.html` at 43 KB, `index.txt` and `__next._full.txt` at 22 KB
each and byte-identical to one another, and three smaller RSC fragments. The content
inside is a quote averaging 284 bytes.

At 0.214 MB of published site per document, the 850 MB budget is about 4,000 documents.
That is what fixes `CORPUS_MAX_DOCUMENTS` at 2,500, and therefore how far back the corpus
can reach — which is a limit imposed by page weight, not by anything about the material.

Three routes, roughly in order of how much they buy against how much they risk:

1. **Stop writing the duplicate.** `index.txt` and `__next._full.txt` are identical; one
   of them is 20% of the section. They serve different Next router paths, so this needs
   checking against real client-side navigation rather than assuming.
2. **Prerender evidence pages only for reachable claims.** An evidence page nobody can
   link to is dead weight. The risk is a 404 in the middle of the evidence chain, which
   is the product's central promise, so the reachability rule would have to be exact.
3. **Resolve evidence in the browser** from the `evidence.json` the export already ships
   for Ask, rather than prerendering a page per claim. The largest saving and the largest
   change.

### Documentation debt

~~`HANDOVER.md` is dated 2026-09-02 and several hundred commits behind.~~ Deleted — a
dated handover that no longer holds is worse than none.

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
