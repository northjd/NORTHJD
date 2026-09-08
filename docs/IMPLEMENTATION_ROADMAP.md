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

_Last reviewed 2026-09-07. Items are ordered by what limits the product now._

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

### 2. A keep-alive so the schedule cannot lapse

GitHub disables scheduled workflows on a repository with no activity for 60 days. It does
not error; the cron simply stops and the site freezes at its last build, which is the kind
of failure noticed late. A monthly workflow that touches the repository removes the whole
class.

### 3. Per-language text search

German, Dutch, Danish, Norwegian and Finnish documents are indexed with the `english`
PostgreSQL configuration. Company names match regardless — which is what those sources
were added for — but word endings in those languages do not, so a German query stems
wrongly. Needs a language column on documents and a per-language `tsvector`.

### 4. Extend financial coverage beyond EDGAR

EDGAR is US filers only: 19 of 119 companies, and structurally never Migros, Aldi,
Breuninger, Bestseller or Adyen. National business registers and company investor-relations
feeds are the route to the European names, and they are the ones this practice cares most
about.

Smaller and related: the EDGAR name matcher requires a 0.75 length ratio, which rejects
Amazon ("amazon" against "amazon com"). It fails closed on purpose — six companies were
matched to the wrong filer before that guard existed — but the rule could be smarter
without becoming loose.

### 5. One source for Public Sector

Seventeen of eighteen markets have coverage. Public Sector has none, and the page says so
honestly rather than looking broken. OECD, IMF and the World Bank all refused a feed
request; a national procurement or policy publication is the likelier route.

### 6. Email delivery, if the feed proves too indirect

The Atom feed reaches Outlook, Slack and Teams and stores nothing about anybody. If
colleagues do not adopt it, Buttondown's free tier holds the addresses and handles
unsubscribe, and the existing workflow would POST the digest. That is a deliberate step
into processing personal data and should not be taken until the cheaper option has been
shown to fail.

### Documentation debt

`HANDOVER.md` is dated 2026-09-02 and describes a state three days and several hundred
commits behind. It should be deleted or rewritten; a dated handover that no longer holds
is worse than none.

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
