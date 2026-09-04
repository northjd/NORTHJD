/**
 * Entities and the pragmatic knowledge graph.
 *
 * Relational tables, not a graph database — the relationship types we need are known
 * and few, and PostgreSQL joins handle them at this scale. Revisit only with evidence
 * that traversal depth actually demands it (see ADR 0002).
 */

import { relations, sql } from 'drizzle-orm';
import { tsvector } from './tsvector';
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
import { entityKindEnum } from './enums';
import { industries } from './taxonomy';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * One row per real-world organisation, person or product. A consulting firm is an
 * entity with `kind = 'consulting_firm'` and gets no special treatment anywhere —
 * that is the whole mechanism behind "Accenture is not the product foundation".
 */
export const entities = pgTable(
  'entities',
  {
    id: id(),
    kind: entityKindEnum('kind').notNull().default('company'),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 300 }).notNull(),
    legalName: varchar('legal_name', { length: 300 }).notNull().default(''),
    description: text('description').notNull().default(''),
    /** Stable external identifiers, for entity resolution across sources. */
    officialDomain: varchar('official_domain', { length: 253 }).notNull().default(''),
    ticker: varchar('ticker', { length: 20 }).notNull().default(''),
    lei: varchar('lei', { length: 20 }).notNull().default(''),
    cik: varchar('cik', { length: 20 }).notNull().default(''),
    registrationNumber: varchar('registration_number', { length: 60 }).notNull().default(''),
    headquartersGeographySlug: varchar('hq_geography_slug', { length: 120 }).notNull().default(''),
    primaryIndustryId: uuid('primary_industry_id').references(() => industries.id, {
      onDelete: 'set null',
    }),
    businessModelSlug: varchar('business_model_slug', { length: 120 }).notNull().default(''),
    /** Only what a public source states. Never inferred financials. */
    publicProfile: jsonb('public_profile')
      .$type<{ label: string; value: string; sourceUrl: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isDemo: boolean('is_demo').notNull().default(false),
    /** Generated tsvector, created by packages/database/sql/001_search.sql. */
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('entities_slug_key').on(t.slug),
    index('entities_kind_idx').on(t.kind),
    index('entities_domain_idx').on(t.officialDomain),
    index('entities_name_idx').on(t.name),
  ],
);

/**
 * Aliases drive entity resolution: "H&M", "Hennes & Mauritz", "HM.B", "H&M Group".
 * Without this, multilingual and abbreviated mentions fragment a company's timeline.
 */
export const entityAliases = pgTable(
  'entity_aliases',
  {
    id: id(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    alias: varchar('alias', { length: 300 }).notNull(),
    /** Lower-cased, punctuation-stripped form actually used for matching. */
    normalized: varchar('normalized', { length: 300 }).notNull(),
    language: varchar('language', { length: 10 }).notNull().default('en'),
    /** legal | trade | ticker | abbreviation | transliteration | former */
    aliasType: varchar('alias_type', { length: 40 }).notNull().default('trade'),
    /**
     * Ambiguous aliases ("Meta", "Shein" inside other words) require a co-occurring
     * signal before they resolve. Prevents the classic false-positive timeline.
     */
    requiresContext: boolean('requires_context').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('entity_aliases_norm_key').on(t.normalized, t.entityId),
    index('entity_aliases_norm_idx').on(t.normalized),
  ],
);

/** Company ↔ industry, many-to-many, because most companies span several. */
export const entityIndustries = pgTable(
  'entity_industries',
  {
    id: id(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    industryId: uuid('industry_id')
      .notNull()
      .references(() => industries.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [uniqueIndex('entity_industries_key').on(t.entityId, t.industryId)],
);

/**
 * Typed edges between entities. Every edge carries the claim it was derived from, so
 * "X partners with Y" is never an unsourced assertion in the graph.
 */
export const entityRelationships = pgTable(
  'entity_relationships',
  {
    id: id(),
    fromEntityId: uuid('from_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    toEntityId: uuid('to_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    /** partners_with | competes_with | acquired | invested_in | supplies | client_of */
    kind: varchar('kind', { length: 60 }).notNull(),
    /** The claim that evidences this edge. Null only for seeded reference data. */
    claimId: uuid('claim_id'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    note: text('note').notNull().default(''),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('entity_rel_from_idx').on(t.fromEntityId, t.kind),
    index('entity_rel_to_idx').on(t.toEntityId, t.kind),
  ],
);

/** People, only ever with publicly stated roles. No private or speculative data. */
export const entityPeople = pgTable(
  'entity_people',
  {
    id: id(),
    personEntityId: uuid('person_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    organizationEntityId: uuid('organization_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 200 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    sourceUrl: text('source_url').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('entity_people_org_idx').on(t.organizationEntityId)],
);

/** Products and offerings a company has publicly announced. */
export const offerings = pgTable(
  'offerings',
  {
    id: id(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 300 }).notNull(),
    description: text('description').notNull().default(''),
    /** Capabilities the offering claims to address — a claim, not a verified fact. */
    addressesCapabilitySlugs: jsonb('addresses_capability_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    announcedAt: timestamp('announced_at', { withTimezone: true }),
    claimId: uuid('claim_id'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('offerings_entity_idx').on(t.entityId)],
);

/**
 * Per-workspace coverage note for an entity: what we monitor about it and, more
 * importantly, what we do not. Rendered on the company page so a thin timeline reads
 * as "we watch three sources" rather than "nothing happened".
 */
export const entityCoverage = pgTable(
  'entity_coverage',
  {
    id: id(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    monitoredSourceCount: integer('monitored_source_count').notNull().default(0),
    firstPartySourceCount: integer('first_party_source_count').notNull().default(0),
    independentSourceCount: integer('independent_source_count').notNull().default(0),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    knownGaps: jsonb('known_gaps')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('entity_coverage_entity_key').on(t.entityId)],
);

export const entitiesRelations = relations(entities, ({ many, one }) => ({
  aliases: many(entityAliases),
  industries: many(entityIndustries),
  offerings: many(offerings),
  primaryIndustry: one(industries, {
    fields: [entities.primaryIndustryId],
    references: [industries.id],
  }),
  coverage: one(entityCoverage, {
    fields: [entities.id],
    references: [entityCoverage.entityId],
  }),
}));

export const entityAliasesRelations = relations(entityAliases, ({ one }) => ({
  entity: one(entities, { fields: [entityAliases.entityId], references: [entities.id] }),
}));

export const entityIndustriesRelations = relations(entityIndustries, ({ one }) => ({
  entity: one(entities, { fields: [entityIndustries.entityId], references: [entities.id] }),
  industry: one(industries, { fields: [entityIndustries.industryId], references: [industries.id] }),
}));
