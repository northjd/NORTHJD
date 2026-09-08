-- Per-language full-text search.
--
-- `001_search.sql` indexed everything with the `english` configuration. For company
-- names that is harmless — a name is a name in any language, which is what the
-- non-English sources were registered for — but word endings are not. The English
-- Snowball stemmer has no rule for the German plural -en, so "Übernahmen" and
-- "Übernahme" became different lexemes and a German query for one missed the other.
--
-- Measured, on this PostgreSQL: german Filialen→filial, dutch supermarkten→supermarkt,
-- danish butikker→butik, norwegian butikker→butikk, swedish butiker→butik all unify
-- under their own configuration and none of them under english.
--
-- Two halves make it work:
--
--   * **Indexing** stems each row with the configuration for its own language.
--     `to_tsvector(regconfig, text)` is IMMUTABLE, so it is legal inside a generated
--     column — which is why `north_lang` below returns a regconfig chosen from
--     constants rather than casting the column, a cast being merely STABLE.
--
--   * **Querying** ORs the query across every configuration in use; see
--     `languageAwareTsQuery` in packages/search/src/index.ts. A German row is only ever
--     matched by the German stemming of the query and an English row by the English
--     one, so the languages do not contaminate each other: each row is matched by the
--     stemming that built it.
--
-- Not fixed, and worth knowing: Snowball's Dutch stemmer leaves "overnames" whole while
-- reducing "overname" to "overnam", and Finnish consonant gradation defeats it outright
-- (kauppa→kaup, kaupat→kaupa). Those are stemmer limitations rather than indexing ones,
-- and recording them is better than implying a completeness this does not have.

-- ── The language map ─────────────────────────────────────────────────────────
--
-- Created once, never replaced. Generated columns store their values, so changing what
-- this returns would leave every existing row stemmed by the old rule while claiming
-- the new one — silently, and only visible as searches that stop matching. To change
-- the map, add `north_lang_v2` and point the columns below at it; the rebuild guard
-- will then do the work exactly once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'north_lang') THEN
    CREATE FUNCTION north_lang(code varchar) RETURNS regconfig
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $fn$
      SELECT CASE lower(code)
        WHEN 'de' THEN 'german'::regconfig
        WHEN 'nl' THEN 'dutch'::regconfig
        WHEN 'da' THEN 'danish'::regconfig
        WHEN 'no' THEN 'norwegian'::regconfig
        WHEN 'nb' THEN 'norwegian'::regconfig
        WHEN 'nn' THEN 'norwegian'::regconfig
        WHEN 'sv' THEN 'swedish'::regconfig
        WHEN 'fi' THEN 'finnish'::regconfig
        WHEN 'fr' THEN 'french'::regconfig
        WHEN 'es' THEN 'spanish'::regconfig
        WHEN 'it' THEN 'italian'::regconfig
        WHEN 'pt' THEN 'portuguese'::regconfig
        ELSE 'english'::regconfig
      END
    $fn$;
  END IF;
END $$;

-- ── Language backfill ────────────────────────────────────────────────────────
-- The pipeline sets these at insert time; this catches rows written before it did,
-- including a corpus restored from a cache built by the previous version.

UPDATE claims c
   SET language = rd.language
  FROM document_versions dv
  JOIN raw_documents rd ON rd.id = dv.document_id
 WHERE dv.id = c.document_version_id
   AND rd.language IS NOT NULL
   AND c.language IS DISTINCT FROM rd.language;

UPDATE events e
   SET language = sub.language
  FROM (
    SELECT ed.event_id, mode() WITHIN GROUP (ORDER BY rd.language) AS language
      FROM event_documents ed
      JOIN raw_documents rd ON rd.id = ed.document_id
     WHERE rd.language IS NOT NULL
     GROUP BY ed.event_id
  ) sub
 WHERE sub.event_id = e.id
   AND e.language IS DISTINCT FROM sub.language;

UPDATE insights i
   SET language = e.language
  FROM events e
 WHERE e.id = i.event_id
   AND i.language IS DISTINCT FROM e.language;

-- ── Rebuild the vectors, once ────────────────────────────────────────────────
--
-- `001_search.sql` adds these with IF NOT EXISTS, so on a database that already has the
-- english-only definition it would do nothing and search would stay wrong. This drops
-- and recreates them — but only where they are not already language-aware, because
-- `db:migrate` runs on every publish and rebuilding every tsvector eight times a day is
-- work for nothing. The test is whether the stored expression already calls the map.

DO $$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('claims',   'claims_search_idx',
       $expr$to_tsvector(north_lang(language), coalesce(text, ''))$expr$),
      ('events',   'events_search_idx',
       $expr$setweight(to_tsvector(north_lang(language), coalesce(title, '')), 'A') ||
             setweight(to_tsvector(north_lang(language), coalesce(summary, '')), 'B')$expr$),
      ('insights', 'insights_search_idx',
       $expr$setweight(to_tsvector(north_lang(language), coalesce(headline, '')), 'A') ||
             setweight(to_tsvector(north_lang(language), coalesce(takeaway, '')), 'A') ||
             setweight(to_tsvector(north_lang(language), coalesce(what_happened, '')), 'B') ||
             setweight(to_tsvector(north_lang(language), coalesce(why_it_matters, '')), 'C') ||
             setweight(to_tsvector(north_lang(language), coalesce(market_context, '')), 'D')$expr$)
    ) AS t(tbl, idx, expr)
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1
        FROM pg_attrdef ad
        JOIN pg_class c ON c.oid = ad.adrelid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ad.adnum
       WHERE c.relname = spec.tbl
         AND a.attname = 'search_vector'
         AND position('north_lang' IN pg_get_expr(ad.adbin, ad.adrelid)) > 0
    );

    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS search_vector', spec.tbl);
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (%s) STORED',
      spec.tbl, spec.expr
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING gin (search_vector)',
                   spec.idx, spec.tbl);
    RAISE NOTICE 'search_vector on % rebuilt with per-language stemming', spec.tbl;
  END LOOP;
END $$;
