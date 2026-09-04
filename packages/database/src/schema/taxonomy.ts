/**
 * Market taxonomy — the Market Model layer.
 *
 * This is the durable half of the product. Events come and go; the value chain,
 * business models, KPIs and capabilities of an industry change slowly, and they are
 * what lets the platform say "this announcement touches *this* part of *this* market"
 * instead of merely summarising it.
 *
 * Everything here is workspace-scoped but seeded globally: a workspace starts from the
 * shared taxonomy and may extend it.
 */

import { relations, sql } from 'drizzle-orm';
import { tsvector } from './tsvector';
import {
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
import { depthLevelEnum, operatingModelDimensionEnum, valueLeverEnum } from './enums';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const industries = pgTable(
  'industries',
  {
    id: id(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    parentId: uuid('parent_id'),
    definition: text('definition').notNull().default(''),
    /** How the industry earns money, at executive level. */
    marketStructure: text('market_structure').notNull().default(''),
    regulatoryEnvironment: text('regulatory_environment').notNull().default(''),
    transformationAgenda: text('transformation_agenda').notNull().default(''),
    /** Questions the platform cannot currently answer for this industry. */
    openQuestions: jsonb('open_questions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sourceRefs: jsonb('source_refs')
      .$type<{ label: string; url: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('industries_slug_key').on(t.slug),
    index('industries_parent_idx').on(t.parentId),
  ],
);

/** A stage in an industry's value chain, ordered from upstream to downstream. */
export const valueChainStages = pgTable(
  'value_chain_stages',
  {
    id: id(),
    industryId: uuid('industry_id')
      .notNull()
      .references(() => industries.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    position: integer('position').notNull().default(0),
    description: text('description').notNull().default(''),
    /** Where margin actually sits. The honest answer is often "we don't know". */
    profitPoolNote: text('profit_pool_note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('vcs_slug_key').on(t.slug), index('vcs_industry_idx').on(t.industryId)],
);

export const businessModels = pgTable(
  'business_models',
  {
    id: id(),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    /** How this model makes money, and what breaks it. */
    economics: text('economics').notNull().default(''),
    exampleCompanyNames: jsonb('example_company_names')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('bm_slug_key').on(t.slug)],
);

export const kpis = pgTable(
  'kpis',
  {
    id: id(),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    definition: text('definition').notNull().default(''),
    formula: text('formula').notNull().default(''),
    /** Why an executive cares. This is what makes a KPI teachable. */
    whyItMatters: text('why_it_matters').notNull().default(''),
    /** Parent in the KPI tree, e.g. gross margin → markdown rate. */
    parentId: uuid('parent_id'),
    valueLever: valueLeverEnum('value_lever'),
    typicalRange: varchar('typical_range', { length: 200 }).notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('kpis_slug_key').on(t.slug), index('kpis_industry_idx').on(t.industryId)],
);

export const capabilities = pgTable(
  'capabilities',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    /** Which value chain stage this capability serves. */
    valueChainStageId: uuid('value_chain_stage_id').references(() => valueChainStages.id, {
      onDelete: 'set null',
    }),
    operatingModelDimensions: jsonb('operating_model_dimensions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('capabilities_slug_key').on(t.slug)],
);

export const technologies = pgTable(
  'technologies',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    /** infrastructure | model | platform | application | tooling */
    layer: varchar('layer', { length: 60 }).notNull().default('application'),
    /** Capabilities this technology can enable — a claim we must not overstate. */
    enablesCapabilitySlugs: jsonb('enables_capability_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('technologies_slug_key').on(t.slug)],
);

export const topics = pgTable(
  'topics',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('topics_slug_key').on(t.slug)],
);

export const geographies = pgTable(
  'geographies',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    /** ISO-3166 alpha-2 where applicable; null for regions like EMEA. */
    isoCode: varchar('iso_code', { length: 2 }),
    parentId: uuid('parent_id'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('geographies_slug_key').on(t.slug)],
);

/**
 * The unit of learning and of knowledge state. A concept is deliberately separate from
 * a learning unit: several units at different depths can teach one concept, and the
 * user's knowledge state attaches to the concept.
 */
export const learningConcepts = pgTable(
  'learning_concepts',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    summary: text('summary').notNull().default(''),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'set null' }),
    /** industry_concept | kpi | capability | business_model | value_chain_stage | technology | trend | operating_model_dimension */
    kind: varchar('kind', { length: 60 }).notNull().default('industry_concept'),
    /** Slug of the taxonomy row this concept mirrors, when it mirrors one. */
    refSlug: varchar('ref_slug', { length: 120 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('learning_concepts_slug_key').on(t.slug),
    index('lc_industry_idx').on(t.industryId),
  ],
);

export const learningConceptRelationships = pgTable(
  'learning_concept_relationships',
  {
    id: id(),
    fromConceptId: uuid('from_concept_id')
      .notNull()
      .references(() => learningConcepts.id, { onDelete: 'cascade' }),
    toConceptId: uuid('to_concept_id')
      .notNull()
      .references(() => learningConcepts.id, { onDelete: 'cascade' }),
    /** prerequisite_of | related_to | measured_by | enabled_by */
    kind: varchar('kind', { length: 60 }).notNull().default('related_to'),
  },
  (t) => [uniqueIndex('lcr_key').on(t.fromConceptId, t.toConceptId, t.kind)],
);

export const learningPaths = pgTable(
  'learning_paths',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    industryId: uuid('industry_id').references(() => industries.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('learning_paths_slug_key').on(t.slug)],
);

/**
 * Evergreen content. Versioned and dated because "how fashion retail makes money" is
 * only trustworthy if the reader can see when it was last reviewed.
 */
export const learningUnits = pgTable(
  'learning_units',
  {
    id: id(),
    pathId: uuid('path_id').references(() => learningPaths.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id').references(() => learningConcepts.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    depth: depthLevelEnum('depth').notNull().default('executive'),
    position: integer('position').notNull().default(0),
    objective: text('objective').notNull().default(''),
    explanation: text('explanation').notNull().default(''),
    /** Structured model: headings → bullet points. Rendered, never free-form HTML. */
    structuredModel: jsonb('structured_model')
      .$type<{ heading: string; points: string[] }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    keyTerms: jsonb('key_terms')
      .$type<{ term: string; definition: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    coreMetricSlugs: jsonb('core_metric_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    exampleCompanyNames: jsonb('example_company_names')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    commonMisconceptions: jsonb('common_misconceptions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    practicalQuestions: jsonb('practical_questions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sourceRefs: jsonb('source_refs')
      .$type<{ label: string; url: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    knowledgeCheck: jsonb('knowledge_check')
      .$type<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      } | null>()
      .default(sql`'null'::jsonb`),
    estimatedMinutes: integer('estimated_minutes').notNull().default(5),
    version: integer('version').notNull().default(1),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    /** Generated tsvector, created by packages/database/sql/001_search.sql. */
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('learning_units_slug_key').on(t.slug),
    index('lu_path_idx').on(t.pathId, t.position),
    index('lu_concept_idx').on(t.conceptId),
  ],
);

// ── Relations ────────────────────────────────────────────────────────────────

export const industriesRelations = relations(industries, ({ many, one }) => ({
  parent: one(industries, {
    fields: [industries.parentId],
    references: [industries.id],
    relationName: 'industry_parent',
  }),
  children: many(industries, { relationName: 'industry_parent' }),
  valueChainStages: many(valueChainStages),
  kpis: many(kpis),
  businessModels: many(businessModels),
  learningPaths: many(learningPaths),
}));

export const valueChainStagesRelations = relations(valueChainStages, ({ one, many }) => ({
  industry: one(industries, { fields: [valueChainStages.industryId], references: [industries.id] }),
  capabilities: many(capabilities),
}));

export const kpisRelations = relations(kpis, ({ one }) => ({
  industry: one(industries, { fields: [kpis.industryId], references: [industries.id] }),
  parent: one(kpis, { fields: [kpis.parentId], references: [kpis.id], relationName: 'kpi_parent' }),
}));

export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  industry: one(industries, { fields: [learningPaths.industryId], references: [industries.id] }),
  units: many(learningUnits),
}));

export const learningUnitsRelations = relations(learningUnits, ({ one }) => ({
  path: one(learningPaths, { fields: [learningUnits.pathId], references: [learningPaths.id] }),
  concept: one(learningConcepts, {
    fields: [learningUnits.conceptId],
    references: [learningConcepts.id],
  }),
}));

export const capabilitiesRelations = relations(capabilities, ({ one }) => ({
  valueChainStage: one(valueChainStages, {
    fields: [capabilities.valueChainStageId],
    references: [valueChainStages.id],
  }),
}));

export const operatingModelDimensionValues = operatingModelDimensionEnum;
