/**
 * Identity, tenancy and personalisation.
 *
 * Every user-owned row carries `workspace_id`. Repositories take a workspace-scoped
 * context and there is no query path that omits it — this is what makes the later
 * enterprise story (teams, shared collections, permission-aware internal sources)
 * possible without a migration of the whole model.
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
  depthLevelEnum,
  membershipRoleEnum,
  notificationKindEnum,
  watchlistKindEnum,
} from './enums';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable(
  'organizations',
  {
    id: id(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('organizations_slug_key').on(t.slug)],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    /**
     * Optional "my firm" preference. A user preference only — nothing in ranking,
     * ingestion or the information architecture may branch on this value.
     */
    homeFirmEntityId: uuid('home_firm_entity_id'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('workspaces_slug_key').on(t.slug),
    index('workspaces_org_idx').on(t.organizationId),
  ],
);

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 200 }).notNull().default(''),
    /** scrypt, stored as `scrypt$N$r$p$salt$hash`. Never a plain hash. */
    passwordHash: text('password_hash').notNull(),
    /** Interface language. Content language preference lives in preferences. */
    locale: varchar('locale', { length: 10 }).notNull().default('en'),
    isDemo: boolean('is_demo').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_user_workspace_key').on(t.userId, t.workspaceId),
    index('memberships_workspace_idx').on(t.workspaceId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the token. The token itself is only ever in the user's cookie. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

/**
 * Baseline profile — long-lived interests and learning goals. Distinct from
 * `userMissions`, which are temporary and must never overwrite this.
 */
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 120 }).notNull().default(''),
    seniority: varchar('seniority', { length: 60 }).notNull().default(''),
    industrySlugs: jsonb('industry_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    functionSlugs: jsonb('function_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    technologySlugs: jsonb('technology_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    topicSlugs: jsonb('topic_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    geographySlugs: jsonb('geography_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    informationGoals: jsonb('information_goals')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    learningObjectives: jsonb('learning_objectives')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Minutes per day the brief must fit inside. The brief is finite because of this. */
    dailyReadingMinutes: integer('daily_reading_minutes').notNull().default(12),
    preferredDepth: depthLevelEnum('preferred_depth').notNull().default('executive'),
    /** Language the user wants answers in; sources stay in their original language. */
    responseLanguage: varchar('response_language', { length: 10 }).notNull().default('en'),
    keepOriginalTerms: boolean('keep_original_terms').notNull().default(true),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('user_profiles_user_workspace_key').on(t.userId, t.workspaceId)],
);

/**
 * Mission Mode — a temporary emphasis with an expiry. Ranking blends it with the
 * baseline profile at a configurable weight rather than replacing it.
 */
export const userMissions = pgTable(
  'user_missions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    industrySlugs: jsonb('industry_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    topicSlugs: jsonb('topic_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    technologySlugs: jsonb('technology_slugs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    entityIds: jsonb('entity_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    isPaused: boolean('is_paused').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('user_missions_user_idx').on(t.userId, t.workspaceId)],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** Minimum personal relevance 0–1 before a high-impact alert may fire. */
    threshold: integer('threshold').notNull().default(70),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('notif_pref_key').on(t.userId, t.workspaceId, t.kind)],
);

export const watchlists = pgTable(
  'watchlists',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null for shared/team watchlists. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    kind: watchlistKindEnum('kind').notNull().default('company'),
    isShared: boolean('is_shared').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('watchlists_workspace_idx').on(t.workspaceId, t.userId)],
);

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: id(),
    watchlistId: uuid('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    /** Exactly one of these is set. */
    entityId: uuid('entity_id'),
    industrySlug: varchar('industry_slug', { length: 120 }),
    topicSlug: varchar('topic_slug', { length: 120 }),
    technologySlug: varchar('technology_slug', { length: 120 }),
    /** account | prospect | competitor | interest — colours the "why am I seeing this". */
    relationship: varchar('relationship', { length: 40 }).notNull().default('interest'),
    createdAt: createdAt(),
  },
  (t) => [index('watchlist_items_list_idx').on(t.watchlistId)],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  workspaces: many(workspaces),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  memberships: many(memberships),
  watchlists: many(watchlists),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  profiles: many(userProfiles),
  missions: many(userMissions),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [memberships.workspaceId], references: [workspaces.id] }),
}));

export const watchlistsRelations = relations(watchlists, ({ many, one }) => ({
  items: many(watchlistItems),
  workspace: one(workspaces, { fields: [watchlists.workspaceId], references: [workspaces.id] }),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, { fields: [watchlistItems.watchlistId], references: [watchlists.id] }),
}));
