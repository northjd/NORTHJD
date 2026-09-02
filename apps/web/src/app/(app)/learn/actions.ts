'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';

const Schema = z.object({ unitId: z.string().uuid(), selectedIndex: z.number().int().min(0).max(9) });

/**
 * Records a knowledge-check answer and nudges the concept state.
 *
 * A pass moves the concept to `understood`; a fail marks it `needs_refresh` and
 * schedules a resurfacing. Both store the reason, so the user can see why we think what
 * we think.
 */
export async function answerKnowledgeCheckAction(input: unknown): Promise<{ ok: boolean; correct?: boolean }> {
  const user = await requireUser();
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const unit = await db().query.learningUnits.findFirst({
    where: eq(schema.learningUnits.id, parsed.data.unitId),
  });
  if (!unit?.knowledgeCheck) return { ok: false };

  const correct = parsed.data.selectedIndex === unit.knowledgeCheck.correctIndex;

  await db().insert(schema.knowledgeCheckResults).values({
    userId: user.userId,
    learningUnitId: unit.id,
    selectedIndex: parsed.data.selectedIndex,
    isCorrect: correct,
  });

  await db()
    .insert(schema.userLearningProgress)
    .values({
      userId: user.userId,
      workspaceId: user.workspaceId,
      learningUnitId: unit.id,
      status: correct ? 'completed' : 'in_progress',
      startedAt: new Date(),
      completedAt: correct ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [
        schema.userLearningProgress.userId,
        schema.userLearningProgress.workspaceId,
        schema.userLearningProgress.learningUnitId,
      ],
      set: {
        status: correct ? 'completed' : 'in_progress',
        completedAt: correct ? new Date() : null,
        updatedAt: new Date(),
      },
    });

  if (unit.conceptId) {
    // Spaced resurfacing: a failed check comes back in three days, a passed one in 30.
    const reviewDueAt = new Date(Date.now() + (correct ? 30 : 3) * 86_400_000);
    await db()
      .insert(schema.userKnowledgeStates)
      .values({
        userId: user.userId,
        workspaceId: user.workspaceId,
        conceptId: unit.conceptId,
        state: correct ? 'understood' : 'needs_refresh',
        confidence: correct ? 0.75 : 0.4,
        userAsserted: false,
        lastEvidenceKind: correct ? 'knowledge_check_passed' : 'knowledge_check_failed',
        reason: correct
          ? `You answered the knowledge check for "${unit.title}" correctly.`
          : `You answered the knowledge check for "${unit.title}" incorrectly, so this is scheduled to come back.`,
        lastInteractionAt: new Date(),
        reviewDueAt,
      })
      .onConflictDoUpdate({
        target: [
          schema.userKnowledgeStates.userId,
          schema.userKnowledgeStates.workspaceId,
          schema.userKnowledgeStates.conceptId,
        ],
        set: {
          state: correct ? 'understood' : 'needs_refresh',
          confidence: correct ? 0.75 : 0.4,
          lastEvidenceKind: correct ? 'knowledge_check_passed' : 'knowledge_check_failed',
          reviewDueAt,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  revalidatePath('/learn');
  return { ok: true, correct };
}
