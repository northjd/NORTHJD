import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveClaims, assessCoverage, queryTerms } from '@mios/intelligence';
import { requireUser } from '@/lib/session';
import { buildPrompt } from '@/lib/prompt-builder';

export const dynamic = 'force-dynamic';

const Body = z.object({
  question: z.string().trim().min(3).max(500),
  mode: z.enum(['explore', 'brief', 'prepare', 'challenge', 'explain']).default('explore'),
});

/**
 * Retrieval, not answering.
 *
 * Finds the claims that bear on a question and returns them alongside a prompt the user
 * can paste into their own Claude. The division is deliberate: retrieval over a curated,
 * evidenced corpus is the part that makes an answer checkable, and it is the part a
 * language model is worst at. Phrasing is the part it is best at, and the part NORTH has
 * no need to own.
 *
 * Coverage is still reported. A question the corpus cannot support gets the same honest
 * answer it always did — with the specific missing words named — rather than a prompt
 * that would invite a confident answer built on four loosely-related sentences.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ask something first.' }, { status: 400 });
  }
  const { question, mode } = parsed.data;

  const claims = await retrieveClaims(question, {
    workspaceId: user.workspaceId,
    userId: user.userId,
    request: {
      question,
      mode: 'explore_it',
      depth: 'executive',
      length: 'standard',
      conversationId: null,
      pageContext: null,
      selectedEntityIds: [],
    },
  });

  const coverage = assessCoverage(queryTerms(question), claims.map((c) => c.text));
  const prompt = buildPrompt(question, claims, mode);

  return NextResponse.json({
    question,
    mode,
    coverage: {
      ratio: coverage.ratio,
      missing: coverage.missing,
      sufficient: coverage.sufficient,
    },
    evidence: prompt.evidence,
    prompt: prompt.text,
    empty: prompt.empty,
  });
}
