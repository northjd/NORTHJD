/**
 * User-facing experience: briefs, library, learning progress, meetings, conversations.
 *
 * Note `dailyBriefs.state`: a brief is a *closed* object with a finite item list and a
 * completion state. That is the mechanism behind "You are caught up" — the brief is
 * not a query re-run on every page load, it is a decision made once per day that the
 * user can finish.
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
import {
  companionModeEnum,
  depthLevelEnum,
  feedbackKindEnum,
  generatorEnum,
  knowledgeEvidenceKindEnum,
  knowledgeStateEnum,
  notificationKindEnum,
} from './enums';
import { entities } from './entities';
import { insights } from './intelligence';
import { learningConcepts, learningUnits } from './taxonomy';
import { users, workspaces } from './tenancy';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * One brief per user per day. `readingBudgetMinutes` is the constraint the composer
 * must satisfy; `state` moves open → completed and never reopens with new items.
 */
export const dailyBriefs = pgTable(
  'daily_briefs',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Local calendar day this brief belongs to, as YYYY-MM-DD. */
    briefDate: varchar('brief_date', { length: 10 }).notNull(),
    readingBudgetMinutes: integer('reading_budget_minutes').notNull().default(12),
    estimatedMinutes: integer('estimated_minutes').notNull().default(0),
    /** open | completed */
    state: varchar('state', { length: 20 }).notNull().default('open'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Cut-off used for "what changed since your last visit". */
    sinceAt: timestamp('since_at', { withTimezone: true }),
    /** Composition audit: how the exploration budget was actually spent. */
    compositionNote: jsonb('composition_note')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    coverageNote: text('coverage_note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('daily_briefs_user_date_key').on(t.userId, t.workspaceId, t.briefDate),
    index('daily_briefs_user_idx').on(t.userId, t.createdAt),
  ],
);

export const briefItems = pgTable(
  'brief_items',
  {
    id: id(),
    briefId: uuid('brief_id')
      .notNull()
      .references(() => dailyBriefs.id, { onDelete: 'cascade' }),
    insightId: uuid('insight_id').references(() => insights.id, { onDelete: 'cascade' }),
    learningUnitId: uuid('learning_unit_id').references(() => learningUnits.id, {
      onDelete: 'cascade',
    }),
    /**
     * executive_three | what_changed | industry_signals | company_watch | tech_radar |
     * broader_market | adjacent_signal | learn_one_thing | deep_dive | prepare_next
     */
    section: varchar('section', { length: 40 }).notNull(),
    position: integer('position').notNull().default(0),
    score: doublePrecision('score').notNull().default(0),
    /** Human-readable answer to "why am I seeing this?" — assembled, not generated. */
    whyShown: jsonb('why_shown')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    estimatedMinutes: integer('estimated_minutes').notNull().default(2),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  },
  (t) => [
    index('brief_items_brief_idx').on(t.briefId, t.section, t.position),
    uniqueIndex('brief_items_brief_insight_key').on(t.briefId, t.insightId),
  ],
);

/** Reflection signals. These drive personalisation *and* the knowledge state. */
export const userFeedback = pgTable(
  'user_feedback',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    insightId: uuid('insight_id').references(() => insights.id, { onDelete: 'cascade' }),
    learningUnitId: uuid('learning_unit_id').references(() => learningUnits.id, {
      onDelete: 'cascade',
    }),
    kind: feedbackKindEnum('kind').notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    index('user_feedback_user_idx').on(t.userId, t.createdAt),
    index('user_feedback_insight_idx').on(t.insightId),
  ],
);

/**
 * A cautious per-concept estimate with its reasoning attached. The user can see and
 * override every row; `userAsserted` wins over anything the system inferred.
 */
