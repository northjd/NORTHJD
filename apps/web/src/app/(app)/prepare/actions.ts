'use server';

import { redirect } from 'next/navigation';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { MeetingBriefRequestSchema, formatAbsolute, subtractDays, toIso } from '@mios/domain';
import { answerQuestion } from '@mios/intelligence';
import { requireUser } from '@/lib/session';

/**
 * Builds a meeting brief.
 *
 * Structure comes from the company's own event timeline (facts, with citations), and
 * the applicability sections come from the Companion in `prepare_me` mode — the same
 * evidence-checked path the chat uses, so a brief cannot contain a claim the Companion
 * would refuse to make.
 */
export async function createMeetingBriefAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = MeetingBriefRequestSchema.safeParse({
    companyEntityId: (formData.get('companyEntityId') as string) || null,
    companyName: String(formData.get('companyName') ?? '').trim(),
    objective: String(formData.get('objective') ?? ''),
    meetingAt: (formData.get('meetingAt') as string) || null,
    attendees: String(formData.get('attendees') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, role = ''] = line.split(/\s*[—–-]\s*/);
        return { name: (name ?? '').slice(0, 200), role: role.slice(0, 200) };
      }),
    topics: String(formData.get('topics') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    depth: (formData.get('depth') as string) || 'executive',
    lookbackDays: Number.parseInt(String(formData.get('lookbackDays') ?? '90'), 10),
    personalNotes: String(formData.get('personalNotes') ?? ''),
  });

  if (!parsed.success) redirect('/prepare?error=invalid');
  const input = parsed.data;

  const [meeting] = await db()
    .insert(schema.meetings)
    .values({
      userId: user.userId,
      workspaceId: user.workspaceId,
      title: input.objective
        ? `${input.companyName} — ${input.objective.slice(0, 80)}`
        : `${input.companyName} briefing`,
      companyEntityId: input.companyEntityId,
      companyName: input.companyName,
      objective: input.objective,
      meetingAt: input.meetingAt ? new Date(input.meetingAt) : null,
      attendees: input.attendees,
      topics: input.topics,
      personalNotes: input.personalNotes,
    })
    .returning();

  const content = await buildBriefContent(user.userId, user.workspaceId, input);

  await db().insert(schema.meetingBriefs).values({
    meetingId: meeting!.id,
    depth: input.depth,
    lookbackDays: input.lookbackDays,
    content: content as unknown as Record<string, unknown>,
    generator: 'deterministic_extractive',
  });

  redirect(`/prepare/${meeting!.id}`);
}

async function buildBriefContent(
  userId: string,
  workspaceId: string,
  input: ReturnType<typeof MeetingBriefRequestSchema.parse>,
) {
  const now = new Date();
  const question = [
    `Prepare me for a meeting with ${input.companyName}.`,
    input.objective ? `Objective: ${input.objective}.` : '',
    input.topics.length > 0 ? `Topics: ${input.topics.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const answer = await answerQuestion({
    workspaceId,
    userId,
    request: {
      question,
      mode: 'prepare_me',
      depth: input.depth,
      length: 'executive_summary',
      conversationId: null,
      pageContext: input.companyEntityId
        ? { kind: 'company', id: input.companyEntityId, label: input.companyName }
        : null,
      selectedEntityIds: input.companyEntityId ? [input.companyEntityId] : [],
    },
    now,
  });

  // "What changed" per window, from the company's own timeline.
  const windows: { window: '7d' | '30d' | '90d' | '12m'; days: number }[] = [
    { window: '7d', days: 7 },
    { window: '30d', days: 30 },
    { window: '90d', days: 90 },
    { window: '12m', days: 365 },
  ];

  const whatChanged: { window: '7d' | '30d' | '90d' | '12m'; items: { text: string; citationIndexes: number[] }[] }[] = [];

  if (input.companyEntityId) {
    for (const { window, days } of windows) {
      if (days > input.lookbackDays) continue;
      const rows = await db()
        .select({
          title: schema.events.title,
          eventAt: schema.events.eventAt,
          firstReportedAt: schema.events.firstReportedAt,
          maturity: schema.events.caseMaturity,
        })
        .from(schema.eventEntities)
        .innerJoin(schema.events, eq(schema.events.id, schema.eventEntities.eventId))
        .where(
          and(
            eq(schema.eventEntities.entityId, input.companyEntityId),
            eq(schema.events.isSuppressed, false),
            gte(sql`coalesce(${schema.events.eventAt}, ${schema.events.firstReportedAt})`, subtractDays(now, days)),
          ),
        )
        .orderBy(desc(sql`coalesce(${schema.events.eventAt}, ${schema.events.firstReportedAt})`))
        .limit(6);

      if (rows.length > 0) {
        whatChanged.push({
          window,
          items: rows.map((r) => ({
            text: `${formatAbsolute(r.eventAt ?? r.firstReportedAt)}: ${r.title} (${r.maturity.replace(/_/g, ' ').toLowerCase()})`,
            citationIndexes: [],
          })),
        });
      }
    }
  }

  return {
    sixtySecondBrief: answer.directAnswer,
    whatChanged,
    companyContext: answer.verifiedFacts,
    executiveContext: [],
    whatThisCouldMean: answer.interpretations,
    conversationStarters:
      answer.conversationStarters.length > 0
        ? answer.conversationStarters
        : answer.suggestedFollowUps,
    contrarianAngle: answer.hypotheses.length > 0 ? answer.hypotheses : answer.interpretations.slice(0, 1),
    knownUnknowns: [...answer.unknowns, ...answer.coverageLimitations],
    marketExamples: [],
    citations: answer.citations,
    coverageLimitations: answer.coverageLimitations,
    generator: answer.generator,
    asOf: toIso(now)!,
    insufficientEvidence: answer.insufficientEvidence,
    personalNotes: input.personalNotes,
  };
}
