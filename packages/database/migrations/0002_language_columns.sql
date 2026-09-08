-- Language on the searchable rows.
--
-- Denormalised from `raw_documents.language`, because `search_vector` is a PostgreSQL
-- generated column and a generated column may only read its own row. Without it every
-- document — German, Dutch, Danish, Norwegian, Finnish — was stemmed as English, so
-- "Übernahme" did not match an article about "Übernahmen".
--
-- The default is 'en': the corpus is 84% English, and English is what the previous
-- behaviour assumed, so a row nobody has backfilled keeps behaving exactly as it did.
-- packages/database/sql/002_search_language.sql backfills the rest from the documents
-- and rebuilds the vectors.

ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN IF NOT EXISTS "language" varchar(8) DEFAULT 'en' NOT NULL;
