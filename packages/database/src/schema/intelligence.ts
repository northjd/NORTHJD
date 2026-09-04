/**
 * The intelligence hierarchy.
 *
 *   source → raw document → document version → evidence span
 *          → claim → event → signal → insight
 *          → learning connection → conversation application → briefing
 *
 * The chain is the product. Every derived row keeps a path back to a character range
 * in a stored document, which is what lets the UI answer "how do you know that?" at
 * every level instead of just linking to an article.
 */

import { relations, sql } from 'drizzle-orm';
import { tsvector } from './tsvector';
import {
  boolean,
  doublePrecision,
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
  caseMaturityEnum,
  claimTypeEnum,
  classificationOriginEnum,
  conversationApplicationKindEnum,
  eventRelationshipEnum,
  eventTypeEnum,
  evidenceStrengthEnum,
  generatorEnum,
  learningConnectionKindEnum,
  noveltyKindEnum,
  strategicImpactEnum,
  verificationStatusEnum,
} from './enums';
import { documentVersions, evidenceSpans, rawDocuments, sources } from './sources';
import { entities } from './entities';
import { industries, learningConcepts } from './taxonomy';
import { users, workspaces } from './tenancy';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * A single checkable statement. `claimType` decides how it may ever be presented:
 * only FACT appears under "Verified facts", and a FACT without evidence cannot be
 * written (enforced in the repository and asserted in tests).
 */
