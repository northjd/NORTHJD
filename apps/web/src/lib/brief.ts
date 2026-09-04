/**
 * Daily brief assembly and persistence.
 *
 * The brief is built *once per day per user* and stored. That is what makes "You are
 * caught up" meaningful: the set of items was decided at a point in time and does not
 * grow while you read it. Reopening the page shows the same brief with your progress,
 * not a fresh query with new items appended.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { composeBrief, scoreItem, type ScoredItem } from '@mios/ranking';
import {
  briefDateKey,
  buildRankingContext,
  getBriefItems,
  getCandidateInsights,
  getKnowledgeGapSlugs,
  getTodayBrief,
} from './queries';

const { briefItems, dailyBriefs, insightImpressions, learningUnits, userLearningProgress } = schema;

export async function ensureTodayBrief(
  userId: string,
  workspaceId: string,
  lastVisit: Date | null,
  now: Date = new Date(),
) {
  const date = briefDateKey(now);
  const existing = await getTodayBrief(userId, workspaceId, date);
  if (existing) {
    return { brief: existing, items: await getBriefItems(existing.id) };
  }

  const ctx = await buildRankingContext(userId, workspaceId, lastVisit);
  const gapSlugs = new Set(await getKnowledgeGapSlugs(userId, workspaceId));
  const candidates = await getCandidateInsights(workspaceId);

  const shown = new Set(
    (
      await db()
        .select({ insightId: insightImpressions.insightId })
        .from(insightImpressions)
        .where(eq(insightImpressions.userId, userId))
    ).map((r) => r.insightId),
  );

  const scored: ScoredItem[] = candidates.map((item) =>
    scoreItem(
      {
        ...item,
        knowledgeGapConceptSlugs: item.conceptSlugs.filter((s) => gapSlugs.has(s)),
        alreadyShown: shown.has(item.insightId),
      },
      ctx,
      now,
    ),
  );

  const composed = composeBrief(scored, ctx);

  const [brief] = await db()
    .insert(dailyBriefs)
    .values({
      userId,
      workspaceId,
      briefDate: date,
      readingBudgetMinutes: ctx.readingBudgetMinutes,
      estimatedMinutes: composed.estimatedMinutes,
      state: 'open',
      sinceAt: lastVisit,
      compositionNote: composed.composition,
      coverageNote: composed.coverageNote,
    })
    .returning();

  let position = 0;
  for (const slot of composed.slots) {
    await db().insert(briefItems).values({
      briefId: brief!.id,
      insightId: slot.scored.item.insightId,
      section: slot.section,
      position: position++,
      score: slot.scored.score,
      whyShown: slot.scored.reasons,
      estimatedMinutes: slot.scored.item.estimatedMinutes,
    });
    await db()
      .insert(insightImpressions)
      .values({ insightId: slot.scored.item.insightId, userId })
      .onConflictDoUpdate({
        target: [insightImpressions.insightId, insightImpressions.userId],
        set: { shownCount: sql`${insightImpressions.shownCount} + 1` },
      });
  }

  // Learn One Thing: a unit the user has not completed, preferring their industries.
  const unit = await nextLearningUnit(userId, workspaceId);
  if (unit) {
    await db()
      .insert(briefItems)
      .values({
        briefId: brief!.id,
        learningUnitId: unit.id,
        section: 'learn_one_thing',
        position,
        score: 0,
        whyShown: ['A short fundamentals unit, chosen because you have not covered it yet.'],
        estimatedMinutes: unit.estimatedMinutes,
      });
    await db()
      .update(dailyBriefs)
      .set({ estimatedMinutes: composed.estimatedMinutes + unit.estimatedMinutes })
      .where(eq(dailyBriefs.id, brief!.id));
  }

  return {
    brief: (await getTodayBrief(userId, workspaceId, date))!,
    items: await getBriefItems(brief!.id),
  };
}

async function nextLearningUnit(userId: string, workspaceId: string) {
  const rows = await db()
    .select({
      id: learningUnits.id,
      title: learningUnits.title,
      estimatedMinutes: learningUnits.estimatedMinutes,
      position: learningUnits.position,
      status: userLearningProgress.status,
    })
    .from(learningUnits)
    .leftJoin(
      userLearningProgress,
      and(
        eq(userLearningProgress.learningUnitId, learningUnits.id),
        eq(userLearningProgress.userId, userId),
        eq(userLearningProgress.workspaceId, workspaceId),
      ),
    )
    .where(
      or0(isNull(userLearningProgress.status), sql`${userLearningProgress.status} <> 'completed'`),
    )
    .orderBy(learningUnits.position)
    .limit(1);
  return rows[0] ?? null;
}

/** `or` over one or two conditions without importing the whole operator surface. */
function or0(a: ReturnType<typeof isNull>, b: ReturnType<typeof sql>) {
  return sql`(${a} or ${b})`;
}

export async function markBriefItemRead(briefId: string, itemId: string): Promise<void> {
  await db()
    .update(briefItems)
    .set({ readAt: new Date() })
    .where(and(eq(briefItems.id, itemId), eq(briefItems.briefId, briefId)));
}

export async function completeBrief(briefId: string): Promise<void> {
  await db()
    .update(dailyBriefs)
    .set({ state: 'completed', completedAt: new Date() })
    .where(eq(dailyBriefs.id, briefId));
}
// Section names live in ./brief-sections so the browser can import them too; re-exported
// here because every server caller already reaches for them through this module.
export { SECTION_META, SECTION_ORDER } from './brief-sections';
