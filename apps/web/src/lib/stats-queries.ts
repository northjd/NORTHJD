/**
 * Your numbers.
 *
 * The one place in NORTH where counting things is the point rather than a distraction —
 * and it still follows the same rule as everything else: every figure is derived from a
 * stored row, and anything not tracked says "not tracked" instead of showing a zero that
 * looks like a judgement on you.
 *
 * The distinction matters. A zero next to "briefs prepared" means you have not prepared
 * one. A zero next to something we never recorded would be a lie with a number on it.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

export interface StatValue {
  /** Null means the underlying activity is not recorded, which is different from zero. */
  value: number | null;
  label: string;
  /** Said in the second person, and never congratulatory about a number that is low. */
  note: string;
}

export interface UserStats {
  readItems: StatValue;
  briefsCompleted: StatValue;
  minutesRead: StatValue;
  questionsAsked: StatValue;
  voiceSessions: StatValue;
  savedInsights: StatValue;
  notesWritten: StatValue;
  collections: StatValue;
  topicsUnderstood: StatValue;
  learningUnitsDone: StatValue;
  checksPassed: StatValue;
  meetingBriefs: StatValue;
  companiesFollowed: StatValue;
  /** Day of the first recorded activity, for "since" phrasing. */
  since: Date | null;
  /** The evidence chain behind everything you read — corpus-wide, not personal. */
  corpus: { claims: number; events: number; sources: number };
}

const one = async (q: ReturnType<typeof sql>): Promise<number> => {
  const r = await db().execute(q);
  const row = (r.rows ?? [])[0] as { n?: number | string } | undefined;
  return Number(row?.n ?? 0);
};

