# Technical Architecture

A modular monolith. One deployable web application, one worker process, and a set of
source-only packages with enforced boundaries. No microservices, no message broker, no
service mesh — none of them would earn their operational cost at this scale, and all of
them would make the evidence chain harder to reason about.

---

## Shape

```
                        ┌──────────────────────────────┐
                        │  apps/web   (Next.js 16)     │
                        │  RSC pages · API routes      │
                        │  server actions              │
                        └───────────┬──────────────────┘
                                    │
   ┌────────────────────────────────┼────────────────────────────────┐
   │                                │                                │
┌──┴────────────┐   ┌───────────────┴──────────┐   ┌────────────────┴───┐
│ packages/     │   │ packages/intelligence     │   │ packages/ranking   │
│ database      │   │ extract · classify        │   │ score · compose    │
│ drizzle + pg  │   │ cluster · insight         │   └────────────────────┘
└──┬────────────┘   │ companion                 │
   │                └───────┬───────────┬───────┘
   │                        │           │
   │              ┌─────────┴──┐   ┌────┴──────────┐
   │              │ connectors │   │ ai            │
   │              │ fetch·feed │   │ llm·stt·tts   │
   │              │ rights     │   │ (interfaces)  │
   │              └────────────┘   └───────────────┘
   │
┌──┴─────────────────────────────┐        ┌──────────────────────────┐
│ PostgreSQL 18                  │◄───────┤ apps/worker (pipeline)   │
│ local: PGlite over wire proto  │        └──────────────────────────┘
│ prod:  managed instance        │
└────────────────────────────────┘
```

`packages/domain` sits beneath everything and imports nothing but Zod. It holds the
controlled vocabularies, the schemas and the evidence guards, and it performs no I/O —
which is what lets the same rules apply in the pipeline, in a route handler and in a
test.

---

## Boundaries that are enforced, not just intended

| Rule                                       | Why                                                              | How it holds                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| No vendor SDK outside `packages/ai`        | Provider independence has to be structural or it evaporates      | `AnthropicProvider` is the only file that knows a vendor exists              |
| No domain logic in UI components           | Otherwise the trust rules end up duplicated and drift            | Pages read repositories and render; classification lives in `intelligence`   |
| No data access outside `packages/database` | Tenant scoping must be unavoidable                               | Every query goes through a workspace-scoped function                         |
| `packages/domain` performs no I/O          | It is imported by everything, including tests                    | Zod is its only dependency                                                   |
| Zod at every boundary                      | HTTP bodies, connector output and model output are all untrusted | `CompanionRequestSchema`, `FetchedDocumentSchema`, `CompanionResponseSchema` |

---

## Why these choices

### PostgreSQL, and PGlite locally

The machine had no Docker and no PostgreSQL, and "runs locally from documented steps"
is a hard requirement. PGlite is genuine PostgreSQL 18 compiled to WASM; fronted by
`pglite-socket` it speaks the real wire protocol, so `pg`, Drizzle, drizzle-kit, the
worker and Playwright all connect with an ordinary `postgres://` URL. Production points
at a managed instance and nothing changes.

Full reasoning, alternatives and limits: [`adr/0001-stack-and-local-database.md`](adr/0001-stack-and-local-database.md).

The cost is real and documented: one connection, no `pg_trgm`, no `pgvector`. The
client serialises queries to match (see below).

### Relational tables, not a graph database

The relationships the product needs — company operates in industry, event affects
industry, technology enables capability — are known in advance and shallow. PostgreSQL
joins handle them at this scale, and every edge carries the claim it was derived from,
so "X partners with Y" is never an unsourced assertion. A graph store would add an
operational component to answer questions two joins deep.
See [`adr/0002-relational-knowledge-graph.md`](adr/0002-relational-knowledge-graph.md).

### Server components by default

The product is read-heavy and evidence-dense. Rendering on the server keeps the
citation chain on the server, where the authorisation already is, and sends markup
rather than a query layer. Client components are used only where interaction demands
them: the Companion panel, the feedback bar, the theme toggle, the knowledge check.

### Extractive generation as the floor, not the fallback

`getTextProvider()` returns `null` when no model is configured, and callers must handle
it by using the extractive path — never by substituting prose of their own. That
inverts the usual arrangement: the honest, checkable path is the default, and a model
is an enhancement whose output must pass the same evidence checks.
See [`adr/0003-extractive-generation-floor.md`](adr/0003-extractive-generation-floor.md).

---

## Request paths

**Page render.** Route → `requireUser()` (session cookie → database) → workspace-scoped
repository calls → server-rendered markup. No client-side data fetching for primary
content.

**Companion answer.** `POST /api/companion` → rate limit → `CompanionRequestSchema` →
`answerQuestion()` → claim-level FTS retrieval with a relevance floor → mode assembly →
`assertEvidenceIntegrity()` → persist both turns → JSON. A response that fails the
integrity check is discarded and the caller is told so, rather than shown something
unverified.

