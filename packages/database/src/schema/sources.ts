/**
 * Sources, rights and documents.
 *
 * `sourcePolicies` is the gate: the fetcher refuses any source whose policy has not
 * passed rights review, and `storageScope` decides how much of a document may be
 * retained. Publicly reachable is not the same as permitted to ingest, store or
 * redistribute, and this table is where that distinction is enforced rather than
 * merely documented.
 */

import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  connectorHealthEnum,
  connectorTypeEnum,
  rightsStatusEnum,
  runStatusEnum,
  sourcePerspectiveEnum,
  sourceTypeEnum,
  storageScopeEnum,
} from './enums';
import { workspaces } from './tenancy';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const sources = pgTable(
  'sources',
  {
    id: id(),
    /** Null = available to every workspace (the shared registry). */
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 250 }).notNull(),
    /** Canonical publisher domain, used for entity attribution and dedup. */
    officialDomain: varchar('official_domain', { length: 253 }).notNull(),
    homepageUrl: text('homepage_url').notNull().default(''),
    sourceType: sourceTypeEnum('source_type').notNull(),
    perspective: sourcePerspectiveEnum('perspective').notNull(),
    /** Who publishes it, for attribution. */
    sourceOwner: varchar('source_owner', { length: 250 }).notNull().default(''),
    /** The entity this source speaks for, when it is a first-party source. */
    subjectEntityId: uuid('subject_entity_id'),
    language: varchar('language', { length: 10 }).notNull().default('en'),
    geographySlugs: jsonb('geography_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    industrySlugs: jsonb('industry_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Editorial quality 0–100. Feeds ranking, never overrides evidence strength: a
     * high-quality publication reporting a rumour is still a weak signal.
     */
    qualityScore: integer('quality_score').notNull().default(50),
    isDemo: boolean('is_demo').notNull().default(false),
    notes: text('notes').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('sources_slug_key').on(t.slug),
    index('sources_domain_idx').on(t.officialDomain),
    index('sources_perspective_idx').on(t.perspective),
  ],
);

/**
 * One policy per source. Absence of a policy means "not reviewed", which the fetcher
 * treats as "do not fetch" when INGEST_REQUIRE_RIGHTS_REVIEW is on (the default).
 */