export const userKnowledgeStates = pgTable(
  'user_knowledge_states',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => learningConcepts.id, { onDelete: 'cascade' }),
    state: knowledgeStateEnum('state').notNull().default('unseen'),
    /** 0–1 confidence in the estimate itself. Never presented as certainty. */
    confidence: doublePrecision('confidence').notNull().default(0.3),
    userAsserted: boolean('user_asserted').notNull().default(false),
    lastEvidenceKind: knowledgeEvidenceKindEnum('last_evidence_kind'),
    reason: text('reason').notNull().default(''),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),
    /** When spaced resurfacing should bring this back. */
    reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('uks_key').on(t.userId, t.workspaceId, t.conceptId),
    index('uks_review_idx').on(t.userId, t.reviewDueAt),
  ],
);

export const userLearningProgress = pgTable(
  'user_learning_progress',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    learningUnitId: uuid('learning_unit_id')
      .notNull()
      .references(() => learningUnits.id, { onDelete: 'cascade' }),
    /** not_started | in_progress | completed */
    status: varchar('status', { length: 20 }).notNull().default('not_started'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('ulp_key').on(t.userId, t.workspaceId, t.learningUnitId)],
);

export const knowledgeCheckResults = pgTable(
  'knowledge_check_results',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    learningUnitId: uuid('learning_unit_id')
      .notNull()
      .references(() => learningUnits.id, { onDelete: 'cascade' }),
    selectedIndex: integer('selected_index').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('kcr_user_idx').on(t.userId, t.learningUnitId)],
);

// ── Library ──────────────────────────────────────────────────────────────────

export const collections = pgTable(
  'collections',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    isShared: boolean('is_shared').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('collections_ws_idx').on(t.workspaceId, t.userId)],
);

export const collectionItems = pgTable(
  'collection_items',
  {
    id: id(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    /** insight | note | learning_unit | meeting_brief | conversation | entity */
    itemKind: varchar('item_kind', { length: 30 }).notNull(),
    itemId: uuid('item_id').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('collection_items_key').on(t.collectionId, t.itemKind, t.itemId)],
);

export const savedInsights = pgTable(
  'saved_insights',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    insightId: uuid('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('saved_insights_key').on(t.userId, t.insightId)],
);

/**
 * Personal notes. Stored separately from claims and never mixed into "verified facts"
 * — a user's own thinking must not be laundered into evidence.
 */
export const notes = pgTable(
  'notes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull().default(''),
    body: text('body').notNull(),
    /** insight | entity | industry | conversation | meeting | null */
    attachedKind: varchar('attached_kind', { length: 30 }),
    attachedId: uuid('attached_id'),
    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('notes_user_idx').on(t.userId, t.createdAt),
    index('notes_attached_idx').on(t.attachedKind, t.attachedId),
  ],
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    query: text('query').notNull().default(''),
    filters: jsonb('filters')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notifyOnMatch: boolean('notify_on_match').notNull().default(false),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('saved_searches_user_idx').on(t.userId)],
);

export const followedEntities = pgTable(
  'followed_entities',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('followed_entities_key').on(t.userId, t.entityId)],
);

export const followedTopics = pgTable(
  'followed_topics',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** topic | industry | technology */
    kind: varchar('kind', { length: 20 }).notNull().default('topic'),
    slug: varchar('slug', { length: 140 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('followed_topics_key').on(t.userId, t.kind, t.slug)],
);

// ── Meetings ─────────────────────────────────────────────────────────────────

export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    companyEntityId: uuid('company_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    companyName: varchar('company_name', { length: 300 }).notNull().default(''),
    objective: text('objective').notNull().default(''),
    meetingAt: timestamp('meeting_at', { withTimezone: true }),
    attendees: jsonb('attendees')
      .$type<{ name: string; role: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    topics: jsonb('topics')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    competitorNames: jsonb('competitor_names')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    technologyNames: jsonb('technology_names')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    personalNotes: text('personal_notes').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('meetings_user_idx').on(t.userId, t.meetingAt)],
);

export const meetingBriefs = pgTable(
  'meeting_briefs',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    depth: depthLevelEnum('depth').notNull().default('executive'),
    lookbackDays: integer('lookback_days').notNull().default(90),
    /** Validated `MeetingBriefContent`. Citations resolve to claims and spans. */
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    generator: generatorEnum('generator').notNull().default('deterministic_extractive'),
    asOf: timestamp('as_of', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index('meeting_briefs_meeting_idx').on(t.meetingId, t.createdAt)],
);

// ── Companion ────────────────────────────────────────────────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull().default(''),
    mode: companionModeEnum('mode').notNull().default('explore_it'),
    /** True when at least one turn came from voice input. */
    hadVoice: boolean('had_voice').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('conversations_user_idx').on(t.userId, t.updatedAt)],
);

