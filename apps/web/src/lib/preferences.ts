'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';

/**
 * Reading and writing what the product is supposed to be about for one person.
 *
 * Ranking already consumes every one of these fields; until now nothing could set them,
 * so a new account got a brief assembled for somebody else's interests. That is the gap
 * this closes.
 *
 * Watchlist entities are stored as a real watchlist rather than a list of slugs on the
 * profile, because the rest of the product already reads watchlists — "quiet on your
 * watchlist" on Watch, the account fallback on My client, the saved views in Explore.
 * Writing to a second place would have meant two definitions of "my companies".
 */

export interface PreferenceOptions {
  industries: { slug: string; name: string }[];
  topics: { slug: string; name: string }[];
  technologies: { slug: string; name: string }[];
  entities: { slug: string; name: string; events: number }[];
}

export async function preferenceOptions(): Promise<PreferenceOptions> {
  const [industries, topics, technologies, entityRows] = [
    await db()
      .select({ slug: schema.industries.slug, name: schema.industries.name })
      .from(schema.industries)
      .orderBy(asc(schema.industries.name)),
    await db()
      .select({ slug: schema.topics.slug, name: schema.topics.name })
      .from(schema.topics)
      .orderBy(asc(schema.topics.name)),
    await db()
      .select({ slug: schema.technologies.slug, name: schema.technologies.name })
      .from(schema.technologies)
      .orderBy(asc(schema.technologies.name)),
    await db()
      .select({ slug: schema.entities.slug, name: schema.entities.name })
      .from(schema.entities)
      .orderBy(asc(schema.entities.name)),
  ];

  return {
    industries,
    topics,
    technologies,
    // Coverage counts are deliberately not shown during onboarding: picking companies by
    // how much we already have would tell the user what we cover rather than learning
    // what they care about, and the gap between the two is information we want.
    entities: entityRows.map((e) => ({ ...e, events: 0 })),
  };
}

export interface CurrentPreferences {
  role: string;
  industrySlugs: string[];
  topicSlugs: string[];
  technologySlugs: string[];
  entitySlugs: string[];
  dailyReadingMinutes: number;
  preferredDepth: 'foundation' | 'executive' | 'expert';
  onboarded: boolean;
}

export async function currentPreferences(): Promise<CurrentPreferences> {
  const user = await requireUser();

  const profile = await db().query.userProfiles.findFirst({
    where: and(
      eq(schema.userProfiles.userId, user.userId),
      eq(schema.userProfiles.workspaceId, user.workspaceId),
    ),
  });

  const watched = await db()
    .select({ slug: schema.entities.slug })
    .from(schema.watchlistItems)
    .innerJoin(schema.watchlists, eq(schema.watchlists.id, schema.watchlistItems.watchlistId))
    .innerJoin(schema.entities, eq(schema.entities.id, schema.watchlistItems.entityId))
    .where(
      and(
        eq(schema.watchlists.userId, user.userId),
        eq(schema.watchlists.workspaceId, user.workspaceId),
      ),
    );

  return {
    role: profile?.role ?? '',
    industrySlugs: profile?.industrySlugs ?? [],
    topicSlugs: profile?.topicSlugs ?? [],
    technologySlugs: profile?.technologySlugs ?? [],
    entitySlugs: watched.map((w) => w.slug),
    dailyReadingMinutes: profile?.dailyReadingMinutes ?? 12,
    preferredDepth: (profile?.preferredDepth ?? 'executive') as CurrentPreferences['preferredDepth'],
    onboarded: Boolean(profile?.onboardingCompletedAt),
  };
}

/**
 * Saves preferences and marks onboarding complete.
 *
 * Marking completion on save — rather than only on a dedicated onboarding route — means
 * someone who skips straight to the profile editor is not sent back through onboarding
 * afterwards. Choosing nothing is a legitimate answer, so completion is recorded even
 * when every list is empty.
 */
export async function savePreferences(formData: FormData): Promise<void> {
  const user = await requireUser();

  const list = (field: string): string[] =>
    formData
      .getAll(field)
      .map((v) => String(v).trim())
      .filter(Boolean);

  const minutes = Number.parseInt(String(formData.get('dailyReadingMinutes') ?? '12'), 10);
  const depthRaw = String(formData.get('preferredDepth') ?? 'executive');
  const depth = (['foundation', 'executive', 'expert'] as const).includes(
    depthRaw as 'foundation' | 'executive' | 'expert',
  )
    ? (depthRaw as 'foundation' | 'executive' | 'expert')
    : 'executive';

  const values = {
    role: String(formData.get('role') ?? '').slice(0, 120),
    industrySlugs: list('industries'),
    topicSlugs: list('topics'),
    technologySlugs: list('technologies'),
    // Clamped rather than rejected: a brief has to fit in a real amount of time, and a
    // typo should not silently produce a 600-minute reading budget.
    dailyReadingMinutes: Number.isFinite(minutes) ? Math.min(60, Math.max(3, minutes)) : 12,
    preferredDepth: depth,
    onboardingCompletedAt: new Date(),
    updatedAt: new Date(),
  };

  await db()
    .insert(schema.userProfiles)
    .values({ userId: user.userId, workspaceId: user.workspaceId, ...values })
    .onConflictDoUpdate({
      target: [schema.userProfiles.userId, schema.userProfiles.workspaceId],
      set: values,
    });

  await saveWatchlist(user.userId, user.workspaceId, list('entities'));

  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/account');
  revalidatePath('/profile');
}

/** Replaces the user's watched companies with exactly the given set. */
async function saveWatchlist(
  userId: string,
  workspaceId: string,
  slugs: string[],
): Promise<void> {
  let watchlist = await db().query.watchlists.findFirst({
    where: and(
      eq(schema.watchlists.userId, userId),
      eq(schema.watchlists.workspaceId, workspaceId),
    ),
  });

  if (!watchlist) {
    const [created] = await db()
      .insert(schema.watchlists)
      .values({ userId, workspaceId, name: 'My companies', kind: 'company' })
      .returning();
    watchlist = created;
  }
  if (!watchlist) return;

  await db()
    .delete(schema.watchlistItems)
    .where(eq(schema.watchlistItems.watchlistId, watchlist.id));

  if (slugs.length === 0) return;

  const entities = await db()
    .select({ id: schema.entities.id })
    .from(schema.entities)
    .where(inArray(schema.entities.slug, slugs));

  if (entities.length === 0) return;

  await db()
    .insert(schema.watchlistItems)
    .values(entities.map((e) => ({ watchlistId: watchlist!.id, entityId: e.id })))
    .onConflictDoNothing();
}
