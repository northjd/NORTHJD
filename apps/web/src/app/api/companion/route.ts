/**
 * Companion endpoint.
 *
 * One route for text and voice. Voice input is transcribed on the client (Web Speech
 * API) and arrives here as text, so there is exactly one answering path and exactly one
 * evidence model — the property acceptance criterion 39 asks for.
 */

import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { CompanionRequestSchema, EvidenceIntegrityError } from '@mios/domain';
import { answerQuestion } from '@mios/intelligence';
import { db, schema } from '@mios/database';
import { currentUser } from '@/lib/session';

/** Crude per-user limiter. Enough to stop a runaway client; not a security boundary. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (rateLimited(user.userId)) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CompanionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const inputMode = typeof (body as { inputMode?: unknown }).inputMode === 'string'
    ? String((body as { inputMode: string }).inputMode)
    : 'text';

  const started = Date.now();
  let response;
  try {
    response = await answerQuestion({
      workspaceId: user.workspaceId,
      userId: user.userId,
      request: parsed.data,
    });
  } catch (err) {
    if (err instanceof EvidenceIntegrityError) {
      // A response that cannot prove its factual statements is discarded rather than
      // shown. This is the failure mode the whole product exists to avoid.
      console.error('[companion] evidence integrity failure', err.message, err.details);
      return NextResponse.json(
        {
          error:
            'The generated answer failed its evidence check and was discarded. Nothing unverified is shown.',
        },
        { status: 500 },
      );
    }
    console.error('[companion] failed', err);
    return NextResponse.json({ error: 'The Companion could not answer that.' }, { status: 500 });
  }

  const conversationId = await persistTurns(
    user.userId,
    user.workspaceId,
    parsed.data,
    response,
    inputMode,
    Date.now() - started,
  );

  return NextResponse.json({ conversationId, response });
}

async function persistTurns(
  userId: string,
  workspaceId: string,
  request: ReturnType<typeof CompanionRequestSchema.parse>,
  response: Awaited<ReturnType<typeof answerQuestion>>,
  inputMode: string,
  latencyMs: number,
): Promise<string> {
  const d = db();

  let conversationId = request.conversationId;
  if (conversationId) {
    const existing = await d.query.conversations.findFirst({
      where: and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.userId, userId),
      ),
    });
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const [created] = await d
      .insert(schema.conversations)
      .values({
        userId,
        workspaceId,
        title: request.question.slice(0, 120),
        mode: request.mode,
        hadVoice: inputMode === 'voice',
      })
      .returning();
    conversationId = created!.id;
  } else if (inputMode === 'voice') {
    await d
      .update(schema.conversations)
      .set({ hadVoice: true, updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversationId));
  }

  const positionRows = await d
    .select({ next: sql<number>`coalesce(max(${schema.conversationTurns.position}), -1) + 1` })
    .from(schema.conversationTurns)
    .where(eq(schema.conversationTurns.conversationId, conversationId));
  const next = positionRows[0]?.next ?? 0;

  await d.insert(schema.conversationTurns).values({
    conversationId,
    position: next,
    role: 'user',
    text: request.question,
    mode: request.mode,
    depth: request.depth,
    inputMode,
  });

  await d.insert(schema.conversationTurns).values({
    conversationId,
    position: next + 1,
    role: 'assistant',
    text: response.directAnswer,
    structured: response as unknown as Record<string, unknown>,
    mode: response.mode,
    depth: response.depth,
    generator: response.generator,
    contextUsed: response.contextUsed,
    inputMode,
    latencyMs,
  });

  await d
    .update(schema.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId));

  return conversationId;
}