export const conversationTurns = pgTable(
  'conversation_turns',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    /** user | assistant */
    role: varchar('role', { length: 12 }).notNull(),
    text: text('text').notNull(),
    /** Full validated `CompanionResponse` for assistant turns. */
    structured: jsonb('structured')
      .$type<Record<string, unknown> | null>()
      .default(sql`'null'::jsonb`),
    mode: companionModeEnum('mode'),
    depth: depthLevelEnum('depth'),
    generator: generatorEnum('generator'),
    /** Which context objects the answer actually used. */
    contextUsed: jsonb('context_used')
      .$type<{ kind: string; id: string; label: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    inputMode: varchar('input_mode', { length: 12 }).notNull().default('text'),
    latencyMs: integer('latency_ms'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('conversation_turns_key').on(t.conversationId, t.position)],
);

/**
 * A voice session. Audio is not stored unless VOICE_PERSIST_AUDIO is explicitly on;
 * the transcript is personal data and is deletable with the conversation.
 */
export const voiceSessions = pgTable(
  'voice_sessions',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** browser | deepgram | none — recorded so the transcript's provenance is clear. */
    sttProvider: varchar('stt_provider', { length: 30 }).notNull().default('browser'),
    ttsProvider: varchar('tts_provider', { length: 30 }).notNull().default('browser'),
    audioPersisted: boolean('audio_persisted').notNull().default(false),
    itemsPlanned: integer('items_planned').notNull().default(0),
    itemsCompleted: integer('items_completed').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('voice_sessions_user_idx').on(t.userId, t.startedAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body').notNull().default(''),
    href: text('href').notNull().default(''),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Feedback about the product itself, as opposed to feedback about an insight.
 *
 * A separate table from `user_feedback` on purpose. That one records reactions to
 * *content* — "already knew this", "changed my view" — and is an input to ranking.
 * Mixing "the filters are confusing" into the same rows would corrupt the ranking signal
 * and lose the product feedback among thousands of content reactions.
 *
 * `route` and `userAgent` are captured because the single most common failure of a
 * feedback box is a report nobody can reproduce.
 */
export const productFeedback = pgTable(
  'product_feedback',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** confusing | broken | idea | praise | other */
    kind: varchar('kind', { length: 32 }).notNull().default('other'),
    message: text('message').notNull(),
    /** Where they were when they wrote it. */
    route: varchar('route', { length: 300 }).notNull().default(''),
    userAgent: varchar('user_agent', { length: 400 }).notNull().default(''),
    /** Set once someone has read it, so the list is a queue rather than a pile. */
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('product_feedback_created_idx').on(t.createdAt)],
);

export const dailyBriefsRelations = relations(dailyBriefs, ({ many, one }) => ({
  items: many(briefItems),
  user: one(users, { fields: [dailyBriefs.userId], references: [users.id] }),
}));

export const briefItemsRelations = relations(briefItems, ({ one }) => ({
  brief: one(dailyBriefs, { fields: [briefItems.briefId], references: [dailyBriefs.id] }),
  insight: one(insights, { fields: [briefItems.insightId], references: [insights.id] }),
  learningUnit: one(learningUnits, {
    fields: [briefItems.learningUnitId],
    references: [learningUnits.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  turns: many(conversationTurns),
  voiceSessions: many(voiceSessions),
}));

export const conversationTurnsRelations = relations(conversationTurns, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationTurns.conversationId],
    references: [conversations.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ many, one }) => ({
  briefs: many(meetingBriefs),
  company: one(entities, { fields: [meetings.companyEntityId], references: [entities.id] }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  items: many(collectionItems),
}));
