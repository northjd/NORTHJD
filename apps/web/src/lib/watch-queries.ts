/**
 * Foresight, derived rather than invented.
 *
 * No probabilities, no predicted figures, no asserted outcomes. Every band below is a
 * query over stored evidence, and every band states its falsifier — the observation
 * that would settle it.
 *
 * That constraint is the point. A confidence number this system could not justify would
 * be more damaging than no view at all: it is exactly the false-certainty failure the
 * rest of the product is built to prevent, and it would undermine every honest thing
 * next to it. What a good analyst hands you is not a probability, it is the set of
 * things still unresolved and what would resolve them.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import type { CaseMaturity, SourcePerspective } from '@mios/domain';

const {
  claimEvidence,
  claims,
  contradictions,
  conversationApplications,
  documentVersions,
  entities,
  eventEntities,
  events,
  insights,
  rawDocuments,
  sources,
  watchlistItems,
  watchlists,
} = schema;

export interface StatedIntention {
  claimId: string;
  text: string;
  sourceName: string;
  perspective: SourcePerspective;
  documentTitle: string;
  documentUrl: string;
  publishedAt: Date | null;
}

export interface WatchEvent {
  eventId: string;
  insightId: string | null;
  title: string;
  caseMaturity: CaseMaturity;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  firstPartyOnly: boolean;
  sourceCount: number;
  entityNames: string | null;
  ageDays: number | null;
}

export interface WatchBoard {
  stated: StatedIntention[];
  awaitingScale: WatchEvent[];
  unconfirmed: WatchEvent[];
  disputed: { eventId: string; insightId: string | null; title: string; why: string | null }[];
  hypotheses: { text: string; insightId: string; headline: string }[];
  reversals: WatchEvent[];
  quiet: { slug: string; name: string; events: number; lastSeen: Date | null }[];
  counts: {
    announced: number;
    pilots: number;
    measured: number;
    disputed: number;
    forecasts: number;
  };
}

const entityNames = sql<string | null>`(
  select string_agg(en.name, ', ' order by en.name)
  from ${eventEntities} ee join ${entities} en on en.id = ee.entity_id
  where ee.event_id = ${events.id}
)`;

const ageDays = sql<number | null>`extract(day from now() - coalesce(${events.eventAt}, ${events.firstReportedAt}))::int`;

const watchEventColumns = {
  eventId: events.id,
  insightId: insights.id,
  title: events.title,
  caseMaturity: events.caseMaturity,
  eventAt: events.eventAt,
  firstReportedAt: events.firstReportedAt,
  firstPartyOnly: events.firstPartyOnly,
  sourceCount: events.sourceCount,
  entityNames: entityNames.as('entity_names'),
  ageDays: ageDays.as('age_days'),
};

export async function queryWatchBoard(workspaceId: string): Promise<WatchBoard> {
  /** Things the sources themselves say will happen. Cited, never presented as fact. */
  const stated = await db()
    .select({
      claimId: claims.id,
      text: claims.text,
      sourceName: sources.name,
      perspective: sources.perspective,
      documentTitle: rawDocuments.title,
      documentUrl: rawDocuments.url,
      publishedAt: rawDocuments.publishedAt,
    })
    .from(claims)
    .innerJoin(documentVersions, eq(documentVersions.id, claims.documentVersionId))
    .innerJoin(rawDocuments, eq(rawDocuments.id, documentVersions.documentId))
    .innerJoin(sources, eq(sources.id, claims.sourceId))
    // Only forecasts that actually carry evidence — an uncited forecast is not shown.
    .innerJoin(claimEvidence, eq(claimEvidence.claimId, claims.id))
    .where(eq(claims.claimType, 'FORECAST'))
    .orderBy(desc(rawDocuments.publishedAt))
    .limit(12);

  /** Pilots and concepts with no reported expansion. Most do not scale. */
  const awaitingScale = await db()
    .select(watchEventColumns)
    .from(events)
    .leftJoin(insights, and(eq(insights.eventId, events.id), eq(insights.workspaceId, workspaceId)))
    .where(
      and(
        eq(events.isSuppressed, false),
        sql`${events.caseMaturity} = any(array['PILOT','LIMITED_DEPLOYMENT','CONCEPT']::case_maturity[])`,
      ),
    )
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(10);

  /** Quantified or scaled claims only the subject itself has made. */
  const unconfirmed = await db()
    .select(watchEventColumns)
    .from(events)
    .leftJoin(insights, and(eq(insights.eventId, events.id), eq(insights.workspaceId, workspaceId)))
    .where(
      and(
        eq(events.isSuppressed, false),
        eq(events.firstPartyOnly, true),
        sql`${events.caseMaturity} = any(array['QUANTIFIED_BUSINESS_IMPACT','SCALED_DEPLOYMENT']::case_maturity[])`,
      ),
    )
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(10);

  /** Sources that cannot both be right. Shown as a conflict, never averaged. */
  const disputed = await db()
    .select({
      eventId: events.id,
      insightId: insights.id,
      title: events.title,
      why: sql<string | null>`(
        select string_agg(x.explanation, ' | ') from ${contradictions} x where x.event_id = ${events.id}
      )`.as('why'),
    })
    .from(events)
    .leftJoin(insights, and(eq(insights.eventId, events.id), eq(insights.workspaceId, workspaceId)))
    .where(and(eq(events.isSuppressed, false), eq(events.verificationStatus, 'DISPUTED')))
    .limit(8);

  /** Testable propositions, each already carrying its own test. */
  const hypotheses = await db()
    .selectDistinctOn([conversationApplications.text], {
      text: conversationApplications.text,
      insightId: insights.id,
      headline: insights.headline,
    })
    .from(conversationApplications)
    .innerJoin(insights, eq(insights.id, conversationApplications.insightId))
    .where(and(eq(conversationApplications.kind, 'hypothesis'), eq(insights.workspaceId, workspaceId)))
    .limit(10);

  const reversals = await db()
    .select(watchEventColumns)
    .from(events)
    .leftJoin(insights, and(eq(insights.eventId, events.id), eq(insights.workspaceId, workspaceId)))
    .where(and(eq(events.isSuppressed, false), eq(events.caseMaturity, 'DISCONTINUED_OR_REVERSED')))
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(6);

  /** Watched companies the monitored sources have said nothing about — a gap, named. */
  const quiet = await db()
    .select({
      slug: entities.slug,
      name: entities.name,
      events: sql<number>`count(distinct e.id)::int`.as('events'),
      lastSeen: sql<Date | null>`max(coalesce(e.event_at, e.first_reported_at))`.as('last_seen'),
    })
    .from(watchlistItems)
    .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
    .innerJoin(entities, eq(entities.id, watchlistItems.entityId))
    .leftJoin(sql`event_entities ee`, sql`ee.entity_id = ${entities.id}`)
    .leftJoin(sql`events e`, sql`e.id = ee.event_id and e.is_suppressed = false`)
    .where(eq(watchlists.workspaceId, workspaceId))
    .groupBy(entities.slug, entities.name)
    .orderBy(sql`last_seen asc nulls first`)
    .limit(8);

  const [counts] = await db()
    .select({
      announced: sql<number>`(select count(*)::int from events where case_maturity = any(array['ANNOUNCED','CONCEPT']::case_maturity[]) and is_suppressed = false)`,
      pilots: sql<number>`(select count(*)::int from events where case_maturity = 'PILOT' and is_suppressed = false)`,
      measured: sql<number>`(select count(*)::int from events where case_maturity = any(array['QUANTIFIED_BUSINESS_IMPACT','INDEPENDENTLY_VALIDATED_IMPACT']::case_maturity[]) and is_suppressed = false)`,
      disputed: sql<number>`(select count(*)::int from events where verification_status = 'DISPUTED' and is_suppressed = false)`,
      forecasts: sql<number>`(select count(*)::int from claims where claim_type = 'FORECAST')`,
    })
    .from(sql`(select 1) as _`);

  return {
    stated: stated as StatedIntention[],
    awaitingScale: awaitingScale as WatchEvent[],
    unconfirmed: unconfirmed as WatchEvent[],
    disputed,
    hypotheses,
    reversals: reversals as WatchEvent[],
    quiet: quiet as WatchBoard['quiet'],
    counts: counts ?? { announced: 0, pilots: 0, measured: 0, disputed: 0, forecasts: 0 },
    // `scope` is intentionally unused for the corpus-wide counts above: the watch board
    // reports on all monitored events, and per-workspace insights are joined in where
    // a link to the insight is offered.
  } satisfies WatchBoard;
}
