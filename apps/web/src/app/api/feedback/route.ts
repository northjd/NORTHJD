import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Validated at the boundary, like every other input. */
const Body = z.object({
  kind: z.enum(['confusing', 'broken', 'idea', 'praise', 'other']).default('other'),
  message: z.string().trim().min(1).max(4000),
  route: z.string().max(300).default(''),
});

export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Say something first.' }, { status: 400 });
  }

  await db()
    .insert(schema.productFeedback)
    .values({
      userId: user.userId,
      workspaceId: user.workspaceId,
      kind: parsed.data.kind,
      message: parsed.data.message,
      route: parsed.data.route,
      // Truncated rather than rejected: a long user-agent should never lose the feedback.
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 400),
    });

  return NextResponse.json({ ok: true });
}
