-- Full-text search objects.
--
-- Kept out of the drizzle schema because generated columns and GIN indexes are not
-- modelled by drizzle-kit. Idempotent: db:migrate re-runs this on every invocation.
--
-- We index events and insights rather than raw documents. Searching documents would
-- return ten rows for one announcement; searching events returns the announcement.

-- ── Events ───────────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS events_search_idx ON events USING gin (search_vector);

-- ── Insights ─────────────────────────────────────────────────────────────────

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(headline, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(takeaway, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(what_happened, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(why_it_matters, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(market_context, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS insights_search_idx ON insights USING gin (search_vector);

-- ── Claims ───────────────────────────────────────────────────────────────────
-- Searched directly by the Companion's retrieval step, which needs claim-level hits
-- so that an answer can cite the exact statement rather than a whole insight.

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

CREATE INDEX IF NOT EXISTS claims_search_idx ON claims USING gin (search_vector);

-- ── Entities ─────────────────────────────────────────────────────────────────

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS entities_search_idx ON entities USING gin (search_vector);

-- ── Learning units ───────────────────────────────────────────────────────────

ALTER TABLE learning_units
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(objective, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(explanation, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS learning_units_search_idx ON learning_units USING gin (search_vector);

-- ── Supporting indexes for the hot paths ─────────────────────────────────────

-- Daily brief composition: recent, unsuppressed events by effective date.
CREATE INDEX IF NOT EXISTS events_recent_idx
  ON events (coalesce(event_at, first_reported_at) DESC)
  WHERE is_suppressed = false;

-- Company timeline.
CREATE INDEX IF NOT EXISTS event_entities_timeline_idx
  ON event_entities (entity_id, event_id);

-- "Which claims support this event, and are they evidenced?"
CREATE INDEX IF NOT EXISTS claim_evidence_span_idx
  ON claim_evidence (evidence_span_id);
