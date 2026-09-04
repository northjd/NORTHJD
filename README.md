# NORTH

**Know what changed. Understand what matters. Be ready for what's next.**

### → **[northjd.github.io/NORTHJD](https://northjd.github.io/NORTHJD/)**

The live site. No sign-in, nothing to install — open it and it works. It rebuilds itself
every three hours on GitHub's machines, so it is current whether or not anyone's laptop
is open.

An evidence-grounded market intelligence, learning and conversation platform for
consultants. Not a news app: the unit of intelligence is the real-world _event_, every
factual statement traces to a quoted passage in a stored source document, and the daily
brief is finite — it ends, and says so.

Your answers during set-up stay in your own browser, and the brief is ranked there from
them. Nothing you choose is sent anywhere.

> The most relevant changes in the world, translated into my personal market
> understanding, my industries, my accounts and my next conversations.

---

## Contents

- [What it does](#what-it-does)
- [Key user journeys](#key-user-journeys)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running it](#running-it)
- [Tests](#tests)
- [Seed and demo data](#seed-and-demo-data)
- [Real source integrations](#real-source-integrations)
- [Demo-only functionality](#demo-only-functionality)
- [Known limitations](#known-limitations)
- [Security notes](#security-notes)
- [Source rights notes](#source-rights-notes)
- [Voice configuration](#voice-configuration)
- [Next recommended steps](#next-recommended-steps)

---

## What it does

Three connected layers:

| Layer                          | Answers                                                                                                   | Horizon          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------- |
| **Market Pulse**               | What is new? What changed? What is corroborated or corrected?                                             | days             |
| **Market Model**               | How does this industry work — value chain, business models, profit pools, KPIs, capabilities, regulation? | years            |
| **Conversation & Application** | What does this mean for a client? Which hypothesis? Which question? What is the counter-position?         | the next meeting |

The layers are linked in the data model, not just the UI. An event points at the market
model elements it touches, and that link is what produces client implications,
conversation starters, learning connections and meeting briefs.

### The chain that makes it trustworthy

```
source → raw document → document version → evidence span
       → claim → event → signal → insight
       → learning connection → conversation application → briefing
```

Every derived row keeps a path back to a character range in a stored document. The UI
can answer "how do you know that?" at every level, and a factual claim without an
evidence span cannot be written — enforced in the pipeline and asserted by tests.

### Distinctions the product refuses to collapse

- **When it happened** vs. **when it was published** vs. **when we found it** — six
  separate timestamps, never merged.
- **First-party** vs. **independent** — a company describing itself is a legitimate
  source but not corroboration. User-submitted and internal documents count as
  neither.
- **Announced** → **pilot** → **deployed** → **scaled** → **quantified impact** →
  **independently validated** — promotion requires stated scope or a measured outcome;
  demotion needs only a hint of reversal.
- **Fact** vs. **interpretation** vs. **hypothesis** vs. **forecast** — different
  labels, different rendering, and only an evidenced FACT appears under "Verified
  facts".

---

## Key user journeys

1. **Today** — a finite daily brief inside your reading budget, ending in a real "You
   are caught up" state that loads nothing further. Every item can explain why it was
   selected.
2. **Insight → evidence** — from a headline to the exact quoted sentence in the source,
   with publication date, event date, source perspective and evidence strength.
3. **Companion** — ask in seven modes (Brief me, Explain it, Explore it, Prepare me,
   Challenge me, Teach me, Capture). Answers separate verified facts from
   interpretation, cite claim-level evidence, and say plainly when the sources cannot
   answer.
4. **Explore** — company timelines and industry market models. Consulting firms appear
   as one company category among several, through the same mechanisms and with no
   ranking advantage.
5. **Learn** — industry fundamentals at Foundation / Executive / Expert depth, with
   knowledge checks and a cautious, user-correctable knowledge state.
6. **Prepare** — a meeting brief with a 60-second summary, what changed, verified
   facts, labelled hypotheses, five specific questions, a contrarian angle and known
   unknowns.
7. **Admin** — source registry with rights decisions, coverage dashboard naming the
   gaps, capability status, and an evaluation suite that runs live.

---

## Technology stack

- **TypeScript** (strict), **Node.js 24 LTS**
- **Next.js 16** App Router, **React 19**, **Tailwind CSS 4**
- **PostgreSQL 18** with **Drizzle ORM 0.45** and SQL migrations
- **PostgreSQL full-text search** (`tsvector`, GIN, `ts_rank`)
- **Zod 4** at every boundary — HTTP, connector output, model output
- **Vitest 4** (unit + integration), **Playwright 1.62** (end-to-end)
- **npm workspaces** monorepo

Provider-agnostic interfaces for LLM, embeddings, speech-to-text and text-to-speech.
No vendor SDK is imported outside `packages/ai`.

See [`docs/adr/0001-stack-and-local-database.md`](docs/adr/0001-stack-and-local-database.md)
for why PostgreSQL runs the way it does locally.

### Layout

```
apps/web              Next.js app (UI + API routes)
apps/worker           pipeline CLI
packages/domain       types, enums, Zod schemas, evidence guards (no I/O)
packages/database     Drizzle schema, migrations, seed, auth primitives
packages/connectors   SSRF-safe fetcher, rights gate, RSS/Atom, manual URL, demo
packages/intelligence extraction → classification → clustering → insights → Companion
packages/ai           provider-agnostic model access + honest capability reporting
packages/search       query parsing, FTS helpers, semantic interface (not wired)
packages/ranking      scoring and finite brief composition
packages/learning     knowledge-state transitions and spaced resurfacing
packages/evaluation   invariants checked against the live database
packages/ui           design system and trust badges
packages/config       env loading, validation, capability status
docs/                 product and architecture documentation, ADRs, screenshots
tests/                unit, integration, end-to-end
```

---

## Prerequisites

- **Node.js ≥ 22** (24 LTS recommended)
- **No database installation required.** Local development runs real PostgreSQL 18 via
  PGlite; see [Database setup](#database-setup).
- macOS, Linux or WSL2

This machine had no Node.js, so it was installed to a user-local prefix without sudo:

```bash
curl -fL -o /tmp/node.tar.xz https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.xz
mkdir -p ~/.local && tar -xf /tmp/node.tar.xz -C ~/.local
```

`. ./scripts/env.sh` puts it on `PATH` for the current shell. If you have Node from
nvm, Homebrew or Volta, ignore that script.

---

## Installation

```bash
npm install
cp .env.example .env
```

Generate a session secret (required for `npm start`, optional for `npm run dev`):

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(48).toString('base64'))" >> .env
```

---

## Environment variables

Full documentation with defaults is in [`.env.example`](.env.example). Everything has a
safe default or a documented "not configured" behaviour: the app boots, the pipeline
runs, and unavailable capabilities are reported as unavailable rather than faked.

| Variable                       | Default         | Notes                                                |
| ------------------------------ | --------------- | ---------------------------------------------------- |
| `DATABASE_URL`                 | local PGlite    | Point at managed PostgreSQL for production           |
| `SESSION_SECRET`               | —               | **Required in production**, ≥32 chars                |
| `AI_PROVIDER`                  | `deterministic` | `deterministic` \| `anthropic`                       |
| `ANTHROPIC_API_KEY`            | —               | Only needed for `AI_PROVIDER=anthropic`              |
| `STT_PROVIDER`                 | `browser`       | On-device transcription; no audio reaches the server |
| `TTS_PROVIDER`                 | `browser`       | On-device speech synthesis                           |
| `INGEST_ENABLED`               | `true`          | Global kill switch for outbound fetching             |
| `INGEST_REQUIRE_RIGHTS_REVIEW` | `true`          | **Leave on.** Refuses un-reviewed sources            |
| `VOICE_PERSIST_AUDIO`          | `false`         | Audio is not stored by default                       |
| `DATABASE_POOL_MAX`            | `1`             | Raise above 1 for real PostgreSQL                    |

The root `.env` is found by `packages/config` regardless of which directory a process
was started from, so there is one file rather than one per app.

---

## Database setup

Local development uses [PGlite](https://pglite.dev) — genuine PostgreSQL 18 compiled to
WASM — fronted by a socket server that speaks the PostgreSQL wire protocol. `pg`,
Drizzle, drizzle-kit, the worker and Playwright all connect with an ordinary
`postgres://` URL and cannot tell the difference. No Docker, no installation, no sudo.

```bash
npm run db:up        # start the server (leave running in its own terminal)
npm run db:migrate   # apply migrations, then the FTS objects
npm run db:seed      # taxonomy, learning content, entities, source registry, demo user
```

To rebuild from empty (**stop `db:up` first** — it holds the data directory open):

```bash
npm run db:reset
```

Production: set `DATABASE_URL` to a managed PostgreSQL, raise `DATABASE_POOL_MAX`, and
run `npm run db:migrate`. Nothing in the application changes. **PGlite is not a
production database** — it serves a single connection.

---

## Running it

```bash
npm run db:up        # terminal 1 — database
npm run pipeline     # terminal 2 — fetch sources and build intelligence
npm run dev          # terminal 2 — app on http://localhost:3000
```

Sign in with the seeded account printed by `npm run db:seed`
(`demo@market-intelligence-os.local`). Change it before exposing the app anywhere.

### Worker commands

```bash
npm run pipeline                      # full run: ingest → claims → events → insights
npm run pipeline -- --ingest-only     # fetch and extract, no insight generation
npm run pipeline -- --rebuild         # regenerate insights from stored events
npm run pipeline -- --source=<slug>   # one source only
npm run pipeline -- --url=<url>       # ingest a single URL via the manual connector
npm run eval                          # run the evaluation suite from the CLI
```

A run against the seeded registry takes roughly 8–20 seconds and reports what it
fetched, what it skipped, and which sources it refused along with the reason.

---

## Tests

```bash
npm run check      # format + lint + typecheck + unit and integration tests
npm test           # Vitest: unit and integration
npm run test:e2e   # Playwright: desktop and mobile
```

Unit tests need nothing. Integration tests use the live local database and skip
themselves with a clear message if it is not running. End-to-end tests build and start
the **production** server — see [Known limitations](#known-limitations) for why.

---

## Seed and demo data

`npm run db:seed` loads **reference content**, not fabricated events:

- 4 industries with full market models — Retail, Fashion & Apparel, Consumer Goods,
  Technology & AI — comprising 25 value chain stages, 21 KPIs (with parent/child
  relationships), 13 business models and 17 capabilities
- 14 topics, 8 technologies, 11 geographies, 91 learning concepts
- 2 learning paths with 5 units across all three depth levels, including knowledge
  checks
- 36 entities with 99 aliases — companies, consulting firms, institutions, and four
  fictional demo companies
- 18 registered sources with a rights decision and review note each
- One demo user, profile, notification preferences and starter watchlist

Events, claims and insights come from the pipeline, from real feeds and from the
labelled demo fixtures. The seed fabricates none of them.

---

## Real source integrations

Ten publisher feeds are active and verified working. Each was probed, its
`robots.txt` retrieved and checked, and the review recorded in the database:

| Source                             | Perspective                 |
| ---------------------------------- | --------------------------- |
| NVIDIA Newsroom                    | First-party vendor          |
| Google — The Keyword               | First-party vendor          |
| OpenAI News                        | First-party vendor          |
| Meta Newsroom                      | First-party vendor          |
| AWS Machine Learning Blog          | First-party vendor          |
| H&M Group News                     | First-party company         |
| Retail Dive                        | Trade press (independent)   |
| European Commission — Press Corner | Regulator                   |
| NIST News                          | Public institution          |
| McKinsey Insights                  | First-party consulting firm |

The mix is deliberate: without an independent source, nothing can ever be corroborated,
and the platform would only be able to repeat what companies say about themselves.

Also implemented: **manual URL ingestion** (a single user-submitted page, no crawling)
and a **demo fixture connector**.

---

## Demo-only functionality

Clearly labelled everywhere it appears, with a **Demo data** badge on every derived
event, insight and citation:

- Two demo sources — _Demo Corporate Newsroom_ (first-party) and _Demo Trade Press_
  (independent) — serving six fixture documents
- Four fictional companies: Northwind Apparel, Meridian Retail Group, Halden AI, Calder
  Stores

They exist so the harder behaviours can be demonstrated deterministically and offline:
a self-reported quantified claim that must **not** be promoted to "independently
validated"; one event reported by two sources; two sources giving different figures for
the same result; marketing language around what is only a pilot; and a discontinued
programme.

---

## Known limitations

Stated plainly rather than buried.

**Environment**

- `npm run dev` renders correctly but **client components may not hydrate** where
  Next's HMR WebSocket upgrade is blocked (corporate proxies, some sandboxes). The
  symptom is that pages look right but buttons do nothing. `npm run build && npm start`
  has no HMR and works fully; the e2e suite targets it for that reason.
- PGlite serves **one connection**. `DATABASE_POOL_MAX` defaults to 1 and the client
  serialises queries. Concurrency is not exercised locally.
- `pg_trgm` is not in the PGlite bundle, so fuzzy matching is application-side.
  `pgvector` is not enabled.

**Coverage**

- Ten sources, English only in practice despite multilingual support in the model.
- Feed sources give the publisher's own summary, not the article body, so evidence
  spans are short.
- No regulatory filings: SEC EDGAR is registered but the filing-API connector is not
  implemented. This is the highest-value gap.
- No licensed premium sources; paywalled reporting is entirely absent.
- Several first-party newsrooms publish no discoverable feed (Accenture, Anthropic,
  Inditex, Zalando) and are registered as candidates only.

**Not implemented** — interfaces exist, implementations do not

- Semantic search and embeddings
- Calendar integration; PDF and PowerPoint export
- Internal/authorised source connectors, permission-aware internal retrieval
- Always-on real-time voice, wake word, driving mode, meeting recording
- Team collaboration beyond the schema foundation (shared notes, comments, editorial
  review, SSO, SCIM)
- Trend objects: signals record their placement, but no curated trend model exists yet

**Generation quality**

With no `ANTHROPIC_API_KEY`, generation is **extractive**: sentences are reused verbatim
from stored evidence, classifications come from rules, and structural sections are
assembled from the data model. Nothing is paraphrased or invented. It is honest and
useful but reads as assembled rather than written, and the UI labels it _Extractive_
throughout. Setting `AI_PROVIDER=anthropic` with a key routes generation through a model
whose output is schema-validated and evidence-checked before display; anything that
fails those checks is discarded rather than shown.

---

## Security notes

- **Tenancy**: every user-owned row carries `workspace_id` and every repository query is
  workspace-scoped.
- **Passwords**: scrypt (N=32768, r=8, p=1) with per-password salt; parameters stored in
  the hash so they can be raised later.
- **Sessions**: random 32-byte opaque tokens in HttpOnly, SameSite=Lax cookies; only the
  SHA-256 is stored, so a database disclosure yields no usable sessions. Database-backed
  so they can be revoked.
- **SSRF**: all outbound ingestion goes through one fetcher that resolves DNS before
  connecting, checks every resolved address against private, loopback, link-local and
  carrier-grade-NAT ranges, re-validates the host on every redirect hop, enforces a byte
  ceiling while streaming, and allows only http/https.
- **Prompt injection**: ingested content is treated strictly as data. It is wrapped in an
  untrusted-content envelope before reaching a model, and — more importantly — model
  output is schema-validated and evidence-checked, so a successful injection still
  cannot fabricate a citation.
- **Headers**: CSP, `X-Frame-Options: DENY`, `nosniff`, restrictive `Permissions-Policy`.
- **Audit**: append-only `audit_log` for admin changes and sensitive actions.
- **No secrets in the repository.** `.env` is gitignored; `.env.example` documents every
  variable.
- **No confidential data.** This deployment uses public sources, labelled demo data and
  user-provided non-sensitive content only. The Companion carries a standing warning
  against entering client-confidential information.

---

## Source rights notes

Publicly reachable is **not** permission to ingest, store or redistribute. Each source
carries a policy row and the fetcher refuses anything that has not passed review — with
`INGEST_REQUIRE_RIGHTS_REVIEW=true` (the default), a missing or pending policy means the
source does not run.

The review basis for every approved source:

- it is a publisher-operated RSS/Atom feed, i.e. content deliberately made
  machine-readable for syndication
- its host's `robots.txt` was retrieved and contains no rule disallowing the feed path
- only what the feed returns is stored — **the article link is never followed**
- attribution and a link to the original appear on every derived item

Anything beyond that — full article text, paywalled material, licensed feeds — requires
a separate licence and is not enabled. No access control, paywall or bot-detection
mechanism is bypassed anywhere in the codebase, and the storage scope recorded in the
policy caps what is retained regardless of what a connector returns.

Sources with no discoverable feed are registered as **candidates** with the probe result
recorded verbatim, and stay disabled. Enabling one requires a confirmed publisher feed
URL and a terms review — not a scraper.

---

## Voice configuration

Both directions default to **`browser`**: the Web Speech API runs on the user's own
device, so no audio reaches this server and there is no credential to leak. That is a
deliberate privacy default, not a limitation being hidden. Availability is detected at
runtime — where the browser lacks the API, the UI says voice input is unavailable in
this browser rather than showing a button that does nothing.

Voice input is transcribed client-side and arrives at `/api/companion` as text, so there
is exactly **one** answering path and one evidence model. The spoken response is
rendered from `response.voice`, derived from the same validated object as the text, so
speech cannot assert anything the text does not.

Server-side alternatives sit behind the same interfaces (`STT_PROVIDER=deepgram`,
`TTS_PROVIDER=elevenlabs`) and report themselves unavailable without a key. Audio is not
persisted unless `VOICE_PERSIST_AUDIO=true` is set explicitly. Transcripts are personal
data and are deleted with the conversation.

---

## Next recommended steps

In the order that adds most value:

1. **SEC EDGAR filing connector.** Legally attested primary evidence rather than
   self-promotion, and the largest coverage gap. EDGAR permits automated access under a
   declared user agent and rate limit.
2. **Independent business media.** With one trade publication, corroboration is
   structurally rare. Two or three more independent sources would make the
   corroboration machinery earn its keep.
3. **Enable a language model and compare.** The extractive path is the honest floor.
   Run both against the golden set and measure whether model generation improves
   usefulness without loosening citation support.
4. **Golden-set expansion.** 15 invariants is a start; the multilingual, correction and
   ambiguous-entity cases named in the evaluation plan need real fixtures.
5. **Weekly Learning Review and Monthly State of Play.** The knowledge state and
   learning connections exist; the periodic surfaces that make them compound do not.
6. **Trend objects.** Signals currently record their placement without a curated trend
   to attach to, which limits "gaining or losing momentum".
7. **Real PostgreSQL in CI.** Would let the suite exercise concurrency, which PGlite
   cannot.