export async function queryUserStats(userId: string, workspaceId: string): Promise<UserStats> {
  const [
    readItems,
    briefsCompleted,
    minutesRead,
    questionsAsked,
    voiceSessions,
    savedInsights,
    notesWritten,
    collections,
    topicsUnderstood,
    learningUnitsDone,
    checksPassed,
    meetingBriefs,
    companiesFollowed,
    corpusClaims,
    corpusEvents,
    corpusSources,
  ] = [
    await one(sql`select count(*)::int n from brief_items bi
                  join daily_briefs b on b.id = bi.brief_id
                  where b.user_id = ${sql.param(userId)} and bi.read_at is not null`),
    await one(sql`select count(*)::int n from daily_briefs
                  where user_id = ${sql.param(userId)} and state = 'completed'`),
    await one(sql`select coalesce(sum(i.estimated_reading_minutes), 0)::int n
                  from brief_items bi
                  join daily_briefs b on b.id = bi.brief_id
                  join insights i on i.id = bi.insight_id
                  where b.user_id = ${sql.param(userId)} and bi.read_at is not null`),
    await one(sql`select count(*)::int n from conversation_turns t
                  join conversations c on c.id = t.conversation_id
                  where c.user_id = ${sql.param(userId)} and t.role = 'user'`),
    await one(sql`select count(*)::int n from voice_sessions v
                  join conversations c on c.id = v.conversation_id
                  where c.user_id = ${sql.param(userId)}`),
    await one(sql`select count(*)::int n from saved_insights where user_id = ${sql.param(userId)}`),
    await one(sql`select count(*)::int n from notes where user_id = ${sql.param(userId)}`),
    await one(sql`select count(*)::int n from collections where user_id = ${sql.param(userId)}`),
    await one(sql`select count(*)::int n from user_knowledge_states
                  where user_id = ${sql.param(userId)} and state in ('understood','applied')`),
    await one(sql`select count(*)::int n from user_learning_progress
                  where user_id = ${sql.param(userId)} and completed_at is not null`),
    await one(sql`select count(*)::int n from knowledge_check_results
                  where user_id = ${sql.param(userId)} and is_correct = true`),
    await one(sql`select count(*)::int n from meeting_briefs mb
                  join meetings m on m.id = mb.meeting_id
                  where m.user_id = ${sql.param(userId)}`),
    await one(
      sql`select count(*)::int n from followed_entities where user_id = ${sql.param(userId)}`,
    ),
    await one(sql`select count(*)::int n from claims`),
    await one(sql`select count(*)::int n from events where is_suppressed = false`),
    await one(sql`select count(*)::int n from source_connectors where is_active`),
  ];

  const sinceRows = await db().execute(sql`
    select min(created_at) as n from daily_briefs where user_id = ${sql.param(userId)}
  `);
  const sinceRaw = ((sinceRows.rows ?? [])[0] as { n?: string | Date } | undefined)?.n ?? null;

  void workspaceId;

  return {
    readItems: {
      value: readItems,
      label: 'developments read',
      note: 'Each one carried the passage it came from.',
    },
    briefsCompleted: {
      value: briefsCompleted,
      label: 'briefs finished',
      note: 'A brief ends when you reach the bottom, not when you run out of scroll.',
    },
    minutesRead: {
      value: minutesRead,
      label: 'minutes of reading',
      note: 'Estimated at 220 words a minute, floored at one minute per item.',
    },
    questionsAsked: {
      value: questionsAsked,
      label: 'questions asked',
      note: 'Every answer separated verified fact from interpretation.',
    },
    voiceSessions: {
      value: voiceSessions,
      label: 'spoken sessions',
      note: 'Transcription happens in your browser. No audio reaches the server.',
    },
    savedInsights: {
      value: savedInsights,
      label: 'insights saved',
      note: 'Kept for later, with their evidence attached.',
    },
    notesWritten: {
      value: notesWritten,
      label: 'notes written',
      note: 'Your own thinking, stored apart from source material and never cited as evidence.',
    },
    collections: {
      value: collections,
      label: 'collections',
      note: 'Your filing, your names for things.',
    },
    topicsUnderstood: {
      value: topicsUnderstood,
      label: 'topics understood',
      note: 'A cautious estimate. Each one shows why it was recorded.',
    },
    learningUnitsDone: {
      value: learningUnitsDone,
      label: 'learning units completed',
      note: 'The half of the product that compounds.',
    },
    checksPassed: {
      value: checksPassed,
      label: 'knowledge checks passed',
      note: 'Answering correctly is what moves a topic to understood.',
    },
    meetingBriefs: {
      value: meetingBriefs,
      label: 'meeting briefs prepared',
      note: 'What changed, what is evidenced, and five questions worth asking.',
    },
    companiesFollowed: {
      value: companiesFollowed,
      label: 'companies followed',
      note: 'Silence about one of them is a statement about our monitoring, not about them.',
    },
    since: sinceRaw ? new Date(sinceRaw) : null,
    corpus: { claims: corpusClaims, events: corpusEvents, sources: corpusSources },
  };
}

/**
 * A light, honest read on where someone is.
 *
 * Deliberately not a score, a streak or a rank. Those work by making people anxious
 * about a number, and a product whose whole argument is "we only claim what the evidence
 * supports" should not then invent a metric to nag you with. This just names the stage
 * you are visibly at, and says what the next one looks like.
 */
export function readerStanding(stats: UserStats): { title: string; body: string } {
  const read = stats.readItems.value ?? 0;
  const asked = stats.questionsAsked.value ?? 0;
  const learned = stats.learningUnitsDone.value ?? 0;

  if (read === 0 && asked === 0) {
    return {
      title: 'Nothing recorded yet',
      body: 'Read a brief or ask the Companion something, and this page starts filling in. Nothing here is a score — it is just what you have actually done.',
    };
  }
  if (learned > 0 && asked > 0 && read > 0) {
    return {
      title: 'Reading, asking and learning',
      body: 'You are using all three of the things NORTH is for: what changed, what it means, and the model underneath it. That third one is the half that compounds.',
    };
  }
  if (asked > read) {
    return {
      title: 'More asking than reading',
      body: 'You interrogate more than you browse, which is usually the better instinct — the brief is finite, so there is a bottom to reach if you want it.',
    };
  }
  if (learned === 0) {
    return {
      title: 'Well read on what changed',
      body: 'The news half is working. The learning path is the part that turns a stream of announcements into a model of how the market actually works.',
    };
  }
  return {
    title: 'Getting the measure of it',
    body: 'Keep going. The interesting patterns show up once there is enough history to compare against.',
  };
}
