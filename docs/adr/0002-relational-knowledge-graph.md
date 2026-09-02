# ADR 0002 — Relational tables for the knowledge graph

- **Status** accepted
- **Date** 2026-09-01

## Context

The product needs a knowledge graph: companies operate in industries, compete with and
partner with each other; technologies enable capabilities; capabilities support value
chain stages; KPIs measure value drivers; events affect industries and support or
contradict trends; regulations affect industries.

That is graph-shaped, and the obvious reach is for a graph database.

## Decision

Model it as ordinary PostgreSQL tables with typed relation tables. No graph database.

Entities live in one `entities` table with a `kind` discriminator. Edges live in
purpose-shaped tables — `entity_relationships`, `event_entities`, `event_taxonomy`,
`learning_connections`, `entity_industries` — each with a typed `kind` column.

Two properties of the modelling matter more than the storage choice:

- **Every edge carries provenance.** `entity_relationships.claim_id` points at the claim
  the edge was derived from, so "X partners with Y" is never an unsourced assertion. A
  graph database would not have given us that; it is a schema decision.
- **A consulting firm is an entity with `kind = 'consulting_firm'`.** No special table,
  no special traversal. That is the entire mechanism behind "Accenture is not the
  product foundation" — the difference is one enum value.

## Rationale

The relationship types are **known in advance and few**. This is not an open-ended graph
where the interesting queries are unknown; it is a fixed ontology from the domain, and
the queries the product actually runs are one or two joins deep:

- events involving an entity → `event_entities` join
- events in an industry → `event_taxonomy` join
- concepts an insight touches → `learning_connections` join
- KPIs under a parent KPI → self-referencing `parent_id`

None of that needs traversal. Adding a graph store would introduce a second datastore
to keep consistent, a second query language, a second operational surface and a second
backup story, to answer questions PostgreSQL answers with a join and an index.

It would also break the evidence chain. The chain from insight back to a character range
in a document is relational and transactional; splitting entities into a separate store
would put the graph on one side of a consistency boundary and its provenance on the
other.

## Consequences

Good: one datastore; transactional consistency across the whole evidence chain;
provenance on every edge; joins are indexed and fast at this scale; a new relationship
type is a migration, not an infrastructure decision.

Costs, stated plainly:

- **Deep traversal is awkward.** "Everything within three hops of H&M" is a recursive
  CTE rather than a natural query. Nothing in the product needs it today.
- **Path-finding queries are not practical.** If "how is A connected to B?" becomes a
  real user need, this decision should be revisited.
- **Edge properties are per-table**, so a new property common to all edges means several
  migrations.

## Revisit when

There is *evidence* that traversal depth is the constraint: a real user need for
multi-hop path queries, or a recursive CTE that has become the performance bottleneck
under realistic data volume. Not before. Introducing a graph database because the domain
is describable as a graph would be choosing the technology for its name rather than for
a measured problem.
