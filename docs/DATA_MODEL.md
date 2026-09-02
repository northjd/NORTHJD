# Data Model

82 tables across seven domains. This document covers the shape and the decisions worth
knowing; the schema itself is the reference, in `packages/database/src/schema/`.

---

## Domains

| File | Tables | Concern |
|---|---|---|
| `tenancy.ts` | 10 | Organizations, workspaces, users, sessions, profiles, missions, watchlists |
| `taxonomy.ts` | 11 | Industries, value chain stages, business models, KPIs, capabilities, technologies, topics, geographies, learning concepts/paths/units |
| `entities.ts` | 7 | Entities, aliases, industries, relationships, people, offerings, coverage |
| `sources.ts` | 6 | Sources, policies, connectors, raw documents, versions, evidence spans, import jobs |
| `intelligence.ts` | 18 | Claims, evidence links, events, clustering joins, contradictions, signals, trends, insights, applications |
| `experience.ts` | 20 | Briefs, feedback, knowledge state, learning progress, library, meetings, conversations, notifications |
| `operations.ts` | 8 | Pipeline runs, prompt/model versions, evaluation, audit, AI usage |

---

## Decisions worth knowing

### Immutable document versions
`raw_documents` holds one row per (source, canonical URL). Content lives in
`document_versions`, and a re-fetch that changes materially inserts a new version rather
than updating. Evidence span offsets refer to a specific version, so an article edited
after the fact can never silently move a citation — and comparing versions is what makes
corrections detectable at all.

### Evidence spans store the quote as well as the offsets
Redundant on purpose. A citation survives a retention policy that later purges the body,
and the evidence page can highlight the range inside surrounding context. An integration
test verifies every stored quote still matches the text at its offsets.

### Claims are separate from events
A document produces claims; claims constitute events; several documents' claims can
constitute one event. Without that separation, "ten sources reported this" is not
expressible, and the daily brief cannot be finite.

### Insights are per-workspace, events are shared
`insights` is uniquely keyed on `(workspace_id, event_id)`. The event is a fact about the
world; the interpretation depends on who is asking.

### Enums, not strings
31 PostgreSQL enums derived from the domain vocabularies, so the database, the
TypeScript union and the Zod schema cannot drift. The difference between `ANNOUNCED` and
`INDEPENDENTLY_VALIDATED_IMPACT` is only meaningful if it is a typed value everything
agrees on.

### Six timestamps, never merged
`event_at`, `published_at`, `source_updated_at`, `discovered_at`, `processed_at`,
`last_verified_at`. All `timestamptz`, all UTC. `event_at` is null whenever no source
states it.

### Generated tsvector columns
Five, created by `sql/001_search.sql` rather than by drizzle-kit, which does not model
generated columns. Declared on the drizzle tables via a `customType` so queries are
typed. **If you run `db:generate`, delete the `ADD COLUMN search_vector` lines from the
generated migration** — the columns are owned by the SQL file, which is idempotent and
runs after every migration.

### Suppression, not deletion
`events.is_suppressed` with a required reason. An admin removing something from view
leaves a record of having done so.

### Classification origin is explicit
`classification_origin` on events and `event_taxonomy.origin` distinguish
`stated_in_source` from `inferred` from `human_curated`, so the UI can label an
interpretation as one.

---

## The evidence chain, as constraints

```sql
claims.document_version_id  → document_versions.id   NOT NULL
claim_evidence.claim_id     → claims.id              NOT NULL
claim_evidence.evidence_span_id → evidence_spans.id  NOT NULL
evidence_spans.document_version_id → document_versions.id NOT NULL
```

Not-null all the way down, so a claim cannot exist without a version and an evidence
link cannot exist without both ends. What foreign keys *cannot* express is "a FACT claim
must have at least one evidence link" — that is enforced at write time, by a Zod
refinement, by `assertEvidenceIntegrity` before display, and by a continuously-run
invariant. Four layers, because one would eventually be bypassed.

---

## Indexing

215 indexes. The ones that matter:

- `events_recent_idx` — partial, on `coalesce(event_at, first_reported_at) DESC` where
  not suppressed. The brief-composition query.
- `event_entities_timeline_idx` — company timelines.
- `claim_evidence_span_idx` — "is this claim evidenced?"
- Five GIN indexes on the `tsvector` columns.
- Unique natural keys throughout — `(source_id, canonical_url)`,
  `(document_id, version)`, `(user_id, workspace_id, brief_date)`,
  `(workspace_id, event_id)` — so idempotent writes are enforced by the database rather
  than by application care.

---

## Tenancy

Every user-owned table carries `workspace_id`. Reference content — taxonomy, learning
material, entities, the shared source registry — is global, with `sources.workspace_id`
nullable to allow workspace-specific sources later.

The enterprise story needs no migration: organization, workspace, membership and role
are present from the start, and shared watchlists and collections already have
`is_shared` and nullable `user_id`.

---

## What is modelled but not implemented

Honest about the difference between a schema and a feature:

| Table | State |
|---|---|
| `trends` | Schema and signal links exist; **no curated trends authored** |
| `case_studies`, `case_study_claims` | Schema exists; no extraction populates them |
| `entity_relationships` | Schema exists; only seeded reference data, no extraction |
| `entity_people`, `offerings` | Schema exists; not populated |
| `prompt_versions`, `model_configurations` | Schema exists; only used when a model is configured |
| `evaluation_cases`, `evaluation_results` | Schema exists; the suite currently runs in code rather than from rows |
| `review_schedule` semantics | `review_due_at` is written; no scheduler consumes it |
| `notifications` | Schema and preferences exist; nothing generates them |
| `voice_sessions` | Schema exists; browser voice records turns, not sessions |

These are prepared, not pretended. The admin capabilities page lists the same
distinction for connectors.
