# ADR 0001 — Stack, and how we run PostgreSQL with no Docker

- **Status** accepted
- **Date** 2026-09-01

## Context

The target stack in the brief is TypeScript / modern React framework / PostgreSQL /
relational ORM / PostgreSQL FTS / background jobs / Playwright.

The development machine turned out to have **no Node.js, no npm, no Homebrew, no
Docker and no PostgreSQL** — only macOS 26.5, Python 3.9, SQLite and git. Network
access to nodejs.org and registry.npmjs.org works. Installing Docker Desktop or a
Homebrew PostgreSQL needs administrator rights we do not have.

"The application runs locally following documented steps" is acceptance criterion 59,
so the database cannot be a prerequisite the user has to solve themselves.

## Decision

**Node.js 24.20.0 LTS** installed to a user-local prefix
(`~/.local/node-v24.20.0-darwin-arm64`, no sudo, no shell-profile edits;
`. ./scripts/env.sh` puts it on PATH).

**PostgreSQL 18 is the database — for real, not an abstraction over SQLite.** In local
development the server is [PGlite](https://pglite.dev) (PostgreSQL 18.3 compiled to
WASM) fronted by `@electric-sql/pglite-socket`, which speaks the actual PostgreSQL wire
protocol on a TCP port. Everything else — `pg`, Drizzle, `drizzle-kit`, migrations,
tests, the worker — connects with an ordinary `postgres://` URL and cannot tell the
difference.

```
apps/web ─┐
apps/worker ─┼─ pg (node-postgres) ─ postgres://…:55432 ─ PGlite socket server ─ PGlite (PG 18.3 WASM)
tests ─┘                            └─ or any real PostgreSQL, unchanged
```

`DATABASE_URL` selects the target. Point it at a managed PostgreSQL and nothing in the
application changes.

Verified before committing to this (`scripts/../scratchpad probe`): `select version()`
returns *PostgreSQL 18.3 (PGlite 0.5.8)*; `tsvector` generated columns, GIN indexes,
`websearch_to_tsquery` and `ts_rank` all work; `jsonb` and `gen_random_uuid()` work.

Rest of the stack: **Next.js 16** (App Router, React 19), **Drizzle ORM 0.45** +
drizzle-kit for schema and SQL migrations, **Tailwind 4** for the design system,
**Zod 4** at every boundary, **Vitest 4** for unit/integration, **Playwright 1.62** for
end-to-end, **npm workspaces** for the monorepo.

## Consequences

Good: real PostgreSQL semantics (FTS ranking, `tsvector`, jsonb, CTEs, window
functions) with zero infrastructure; one `npm run db:up` and the stack is live; the
same migrations run against production PostgreSQL.

Costs and limits, stated honestly:

- PGlite is **single-connection**. The socket server serialises clients, so the web app
  and the worker share one backend. Fine for one developer; it is not a concurrency
  test.
- Extensions in the base PGlite bundle are limited. `pg_trgm` is **not** available
  (probed and confirmed), so fuzzy matching uses `levenshtein`-free SQL and application
  logic. `pgvector` is available as a separate PGlite extension module but is **not
  enabled** — semantic search is interface-only in this MVP (see
  `docs/AI_PIPELINE.md`).
- PGlite is not a production database. Production must use managed PostgreSQL; this is
  stated in the README and in the admin coverage view.

## Alternatives rejected

- **`embedded-postgres`** (downloads real PostgreSQL binaries): closest to production,
  but current npm release is `18.4.0-beta.17` and it adds a per-platform binary
  download to setup. Kept as a documented option in the README for anyone who wants a
  real server without Docker.
- **SQLite** (available, zero install): would have forced us off `tsvector`, jsonb
  operators and PostgreSQL ranking, and made the production migration a rewrite.
  Rejected — the brief names PostgreSQL FTS as the search foundation.
- **Requiring the user to install Docker/Postgres first**: breaks acceptance criterion
  59 and pushes an admin-rights problem onto the user.