export const sourcePolicies = pgTable(
  'source_policies',
  {
    id: id(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    rightsStatus: rightsStatusEnum('rights_status').notNull().default('pending_review'),
    allowedToIngest: boolean('allowed_to_ingest').notNull().default(false),
    allowedToStoreMetadata: boolean('allowed_to_store_metadata').notNull().default(true),
    allowedToStoreExcerpts: boolean('allowed_to_store_excerpts').notNull().default(false),
    allowedToStoreFullText: boolean('allowed_to_store_full_text').notNull().default(false),
    allowedForAiProcessing: boolean('allowed_for_ai_processing').notNull().default(false),
    allowedForRedistribution: boolean('allowed_for_redistribution').notNull().default(false),
    /** The maximum we may retain, derived from the flags above and enforced on write. */
    storageScope: storageScopeEnum('storage_scope').notNull().default('metadata'),
    requiredAttribution: text('required_attribution').notNull().default(''),
    retentionDays: integer('retention_days'),
    geographicRestrictions: jsonb('geographic_restrictions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Politeness limit we impose on ourselves, independent of what the host allows. */
    rateLimitPerHour: integer('rate_limit_per_hour').notNull().default(60),
    robotsCheckedAt: timestamp('robots_checked_at', { withTimezone: true }),
    robotsAllows: boolean('robots_allows'),
    termsUrl: text('terms_url').notNull().default(''),
    termsLastReviewedAt: timestamp('terms_last_reviewed_at', { withTimezone: true }),
    reviewedBy: varchar('reviewed_by', { length: 200 }).notNull().default(''),
    /** Why this status — shown verbatim in the admin source registry. */
    reviewNotes: text('review_notes').notNull().default(''),
    licenseStatus: varchar('license_status', { length: 100 }).notNull().default('none'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('source_policies_source_key').on(t.sourceId)],
);

export const sourceConnectors = pgTable(
  'source_connectors',
  {
    id: id(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    connectorType: connectorTypeEnum('connector_type').notNull(),
    /** Feed URL, API endpoint, or a marker like `manual` / `demo`. */
    endpoint: text('endpoint').notNull().default(''),
    isActive: boolean('is_active').notNull().default(false),
    /** Cron-ish description; the MVP worker runs on demand, this documents intent. */
    schedule: varchar('schedule', { length: 100 }).notNull().default('daily'),
    /** Feed ETag, last filing date, page cursor — connector-defined. */
    cursor: text('cursor'),
    parsingVersion: integer('parsing_version').notNull().default(1),
    configuration: jsonb('configuration')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    health: connectorHealthEnum('health').notNull().default('disabled'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastError: text('last_error').notNull().default(''),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('source_connectors_source_idx').on(t.sourceId),
    index('source_connectors_active_idx').on(t.isActive),
  ],
);

/**
 * The document as we found it. One row per (source, canonical URL); repeated fetches
 * create new *versions* rather than overwriting, which is what makes corrections
 * detectable.
 */
export const rawDocuments = pgTable(
  'raw_documents',
  {
    id: id(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    externalId: varchar('external_id', { length: 512 }),
    title: text('title').notNull(),
    author: varchar('author', { length: 300 }).notNull().default(''),
    language: varchar('language', { length: 10 }).notNull().default('en'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    /** Token fingerprint for cross-source duplicate detection. */
    fingerprint: varchar('fingerprint', { length: 32 }).notNull(),
    /** Set when this document was found to duplicate an earlier one. */
    duplicateOfId: uuid('duplicate_of_id'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('raw_documents_source_url_key').on(t.sourceId, t.canonicalUrl),
    index('raw_documents_fingerprint_idx').on(t.fingerprint),
    index('raw_documents_published_idx').on(t.publishedAt),
    index('raw_documents_source_idx').on(t.sourceId),
  ],
);

/**
 * An immutable snapshot. Evidence span offsets point into `normalizedText` of a
 * specific version, so re-fetching a changed article can never silently move a
 * citation.
 */
export const documentVersions = pgTable(
  'document_versions',
  {
    id: id(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => rawDocuments.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    /** Plain text after `normalizeText`. Empty when policy permits metadata only. */
    normalizedText: text('normalized_text').notNull().default(''),
    excerpt: text('excerpt').notNull().default(''),
    /** What we were actually allowed to keep for this version. */
    storedScope: storageScopeEnum('stored_scope').notNull().default('metadata'),
    contentHash: varchar('content_hash', { length: 32 }).notNull(),
    /** Set when this version differs materially from the previous one. */
    isCorrection: boolean('is_correction').notNull().default(false),
    changeSummary: text('change_summary').notNull().default(''),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('document_versions_doc_version_key').on(t.documentId, t.version),
    index('document_versions_doc_idx').on(t.documentId),
  ],
);

/**
 * The atom of the trust model: an exact character range in one document version,
 * with the quote copied out so a citation survives even if we later have to purge the
 * body under a retention policy.
 */
export const evidenceSpans = pgTable(
  'evidence_spans',
  {
    id: id(),
    documentVersionId: uuid('document_version_id')
      .notNull()
      .references(() => documentVersions.id, { onDelete: 'cascade' }),
    startOffset: integer('start_offset').notNull(),
    endOffset: integer('end_offset').notNull(),
    quote: text('quote').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('evidence_spans_version_idx').on(t.documentVersionId),
    uniqueIndex('evidence_spans_range_key').on(t.documentVersionId, t.startOffset, t.endOffset),
  ],
);

/** One connector execution. Drives the coverage dashboard and connector health. */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: id(),
    connectorId: uuid('connector_id')
      .notNull()
      .references(() => sourceConnectors.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id'),
    status: runStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    documentsFound: integer('documents_found').notNull().default(0),
    documentsNew: integer('documents_new').notNull().default(0),
    documentsUpdated: integer('documents_updated').notNull().default(0),
    documentsSkipped: integer('documents_skipped').notNull().default(0),
    error: text('error').notNull().default(''),
    warnings: jsonb('warnings')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [index('import_jobs_connector_idx').on(t.connectorId, t.startedAt)],
);

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  policy: one(sourcePolicies, { fields: [sources.id], references: [sourcePolicies.sourceId] }),
  connectors: many(sourceConnectors),
  documents: many(rawDocuments),
}));

export const sourcePoliciesRelations = relations(sourcePolicies, ({ one }) => ({
  source: one(sources, { fields: [sourcePolicies.sourceId], references: [sources.id] }),
}));

export const sourceConnectorsRelations = relations(sourceConnectors, ({ one, many }) => ({
  source: one(sources, { fields: [sourceConnectors.sourceId], references: [sources.id] }),
  jobs: many(importJobs),
}));

export const rawDocumentsRelations = relations(rawDocuments, ({ one, many }) => ({
  source: one(sources, { fields: [rawDocuments.sourceId], references: [sources.id] }),
  versions: many(documentVersions),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one, many }) => ({
  document: one(rawDocuments, {
    fields: [documentVersions.documentId],
    references: [rawDocuments.id],
  }),
  spans: many(evidenceSpans),
}));

export const evidenceSpansRelations = relations(evidenceSpans, ({ one }) => ({
  documentVersion: one(documentVersions, {
    fields: [evidenceSpans.documentVersionId],
    references: [documentVersions.id],
  }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  connector: one(sourceConnectors, {
    fields: [importJobs.connectorId],
    references: [sourceConnectors.id],
  }),
}));
