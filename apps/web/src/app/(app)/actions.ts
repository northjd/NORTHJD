'use server';

/**
 * Server actions.
 *
 * Every one re-derives the user from the session cookie and scopes writes by
 * workspace — an action never trusts an id passed from the client to establish who is
 * asking.
 */

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@mios/database';
import { FEEDBACK_KINDS, KNOWLEDGE_STATES } from '@mios/domain';
import { requireUser } from '@/lib/session';
import { completeBrief, markBriefItemRead } from '@/lib/brief';

const uuid = z.string().uuid();

export async function completeBriefAction(briefId: string): Promise<void> {
  const user = await requireUser();
  const id = uuid.parse(briefId);
  const brief = await db().query.dailyBriefs.findFirst({
    where: and(eq(schema.dailyBriefs.id, id), eq(schema.dailyBriefs.userId, user.userId)),
  });
  if (!brief) return;
  await completeBrief(id);
  revalidatePath('/');
}

export async function markItemReadAction(briefId: string, itemId: string): Promise<void> {
  const user = await requireUser();
  const brief = await db().query.dailyBriefs.findFirst({
    where: and(eq(schema.dailyBriefs.id, uuid.parse(briefId)), eq(schema.dailyBriefs.userId, user.userId)),
  });
  if (!brief) return;
  await markBriefItemRead(brief.id, uuid.parse(itemId));
}

const FeedbackSchema = z.object({
  insightId: uuid,
  kind: z.enum(FEEDBACK_KINDS),
  note: z.string().max(2000).default(''),
});

/**
 * Reflection signals. These feed both personalisation and the knowledge state, which
 * is why "I already knew this" advances concept state rather than only hiding an item.
 */
export async function submitFeedbackAction(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const insight = await db().query.insights.findFirst({
    where: and(
      eq(schema.insights.id, parsed.data.insightId),
      eq(schema.insights.workspaceId, user.workspaceId),
    ),
  });
  if (!insight) return { ok: false };

  await db().insert(schema.userFeedback).values({
    userId: user.userId,
    workspaceId: user.workspaceId,
    insightId: insight.id,
    kind: parsed.data.kind,
    note: parsed.data.note,
  });

  if (parsed.data.kind === 'already_knew' || parsed.data.kind === 'new_to_me') {
    await advanceKnowledgeFromInsight(user.userId, user.workspaceId, insight.id, parsed.data.kind);
  }

  revalidatePath(`/insights/${insight.id}`);
  return { ok: true };
}

/**
 * Nudges concept state from a reflection signal.
 *
 * Deliberately conservative and always explained: the stored `reason` is what the
 * user sees when they ask why we think they know something, and a user assertion
 * outranks anything we inferred.
 */
async function advanceKnowledgeFromInsight(
  userId: string,
  workspaceId: string,
  insightId: string,
  kind: 'already_knew' | 'new_to_me',
): Promise<void> {
  const connections = await db()
    .select({ conceptId: schema.learningConnections.conceptId })
    .from(schema.learningConnections)
    .where(eq(schema.learningConnections.insightId, insightId));

  for (const { conceptId } of connections) {
    const state = kind === 'already_knew' ? 'understood' : 'introduced';
    const reason =
      kind === 'already_knew'
        ? 'You marked an insight touching this concept as something you already knew.'
        : 'You read an insight touching this concept and marked it as new to you.';

    await db()
      .insert(schema.userKnowledgeStates)
      .values({
        userId,
        workspaceId,
        conceptId,
        state,
        confidence: kind === 'already_knew' ? 0.6 : 0.35,
        userAsserted: kind === 'already_knew',
        lastEvidenceKind: kind === 'already_knew' ? 'self_assessed' : 'insight_read',
        reason,
        lastInteractionAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.userKnowledgeStates.userId,
          schema.userKnowledgeStates.workspaceId,
          schema.userKnowledgeStates.conceptId,
        ],
        set: { state, reason, lastInteractionAt: new Date(), updatedAt: new Date() },
      });
  }
}

const NoteSchema = z.object({
  title: z.string().max(300).default(''),
  body: z.string().min(1).max(20_000),
  attachedKind: z.enum(['insight', 'entity', 'industry', 'conversation', 'meeting']).nullable().default(null),
  attachedId: uuid.nullable().default(null),
});

export async function saveNoteAction(input: unknown): Promise<{ ok: boolean; id?: string }> {
  const user = await requireUser();
  const parsed = NoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const [note] = await db()
    .insert(schema.notes)
    .values({
      userId: user.userId,
      workspaceId: user.workspaceId,
      title: parsed.data.title,
      body: parsed.data.body,
      attachedKind: parsed.data.attachedKind,
      attachedId: parsed.data.attachedId,
    })
    .returning();

  revalidatePath('/library');
  return { ok: true, id: note!.id };
}

export async function saveInsightAction(insightId: string): Promise<{ ok: boolean; saved: boolean }> {
  const user = await requireUser();
  const id = uuid.parse(insightId);

  const existing = await db().query.savedInsights.findFirst({
    where: and(eq(schema.savedInsights.userId, user.userId), eq(schema.savedInsights.insightId, id)),
  });

  if (existing) {
    await db().delete(schema.savedInsights).where(eq(schema.savedInsights.id, existing.id));
    revalidatePath('/library');
    return { ok: true, saved: false };
  }

  await db()
    .insert(schema.savedInsights)
    .values({ userId: user.userId, workspaceId: user.workspaceId, insightId: id });
  revalidatePath('/library');
  return { ok: true, saved: true };
}

const KnowledgeSchema = z.object({
  conceptSlug: z.string().min(1),
  state: z.enum(KNOWLEDGE_STATES),
});

/** The user correcting our estimate. Always wins, and is recorded as user-asserted. */
export async function setKnowledgeStateAction(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = KnowledgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const concept = await db().query.learningConcepts.findFirst({
    where: eq(schema.learningConcepts.slug, parsed.data.conceptSlug),
  });
  if (!concept) return { ok: false };

  await db()
    .insert(schema.userKnowledgeStates)
    .values({
      userId: user.userId,
      workspaceId: user.workspaceId,
      conceptId: concept.id,
      state: parsed.data.state,
      confidence: 0.95,
      userAsserted: true,
      lastEvidenceKind: 'self_assessed',
      reason: 'You set this yourself.',
      lastInteractionAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.userKnowledgeStates.userId,
        schema.userKnowledgeStates.workspaceId,
        schema.userKnowledgeStates.conceptId,
      ],
      set: {
        state: parsed.data.state,
        userAsserted: true,
        confidence: 0.95,
        reason: 'You set this yourself.',
        updatedAt: new Date(),
      },
    });

  revalidatePath('/learn');
  return { ok: true };
}
