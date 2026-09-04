/**
 * Operations: pipeline runs, prompt/model versioning, evaluation, audit.
 *
 * Every AI output in the product carries a `promptVersionId` and a model
 * configuration, so a regression can be traced to the change that caused it and the
 * evaluation suite can compare versions rather than vibes.
 */

import { relations, sql } from 'drizzle-orm';
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
import { pipelineStageEnum, runStatusEnum } from './enums';
import { users, workspaces } from './tenancy';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    /** full | ingest_only | rebuild_insights | single_source */
    kind: varchar('kind', { length: 40 }).notNull().default('full'),
    status: runStatusEnum('status').notNull().default('running'),
    trigger: varchar('trigger', { length: 40 }).notNull().default('manual'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Aggregate counters, shown on the admin pipeline page. */
    stats: jsonb('stats')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    error: text('error').notNull().default(''),
    /** Actual model spend for this run, in USD. Zero for the extractive generator. */
    costUsd: doublePrecision('cost_usd').notNull().default(0),
  },
  (t) => [index('pipeline_runs_started_idx').on(t.startedAt)],
);

export const pipelineStageRuns = pgTable(
  'pipeline_stage_runs',
  {
    id: id(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    stage: pipelineStageEnum('stage').notNull(),
    status: runStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    itemsIn: integer('items_in').notNull().default(0),
    itemsOut: integer('items_out').notNull().default(0),
    itemsRejected: integer('items_rejected').notNull().default(0),
    /** Why items were rejected — schema failure, missing evidence, rights block. */
    rejectionReasons: jsonb('rejection_reasons')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    error: text('error').notNull().default(''),
  },
  (t) => [index('pipeline_stage_runs_run_idx').on(t.runId, t.stage)],
);

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: id(),
    /** claim_extraction | insight_generation | companion_answer | … */
    name: varchar('name', { length: 100 }).notNull(),
    version: integer('version').notNull(),
    template: text('template').notNull(),
    /** Hash of the template, so an edit without a version bump is detectable. */
    templateHash: varchar('template_hash', { length: 32 }).notNull(),
    notes: text('notes').notNull().default(''),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('prompt_versions_key').on(t.name, t.version)],
);

export const modelConfigurations = pgTable(
  'model_configurations',
  {
    id: id(),
    /** deterministic | anthropic | … */
    provider: varchar('provider', { length: 40 }).notNull(),
    model: varchar('model', { length: 100 }).notNull().default(''),
    parameters: jsonb('parameters')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('model_configurations_active_idx').on(t.isActive)],
);

/**
 * Golden test cases. Each one encodes a failure mode we care about: duplicated
 * stories, conflicting reports, ambiguous company names, first-party marketing
 * claims, insufficient-evidence questions, consulting queries that must not receive a
 * ranking advantage.
 */
export const evaluationCases = pgTable(
  'evaluation_cases',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    /** entity_resolution | claim_extraction | evidence_support | dedup | ranking_neutrality | … */
    suite: varchar('suite', { length: 60 }).notNull(),
    name: varchar('name', { length: 300 }).notNull(),
    description: text('description').notNull().default(''),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    expectation: jsonb('expectation').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('evaluation_cases_slug_key').on(t.slug),
    index('evaluation_cases_suite_idx').on(t.suite),
  ],
);

export const evaluationResults = pgTable(
  'evaluation_results',
  {
    id: id(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => evaluationCases.id, { onDelete: 'cascade' }),
    runId: uuid('run_id'),
    passed: boolean('passed').notNull(),
    score: doublePrecision('score').notNull().default(0),
    detail: jsonb('detail')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    promptVersionId: uuid('prompt_version_id').references(() => promptVersions.id, {
      onDelete: 'set null',
    }),
    generator: varchar('generator', { length: 40 }).notNull().default('deterministic_extractive'),
    createdAt: createdAt(),
  },
  (t) => [index('evaluation_results_case_idx').on(t.caseId, t.createdAt)],
);

/** Append-only. Every manual admin change and every sensitive user action lands here. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** source.policy.update | event.merge | insight.suppress | data.export | … */
    action: varchar('action', { length: 80 }).notNull(),
    targetKind: varchar('target_kind', { length: 40 }).notNull().default(''),
    targetId: varchar('target_id', { length: 100 }).notNull().default(''),
    /** Before/after for the changed fields only. Never contains secrets. */
    detail: jsonb('detail')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_ws_idx').on(t.workspaceId, t.createdAt),
    index('audit_log_target_idx').on(t.targetKind, t.targetId),
  ],
);

/** Per-call model usage, so AI cost is observable rather than estimated. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: id(),
    runId: uuid('run_id').references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 60 }).notNull(),
    provider: varchar('provider', { length: 40 }).notNull(),
    model: varchar('model', { length: 100 }).notNull().default(''),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    succeeded: boolean('succeeded').notNull().default(true),
    error: text('error').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_run_idx').on(t.runId, t.createdAt)],
);

export const pipelineRunsRelations = relations(pipelineRuns, ({ many }) => ({
  stages: many(pipelineStageRuns),
  usage: many(aiUsage),
}));

export const pipelineStageRunsRelations = relations(pipelineStageRuns, ({ one }) => ({
  run: one(pipelineRuns, { fields: [pipelineStageRuns.runId], references: [pipelineRuns.id] }),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
  case: one(evaluationCases, {
    fields: [evaluationResults.caseId],
    references: [evaluationCases.id],
  }),
}));