**Pipeline run.** `apps/worker` → for each connector: rights gate → fetch → version →
extract claims with offset-exact spans → resolve entities → cluster into events →
detect contradictions → assemble insights → learning connections and conversation
applications. Every stage writes a `pipeline_stage_runs` row with counts and rejection
reasons.

---

## Database access

Two modes, chosen by `DATABASE_POOL_MAX`:

- **pooled** (`> 1`) — an ordinary `pg.Pool`. What production uses.
- **serialised** (default `1`) — one connection, queries queued through a promise chain,
  reconnecting after a transport failure.

The serialised mode exists because PGlite is a single backend: two concurrent clients
do not queue politely, the backend drops the connection mid-query, and a pool then
hands the same dead client to the next caller. Queueing at the client makes that
failure mode disappear instead of retrying around it. Only errors matching a narrow
transient list trigger a reconnect, so a genuine SQL error still fails immediately.

---

## Search

PostgreSQL full-text search on five generated `tsvector` columns with GIN indexes:
events, insights, claims, entities and learning units. Weighted by field — a title
match outranks a body match.

Two things worth knowing:

- **Events are indexed, not documents.** Searching documents returns ten rows for one
  announcement; searching events returns the announcement.
- **Query terms are OR-ed, then ranked.** `websearch_to_tsquery` treats whitespace as
  AND, so a seven-word question requires all seven stems in one claim and matches
  nothing. OR retrieves candidates and `ts_rank` orders them — with a **term-overlap
  floor** in the Companion, because OR without a floor happily returns an NVIDIA
  earnings release for a question about an Uzbek textile mill.

Semantic retrieval is interface-only (`SemanticRetriever`, reports itself unavailable).

---

## AI service layer

```
TextProvider          generateStructured<T>(schema, jsonSchema, prompt) → validated T
EmbeddingProvider     embed(texts) → vectors
SpeechToTextProvider  mode: 'browser' | 'server' | 'unavailable'
TextToSpeechProvider  mode: 'browser' | 'server' | 'unavailable'
```

The Anthropic provider uses tool-use for constrained output, validates with Zod, retries
once with the validation errors fed back, then gives up. Giving up is correct: the caller
falls back to the extractive path rather than shipping unvalidated text. Usage and cost
are recorded per call in `ai_usage`, with a per-run ceiling.

Speech defaults to `browser` in both directions — the Web Speech API runs on the user's
device, so no audio reaches the server and there is no credential to leak. The STT
browser provider deliberately has **no** server-side `transcribe` method; the absence
is the guarantee.

---

## Security posture

Detail in [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md). Structurally:

- Tenancy by `workspace_id` on every user-owned row, scoped in every query
- scrypt passwords; opaque session tokens stored only as SHA-256, so a database
  disclosure yields no usable sessions
- One SSRF-guarded fetcher for all outbound ingestion: pre-connect DNS validation,
  per-hop redirect re-validation, streaming byte ceiling, scheme allow-list
- Ingested content is data, never instruction — and model output is schema- and
  evidence-checked, so a successful prompt injection still cannot fabricate a citation
- CSP, frame denial, `nosniff`, restrictive `Permissions-Policy`
- Append-only audit log

---

## Testing strategy

| Layer       | Tool                   | What it asserts                                                                                                                                                   |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                 | Pure logic: offsets, classification, clustering, ranking, rights, SSRF ranges, feed parsing                                                                       |
| Integration | Vitest + live database | Properties of real data: no unevidenced FACT, quotes match their offsets, no active connector on an unapproved source, no first-party-only event marked validated |
| Invariants  | `packages/evaluation`  | 15 properties the product claims about itself, runnable from CLI and rendered live in admin                                                                       |
| End-to-end  | Playwright             | Journeys, on desktop and mobile, against the **production** server                                                                                                |

E2E targets `next start` rather than `next dev` because the dev client runtime needs its
HMR WebSocket to finish bootstrapping; where that upgrade is blocked, pages render but
never hydrate and every interaction test fails for a reason unrelated to the
application.

---

## Scaling, when it is needed

Nothing here is designed for scale it does not have. The order in which it would give:

1. **Ingestion volume** → move the worker to a durable queue; the connector interface
   already carries cursors and retry policy.
2. **Retrieval quality** → enable pgvector and hybrid retrieval; the interface exists.
3. **Read load** → raise `DATABASE_POOL_MAX`, add read replicas; nothing changes.
4. **Insight generation cost** → batch and cache by event; `ai_usage` already measures
   it.
5. **Tenancy** → the workspace scoping is present from the start, so multi-tenant
   isolation is configuration rather than migration.

What would _not_ help: splitting the monolith. The bottleneck in a product like this is
source coverage and intelligence quality, not process boundaries.