export const claims = pgTable(
  'claims',
  {
    id: id(),
    documentVersionId: uuid('document_version_id')
      .notNull()
      .references(() => documentVersions.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    claimType: claimTypeEnum('claim_type').notNull().default('UNVERIFIED_SIGNAL'),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('SINGLE_SOURCE'),
    evidenceStrength: evidenceStrengthEnum('evidence_strength')
      .notNull()
      .default('WEAK_OR_UNVERIFIED_SIGNAL'),
    /** Extraction confidence, not confidence about the world. */
    confidence: doublePrecision('confidence').notNull().default(0.5),
    /** True when the claim states a measurable outcome (a %, a currency amount, an x). */
    quantified: boolean('quantified').notNull().default(false),
    /** Distinct timestamps, never merged. */
    eventAt: timestamp('event_at', { withTimezone: true }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    /** Set when a later document version contradicts or corrects this claim. */
    supersededByClaimId: uuid('superseded_by_claim_id'),
    needsReview: boolean('needs_review').notNull().default(false),
    reviewReason: text('review_reason').notNull().default(''),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    promptVersionId: uuid('prompt_version_id'),
    /** Generated tsvector, created by packages/database/sql/001_search.sql. */
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('claims_version_idx').on(t.documentVersionId),
    index('claims_type_idx').on(t.claimType),
    index('claims_source_idx').on(t.sourceId),
    index('claims_review_idx').on(t.needsReview),
  ],
);

/** Join from a claim to the exact spans that support it. Many-to-many by design. */
export const claimEvidence = pgTable(
  'claim_evidence',
  {
    id: id(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    evidenceSpanId: uuid('evidence_span_id')
      .notNull()
      .references(() => evidenceSpans.id, { onDelete: 'cascade' }),
    /** supports | contradicts | qualifies */
    relation: varchar('relation', { length: 20 }).notNull().default('supports'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('claim_evidence_key').on(t.claimId, t.evidenceSpanId),
    index('claim_evidence_claim_idx').on(t.claimId),
  ],
);

export const claimEntities = pgTable(
  'claim_entities',
  {
    id: id(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    /** subject | object | mentioned */
    role: varchar('role', { length: 20 }).notNull().default('mentioned'),
    /** Resolution confidence — low values mean the alias was ambiguous. */
    confidence: doublePrecision('confidence').notNull().default(0.5),
  },
  (t) => [uniqueIndex('claim_entities_key').on(t.claimId, t.entityId, t.role)],
);

/**
 * A real-world occurrence, independent of who reported it. Several documents from
 * several sources collapse into one event — this is what "events before articles"
 * means concretely.
 */
export const events = pgTable(
  'events',
  {
    id: id(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    eventType: eventTypeEnum('event_type').notNull().default('other'),
    /** When it happened. Null when no source states it — never guessed. */
    eventAt: timestamp('event_at', { withTimezone: true }),
    /** Earliest publication among clustered documents; drives "what is new". */
    firstReportedAt: timestamp('first_reported_at', { withTimezone: true }),
    lastReportedAt: timestamp('last_reported_at', { withTimezone: true }),
    /** Bumped when a new document adds material information to an existing event. */
    revision: integer('revision').notNull().default(1),
    lastMaterialChangeAt: timestamp('last_material_change_at', { withTimezone: true }),
    changeNote: text('change_note').notNull().default(''),

    strategicImpact: strategicImpactEnum('strategic_impact').notNull().default('moderate'),
    caseMaturity: caseMaturityEnum('case_maturity').notNull().default('ANNOUNCED'),
    /** Strongest evidence across the event's claims. */
    evidenceStrength: evidenceStrengthEnum('evidence_strength')
      .notNull()
      .default('WEAK_OR_UNVERIFIED_SIGNAL'),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('SINGLE_SOURCE'),
    /** Distinct sources reporting it; corroboration, not popularity. */
    sourceCount: integer('source_count').notNull().default(1),
    independentSourceCount: integer('independent_source_count').notNull().default(0),
    firstPartyOnly: boolean('first_party_only').notNull().default(true),

    classificationOrigin: classificationOriginEnum('classification_origin')
      .notNull()
      .default('inferred'),
    valueLevers: jsonb('value_levers')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    operatingModelDimensions: jsonb('operating_model_dimensions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    likelyExecutiveOwners: jsonb('likely_executive_owners')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    geographySlugs: jsonb('geography_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Suppressed by an admin — retained with a reason, never silently deleted. */
    isSuppressed: boolean('is_suppressed').notNull().default(false),
    suppressionReason: text('suppression_reason').notNull().default(''),
    isDemo: boolean('is_demo').notNull().default(false),
    /** Generated tsvector, created by packages/database/sql/001_search.sql. */
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('events_event_at_idx').on(t.eventAt),
    index('events_first_reported_idx').on(t.firstReportedAt),
    index('events_type_idx').on(t.eventType),
    index('events_maturity_idx').on(t.caseMaturity),
  ],
);

/** Which claims constitute an event, and which document each came from. */
export const eventClaims = pgTable(
  'event_claims',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    /** True for the claim that best states what the event is. */
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [uniqueIndex('event_claims_key').on(t.eventId, t.claimId)],
);

export const eventDocuments = pgTable(
  'event_documents',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => rawDocuments.id, { onDelete: 'cascade' }),
    /** The document that first reported it. */
    isOriginating: boolean('is_originating').notNull().default(false),
  },
  (t) => [uniqueIndex('event_documents_key').on(t.eventId, t.documentId)],
);

export const eventEntities = pgTable(
  'event_entities',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('mentioned'),
  },
  (t) => [
    uniqueIndex('event_entities_key').on(t.eventId, t.entityId, t.role),
    index('event_entities_entity_idx').on(t.entityId),
  ],
);

export const eventTaxonomy = pgTable(
  'event_taxonomy',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** industry | topic | technology | capability | value_chain_stage | kpi */
    kind: varchar('kind', { length: 40 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    origin: classificationOriginEnum('origin').notNull().default('inferred'),
    confidence: doublePrecision('confidence').notNull().default(0.5),
  },
  (t) => [
    uniqueIndex('event_taxonomy_key').on(t.eventId, t.kind, t.slug),
    index('event_taxonomy_slug_idx').on(t.kind, t.slug),
  ],
);

/**
 * Typed links between events: follow-ups, corrections, contradictions. This is how a
 * timeline becomes a narrative and how a correction propagates to dependent insights.
 */
export const eventRelationships = pgTable(
  'event_relationships',
  {
    id: id(),
    fromEventId: uuid('from_event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    toEventId: uuid('to_event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    kind: eventRelationshipEnum('kind').notNull().default('related_to'),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('event_rel_key').on(t.fromEventId, t.toEventId, t.kind)],
);

/**
 * Two claims that cannot both be true. Surfaced rather than resolved — the product
 * shows the disagreement instead of silently merging sources into false consensus.
 */
export const contradictions = pgTable(
  'contradictions',
  {
    id: id(),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    claimAId: uuid('claim_a_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    claimBId: uuid('claim_b_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    /** numeric_mismatch | negation | date_mismatch | status_mismatch */
    kind: varchar('kind', { length: 40 }).notNull(),
    explanation: text('explanation').notNull().default(''),
    /** open | resolved_a | resolved_b | unresolvable */
    resolution: varchar('resolution', { length: 20 }).notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('contradictions_key').on(t.claimAId, t.claimBId)],
);

/** An event placed in a larger pattern. The bridge from Market Pulse to Market Model. */
export const signals = pgTable(
  'signals',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    trendId: uuid('trend_id'),
    /** How this event relates to the pattern. */
    direction: varchar('direction', { length: 20 }).notNull().default('supports'),
    /** Why we think it fits — shown as interpretation, never as fact. */
    rationale: text('rationale').notNull().default(''),
    strength: doublePrecision('strength').notNull().default(0.5),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    createdAt: createdAt(),
  },
  (t) => [index('signals_event_idx').on(t.eventId), index('signals_trend_idx').on(t.trendId)],
);

export const trends = pgTable(
  'trends',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 300 }).notNull(),
    description: text('description').notNull().default(''),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'set null' }),
    /** emerging | building | mainstream | fading | disproven */
    stage: varchar('stage', { length: 20 }).notNull().default('emerging'),
    supportingSignalCount: integer('supporting_signal_count').notNull().default(0),
    contradictingSignalCount: integer('contradicting_signal_count').notNull().default(0),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('trends_slug_key').on(t.slug)],
);

/**
 * A signal interpreted for a specific workspace. Insights are per-workspace because
 * "why it matters" depends on who is asking.
 */
export const insights = pgTable(
  'insights',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    signalId: uuid('signal_id').references(() => signals.id, { onDelete: 'set null' }),

    headline: text('headline').notNull(),
    takeaway: text('takeaway').notNull().default(''),
    whatHappened: text('what_happened').notNull().default(''),
    whatChanged: text('what_changed').notNull().default(''),
    whyItMatters: text('why_it_matters').notNull().default(''),
    whatIsGenuinelyNew: text('what_is_genuinely_new').notNull().default(''),
    marketContext: text('market_context').notNull().default(''),
    /** Explicitly labelled as our interpretation everywhere it is rendered. */
    consultantPerspective: text('consultant_perspective').notNull().default(''),
    clientImplications: jsonb('client_implications')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    knownUnknowns: jsonb('known_unknowns')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    counterSignals: jsonb('counter_signals')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    novelty: noveltyKindEnum('novelty').notNull().default('new_to_world'),
    estimatedReadingMinutes: integer('estimated_reading_minutes').notNull().default(2),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    promptVersionId: uuid('prompt_version_id'),
    version: integer('version').notNull().default(1),
    /** Set when an upstream correction invalidates part of this insight. */
    needsReview: boolean('needs_review').notNull().default(false),
    reviewReason: text('review_reason').notNull().default(''),
    isDemo: boolean('is_demo').notNull().default(false),
    /** Generated tsvector, created by packages/database/sql/001_search.sql. */
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('insights_workspace_event_key').on(t.workspaceId, t.eventId),
    index('insights_workspace_idx').on(t.workspaceId, t.createdAt),
    index('insights_review_idx').on(t.needsReview),
  ],
);

/** Immutable history so a regenerated insight never rewrites what the user read. */
export const insightVersions = pgTable(
  'insight_versions',
  {
    id: id(),
    insightId: uuid('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    reason: text('reason').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('insight_versions_key').on(t.insightId, t.version)],
);

/** Insight → market-model concept. The Depth dimension, made queryable. */
export const learningConnections = pgTable(
  'learning_connections',
  {
    id: id(),
    insightId: uuid('insight_id').references(() => insights.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => learningConcepts.id, { onDelete: 'cascade' }),
    kind: learningConnectionKindEnum('kind').notNull().default('industry_concept'),
    /** One sentence on why this event touches this concept. */
    explanation: text('explanation').notNull().default(''),
    strength: doublePrecision('strength').notNull().default(0.5),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    createdAt: createdAt(),
  },
  (t) => [
    index('learning_connections_insight_idx').on(t.insightId),
    index('learning_connections_concept_idx').on(t.conceptId),
  ],
);

/** Insight → what to say next. The Applicability dimension, made queryable. */
export const conversationApplications = pgTable(
  'conversation_applications',
  {
    id: id(),
    insightId: uuid('insight_id').references(() => insights.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    kind: conversationApplicationKindEnum('kind').notNull(),
    text: text('text').notNull(),
    /** Claims this was built from — a starter with no basis is not shipped. */
    derivedFromClaimIds: jsonb('derived_from_claim_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    createdAt: createdAt(),
  },
  (t) => [index('conv_app_insight_idx').on(t.insightId, t.kind)],
);

/**
 * A tracked transformation case with an explicit maturity. The hype filter: the UI
 * always shows what was announced *and* what is actually evidenced.
 */
export const caseStudies = pgTable(
  'case_studies',
  {
    id: id(),
    title: text('title').notNull(),
    subjectEntityId: uuid('subject_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    providerEntityId: uuid('provider_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'set null' }),
    whatWasAnnounced: text('what_was_announced').notNull().default(''),
    whatWasImplemented: text('what_was_implemented').notNull().default(''),
    scope: text('scope').notNull().default(''),
    geographies: jsonb('geographies')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    functions: jsonb('functions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    maturity: caseMaturityEnum('maturity').notNull().default('ANNOUNCED'),
    reportedOutcomes: jsonb('reported_outcomes')
      .$type<{ metric: string; value: string; claimId: string | null }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    evidenceStrength: evidenceStrengthEnum('evidence_strength')
      .notNull()
      .default('COMPANY_SELF_REPORTING'),
    independentlyConfirmed: boolean('independently_confirmed').notNull().default(false),
    openQuestions: jsonb('open_questions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('case_studies_subject_idx').on(t.subjectEntityId),
    index('case_studies_maturity_idx').on(t.maturity),
  ],
);

export const caseStudyClaims = pgTable(
  'case_study_claims',
  {
    id: id(),
    caseStudyId: uuid('case_study_id')
      .notNull()
      .references(() => caseStudies.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('case_study_claims_key').on(t.caseStudyId, t.claimId)],
);

/** Per-user record of what has been shown, so "since your last visit" is truthful. */
export const insightImpressions = pgTable(
  'insight_impressions',
  {
    id: id(),
    insightId: uuid('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstShownAt: timestamp('first_shown_at', { withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    shownCount: integer('shown_count').notNull().default(1),
  },
  (t) => [uniqueIndex('insight_impressions_key').on(t.insightId, t.userId)],
);

export const claimsRelations = relations(claims, ({ one, many }) => ({
  documentVersion: one(documentVersions, {
    fields: [claims.documentVersionId],
    references: [documentVersions.id],
  }),
  source: one(sources, { fields: [claims.sourceId], references: [sources.id] }),
  evidence: many(claimEvidence),
  entities: many(claimEntities),
}));

export const claimEvidenceRelations = relations(claimEvidence, ({ one }) => ({
  claim: one(claims, { fields: [claimEvidence.claimId], references: [claims.id] }),
  span: one(evidenceSpans, {
    fields: [claimEvidence.evidenceSpanId],
    references: [evidenceSpans.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  claims: many(eventClaims),
  documents: many(eventDocuments),
  entities: many(eventEntities),
  taxonomy: many(eventTaxonomy),
  signals: many(signals),
  insights: many(insights),
}));

export const eventClaimsRelations = relations(eventClaims, ({ one }) => ({
  event: one(events, { fields: [eventClaims.eventId], references: [events.id] }),
  claim: one(claims, { fields: [eventClaims.claimId], references: [claims.id] }),
}));

export const eventEntitiesRelations = relations(eventEntities, ({ one }) => ({
  event: one(events, { fields: [eventEntities.eventId], references: [events.id] }),
  entity: one(entities, { fields: [eventEntities.entityId], references: [entities.id] }),
}));

export const insightsRelations = relations(insights, ({ one, many }) => ({
  event: one(events, { fields: [insights.eventId], references: [events.id] }),
  signal: one(signals, { fields: [insights.signalId], references: [signals.id] }),
  learningConnections: many(learningConnections),
  conversationApplications: many(conversationApplications),
}));

export const signalsRelations = relations(signals, ({ one }) => ({
  event: one(events, { fields: [signals.eventId], references: [events.id] }),
  trend: one(trends, { fields: [signals.trendId], references: [trends.id] }),
}));

export const learningConnectionsRelations = relations(learningConnections, ({ one }) => ({
  insight: one(insights, { fields: [learningConnections.insightId], references: [insights.id] }),
  concept: one(learningConcepts, {
    fields: [learningConnections.conceptId],
    references: [learningConcepts.id],
  }),
}));

export const conversationApplicationsRelations = relations(conversationApplications, ({ one }) => ({
  insight: one(insights, {
    fields: [conversationApplications.insightId],
    references: [insights.id],
  }),
}));
