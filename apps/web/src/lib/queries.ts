/**
 * Server-side data access.
 *
 * Every function takes a `workspaceId` and scopes by it. There is no query path here
 * that returns another workspace's insights, notes or briefs.
 */

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import type { RankableItem, UserRankingContext } from '@mios/ranking';

const {
  briefItems,
  claimEvidence,
  claims,
  conversationApplications,
  dailyBriefs,
  documentVersions,
  entities,
  eventClaims,
  eventEntities,
  eventTaxonomy,
  events,
  evidenceSpans,
  industries,
  insights,
  kpis,
  learningConcepts,
  learningConnections,
  learningPaths,
  learningUnits,
  rawDocuments,
  sourceConnectors,
  sourcePolicies,
  sources,
  userFeedback,
  userKnowledgeStates,
  userProfiles,
  userMissions,
  valueChainStages,
  watchlistItems,
  watchlists,
} = schema;

export async function getProfile(userId: string, workspaceId: string) {
  return db().query.userProfiles.findFirst({
    where: and(eq(userProfiles.userId, userId), eq(userProfiles.workspaceId, workspaceId)),
  });
}

export async function getActiveMission(userId: string, workspaceId: string) {
  const rows = await db()
    .select()
    .from(userMissions)
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.workspaceId, workspaceId),
        eq(userMissions.isPaused, false),
        sql`${userMissions.endsAt} > now()`,
      ),
    )
    .orderBy(desc(userMissions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWatchedEntityIds(
  userId: string,
  workspaceId: string,
): Promise<{ all: string[]; accounts: string[] }> {
  const rows = await db()
    .select({ entityId: watchlistItems.entityId, relationship: watchlistItems.relationship })
    .from(watchlistItems)
    .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
    .where(
      and(
        eq(watchlists.workspaceId, workspaceId),
        or(eq(watchlists.userId, userId), isNull(watchlists.userId)),
      ),
    );

  const all = rows.map((r) => r.entityId).filter((id): id is string => id !== null);
  const accounts = rows
    .filter((r) => r.relationship === 'account' || r.relationship === 'prospect')
    .map((r) => r.entityId)
    .filter((id): id is string => id !== null);
  return { all, accounts };
}

/** Concepts the user has not yet reached `understood` on. Drives the gap signal. */
export async function getKnowledgeGapSlugs(userId: string, workspaceId: string): Promise<string[]> {
  const known = await db()
    .select({ slug: learningConcepts.slug, state: userKnowledgeStates.state })
    .from(learningConcepts)
    .leftJoin(
      userKnowledgeStates,
      and(
        eq(userKnowledgeStates.conceptId, learningConcepts.id),
        eq(userKnowledgeStates.userId, userId),
        eq(userKnowledgeStates.workspaceId, workspaceId),
      ),
    );
  return known
    .filter(
      (k) =>
        !k.state || k.state === 'unseen' || k.state === 'introduced' || k.state === 'needs_refresh',
    )
    .map((k) => k.slug);
}

export interface InsightListRow extends RankableItem {
  takeaway: string;
  whyItMatters: string;
  eventType: string;
  verificationStatus: string;
  generator: string;
}

/** Candidate pool for ranking. Bounded, recent, and never another workspace's. */
export async function getCandidateInsights(
  workspaceId: string,
  limit = 150,
): Promise<InsightListRow[]> {
  const rows = await db()
    .select({
      insightId: insights.id,
      eventId: events.id,
      headline: insights.headline,
      takeaway: insights.takeaway,
      whyItMatters: insights.whyItMatters,
      novelty: insights.novelty,
      estimatedMinutes: insights.estimatedReadingMinutes,
      generator: insights.generator,
      isDemo: insights.isDemo,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      eventType: events.eventType,
      strategicImpact: events.strategicImpact,
      evidenceStrength: events.evidenceStrength,
      caseMaturity: events.caseMaturity,
      verificationStatus: events.verificationStatus,
      sourceCount: events.sourceCount,
      independentSourceCount: events.independentSourceCount,
      firstPartyOnly: events.firstPartyOnly,
    })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(and(eq(insights.workspaceId, workspaceId), eq(events.isSuppressed, false)))
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(limit);

  if (rows.length === 0) return [];
  const eventIds = rows.map((r) => r.eventId);

  const taxonomy = await db()
    .select({ eventId: eventTaxonomy.eventId, kind: eventTaxonomy.kind, slug: eventTaxonomy.slug })
    .from(eventTaxonomy)
    .where(inArray(eventTaxonomy.eventId, eventIds));

  const entityRows = await db()
    .select({ eventId: eventEntities.eventId, entityId: eventEntities.entityId })
    .from(eventEntities)
    .where(inArray(eventEntities.eventId, eventIds));

  const conceptRows = await db()
    .select({ eventId: learningConnections.eventId, slug: learningConcepts.slug })
    .from(learningConnections)
    .innerJoin(learningConcepts, eq(learningConcepts.id, learningConnections.conceptId))
    .where(inArray(learningConnections.eventId, eventIds));

  const byEvent = <T>(list: { eventId: string | null }[], pick: (r: never) => T) => {
    const map = new Map<string, T[]>();
    for (const row of list) {
      if (!row.eventId) continue;
      const arr = map.get(row.eventId) ?? [];
      arr.push(pick(row as never));
      map.set(row.eventId, arr);
    }
    return map;
  };

  const industryMap = byEvent(
    taxonomy.filter((t) => t.kind === 'industry'),
    (r: { slug: string }) => r.slug,
  );
  const topicMap = byEvent(
    taxonomy.filter((t) => t.kind === 'topic'),
    (r: { slug: string }) => r.slug,
  );
  const techMap = byEvent(
    taxonomy.filter((t) => t.kind === 'technology'),
    (r: { slug: string }) => r.slug,
  );
  const entityMap = byEvent(entityRows, (r: { entityId: string }) => r.entityId);
  const conceptMap = byEvent(conceptRows, (r: { slug: string }) => r.slug);

  return rows.map((r) => ({
    insightId: r.insightId,
    eventId: r.eventId,
    headline: r.headline,
    takeaway: r.takeaway,
    whyItMatters: r.whyItMatters,
    eventAt: r.eventAt,
    firstReportedAt: r.firstReportedAt,
    eventType: r.eventType,
    strategicImpact: r.strategicImpact,
    evidenceStrength: r.evidenceStrength,
    caseMaturity: r.caseMaturity,
    verificationStatus: r.verificationStatus,
    novelty: r.novelty,
    sourceCount: r.sourceCount,
    independentSourceCount: r.independentSourceCount,
    firstPartyOnly: r.firstPartyOnly,
    estimatedMinutes: r.estimatedMinutes,
    generator: r.generator,
    isDemo: r.isDemo,
    industrySlugs: industryMap.get(r.eventId) ?? [],
    topicSlugs: topicMap.get(r.eventId) ?? [],
    technologySlugs: techMap.get(r.eventId) ?? [],
    entityIds: entityMap.get(r.eventId) ?? [],
    conceptSlugs: conceptMap.get(r.eventId) ?? [],
    knowledgeGapConceptSlugs: [],
    alreadyShown: false,
    storyRepetitions: 0,
  }));
}

export async function buildRankingContext(
  userId: string,
  workspaceId: string,
  lastVisit: Date | null,
): Promise<UserRankingContext> {
  const profile = await getProfile(userId, workspaceId);
  const mission = await getActiveMission(userId, workspaceId);
  const watched = await getWatchedEntityIds(userId, workspaceId);

  return {
    industrySlugs: profile?.industrySlugs ?? [],
    topicSlugs: profile?.topicSlugs ?? [],
    technologySlugs: profile?.technologySlugs ?? [],
    watchedEntityIds: watched.all,
    accountEntityIds: watched.accounts,
    mission: mission
      ? {
          industrySlugs: mission.industrySlugs,
          topicSlugs: mission.topicSlugs,
          technologySlugs: mission.technologySlugs,
          entityIds: mission.entityIds,
        }
      : null,
    lastVisitAt: lastVisit,
    readingBudgetMinutes: profile?.dailyReadingMinutes ?? 12,
  };
}

// ── Insight detail ───────────────────────────────────────────────────────────

export async function getInsightDetail(workspaceId: string, insightId: string) {
  const insight = await db().query.insights.findFirst({
    where: and(eq(insights.id, insightId), eq(insights.workspaceId, workspaceId)),
  });
  if (!insight) return null;

  const event = await db().query.events.findFirst({ where: eq(events.id, insight.eventId) });
  if (!event) return null;

  const claimRows = await db()
    .select({
      claimId: claims.id,
      text: claims.text,
      claimType: claims.claimType,
      evidenceStrength: claims.evidenceStrength,
      verificationStatus: claims.verificationStatus,
      quantified: claims.quantified,
      needsReview: claims.needsReview,
      spanId: evidenceSpans.id,
      quote: evidenceSpans.quote,
      startOffset: evidenceSpans.startOffset,
      endOffset: evidenceSpans.endOffset,
      documentId: rawDocuments.id,
      documentVersionId: documentVersions.id,
      documentTitle: rawDocuments.title,
      documentUrl: rawDocuments.url,
      publishedAt: rawDocuments.publishedAt,
      sourceName: sources.name,
      sourceSlug: sources.slug,
      perspective: sources.perspective,
      requiredAttribution: sourcePolicies.requiredAttribution,
    })
    .from(eventClaims)
    .innerJoin(claims, eq(claims.id, eventClaims.claimId))
    .innerJoin(documentVersions, eq(documentVersions.id, claims.documentVersionId))
    .innerJoin(rawDocuments, eq(rawDocuments.id, documentVersions.documentId))
    .innerJoin(sources, eq(sources.id, claims.sourceId))
    .leftJoin(sourcePolicies, eq(sourcePolicies.sourceId, sources.id))
    .leftJoin(claimEvidence, eq(claimEvidence.claimId, claims.id))
    .leftJoin(evidenceSpans, eq(evidenceSpans.id, claimEvidence.evidenceSpanId))
    .where(eq(eventClaims.eventId, insight.eventId));

  const applications = await db()
    .select()
    .from(conversationApplications)
    .where(eq(conversationApplications.insightId, insight.id));

  const connections = await db()
    .select({
      kind: learningConnections.kind,
      explanation: learningConnections.explanation,
      conceptName: learningConcepts.name,
      conceptSlug: learningConcepts.slug,
      refSlug: learningConcepts.refSlug,
    })
    .from(learningConnections)
    .innerJoin(learningConcepts, eq(learningConcepts.id, learningConnections.conceptId))
    .where(eq(learningConnections.insightId, insight.id));

  const entityRows = await db()
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      kind: entities.kind,
      role: eventEntities.role,
    })
    .from(eventEntities)
    .innerJoin(entities, eq(entities.id, eventEntities.entityId))
    .where(eq(eventEntities.eventId, insight.eventId));

  const taxonomyRows = await db()
    .select({ kind: eventTaxonomy.kind, slug: eventTaxonomy.slug, origin: eventTaxonomy.origin })
    .from(eventTaxonomy)
    .where(eq(eventTaxonomy.eventId, insight.eventId));

  const contradictionRows = await db()
    .select({ explanation: schema.contradictions.explanation, kind: schema.contradictions.kind })
    .from(schema.contradictions)
    .where(eq(schema.contradictions.eventId, insight.eventId));

  return {
    insight,
    event,
    claims: claimRows,
    applications,
    connections,
    entities: entityRows,
    taxonomy: taxonomyRows,
    contradictions: contradictionRows,
  };
}

// ── Explore ──────────────────────────────────────────────────────────────────

export async function getCompanyPage(workspaceId: string, slug: string) {
  const entity = await db().query.entities.findFirst({ where: eq(entities.slug, slug) });
  if (!entity) return null;

  const timeline = await db()
    .select({
      eventId: events.id,
      title: events.title,
      summary: events.summary,
      eventType: events.eventType,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      maturity: events.caseMaturity,
      evidenceStrength: events.evidenceStrength,
      verificationStatus: events.verificationStatus,
      firstPartyOnly: events.firstPartyOnly,
      sourceCount: events.sourceCount,
      isDemo: events.isDemo,
      insightId: insights.id,
    })
    .from(eventEntities)
    .innerJoin(events, eq(events.id, eventEntities.eventId))
    .leftJoin(insights, and(eq(insights.eventId, events.id), eq(insights.workspaceId, workspaceId)))
    .where(and(eq(eventEntities.entityId, entity.id), eq(events.isSuppressed, false)))
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(50);

  const industry = entity.primaryIndustryId
    ? await db().query.industries.findFirst({ where: eq(industries.id, entity.primaryIndustryId) })
    : null;

  const monitoringSources = await db()
    .select({ name: sources.name, perspective: sources.perspective, slug: sources.slug })
    .from(sources)
    .where(eq(sources.subjectEntityId, entity.id));

  return { entity, timeline, industry, monitoringSources };
}

export async function getIndustryPage(slug: string) {
  const industry = await db().query.industries.findFirst({ where: eq(industries.slug, slug) });
  if (!industry) return null;

  const stages = await db()
    .select()
    .from(valueChainStages)
    .where(eq(valueChainStages.industryId, industry.id))
    .orderBy(valueChainStages.position);

  const kpiRows = await db().select().from(kpis).where(eq(kpis.industryId, industry.id));
  const models = await db()
    .select()
    .from(schema.businessModels)
    .where(eq(schema.businessModels.industryId, industry.id));

  const paths = await db()
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.industryId, industry.id));

  const recentEvents = await db()
    .select({
      eventId: events.id,
      title: events.title,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      maturity: events.caseMaturity,
    })
    .from(eventTaxonomy)
    .innerJoin(events, eq(events.id, eventTaxonomy.eventId))
    .where(
      and(
        eq(eventTaxonomy.kind, 'industry'),
        eq(eventTaxonomy.slug, slug),
        eq(events.isSuppressed, false),
      ),
    )
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(12);

  return { industry, stages, kpis: kpiRows, models, paths, recentEvents };
}

// ── Coverage ─────────────────────────────────────────────────────────────────

export async function getCoverage() {
  const sourceRows = await db()
    .select({
      slug: sources.slug,
      name: sources.name,
      perspective: sources.perspective,
      sourceType: sources.sourceType,
      language: sources.language,
      industrySlugs: sources.industrySlugs,
      geographySlugs: sources.geographySlugs,
      isDemo: sources.isDemo,
      qualityScore: sources.qualityScore,
      rightsStatus: sourcePolicies.rightsStatus,
      reviewNotes: sourcePolicies.reviewNotes,
      storageScope: sourcePolicies.storageScope,
      connectorType: sourceConnectors.connectorType,
      isActive: sourceConnectors.isActive,
      health: sourceConnectors.health,
      lastSuccessAt: sourceConnectors.lastSuccessAt,
      lastFailureAt: sourceConnectors.lastFailureAt,
      lastError: sourceConnectors.lastError,
      endpoint: sourceConnectors.endpoint,
    })
    .from(sources)
    .leftJoin(sourcePolicies, eq(sourcePolicies.sourceId, sources.id))
    .leftJoin(sourceConnectors, eq(sourceConnectors.sourceId, sources.id))
    .orderBy(sources.name);

  const [docCount] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(rawDocuments);
  const [claimCount] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(claims);
  const [eventCount] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(events);
  const [unevidenced] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(claims)
    .where(
      and(
        eq(claims.claimType, 'FACT'),
        sql`not exists (select 1 from ${claimEvidence} ce where ce.claim_id = ${claims.id})`,
      ),
    );

  return {
    sources: sourceRows,
    totals: {
      documents: docCount?.n ?? 0,
      claims: claimCount?.n ?? 0,
      events: eventCount?.n ?? 0,
      unevidencedFactClaims: unevidenced?.n ?? 0,
    },
  };
}

export async function getRecentPipelineRuns(limit = 10) {
  return db()
    .select()
    .from(schema.pipelineRuns)
    .orderBy(desc(schema.pipelineRuns.startedAt))
    .limit(limit);
}

// ── Brief persistence ────────────────────────────────────────────────────────

export function briefDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getTodayBrief(userId: string, workspaceId: string, date: string) {
  return db().query.dailyBriefs.findFirst({
    where: and(
      eq(dailyBriefs.userId, userId),
      eq(dailyBriefs.workspaceId, workspaceId),
      eq(dailyBriefs.briefDate, date),
    ),
  });
}

export async function getBriefItems(briefId: string) {
  return db()
    .select({
      id: briefItems.id,
      section: briefItems.section,
      position: briefItems.position,
      whyShown: briefItems.whyShown,
      estimatedMinutes: briefItems.estimatedMinutes,
      readAt: briefItems.readAt,
      insightId: insights.id,
      headline: insights.headline,
      takeaway: insights.takeaway,
      novelty: insights.novelty,
      generator: insights.generator,
      isDemo: insights.isDemo,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      maturity: events.caseMaturity,
      evidenceStrength: events.evidenceStrength,
      verificationStatus: events.verificationStatus,
      firstPartyOnly: events.firstPartyOnly,
      sourceCount: events.sourceCount,
      strategicImpact: events.strategicImpact,
      learningUnitId: briefItems.learningUnitId,
      learningUnitTitle: learningUnits.title,
      learningUnitObjective: learningUnits.objective,
      learningUnitSlug: learningUnits.slug,
    })
    .from(briefItems)
    .leftJoin(insights, eq(insights.id, briefItems.insightId))
    .leftJoin(events, eq(events.id, insights.eventId))
    .leftJoin(learningUnits, eq(learningUnits.id, briefItems.learningUnitId))
    .where(eq(briefItems.briefId, briefId))
    .orderBy(briefItems.position);
}

export async function getFeedbackFor(userId: string, insightIds: string[]) {
  if (insightIds.length === 0) return new Map<string, string[]>();
  const rows = await db()
    .select({ insightId: userFeedback.insightId, kind: userFeedback.kind })
    .from(userFeedback)
    .where(and(eq(userFeedback.userId, userId), inArray(userFeedback.insightId, insightIds)));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.insightId) continue;
    map.set(row.insightId, [...(map.get(row.insightId) ?? []), row.kind]);
  }
  return map;
}

/**
 * Corpus size and evidence integrity, for the status bar.
 *
 * These numbers describe our monitoring, not the market, which is why they sit in the
 * footer rather than the header: they matter, but they are not what the reader is
 * looking at, and in the header they competed with the content for attention.
 *
 * `unevidencedFacts` is the one number that must stay at zero — a FACT claim with no
 * evidence span would mean the integrity guarantee had been broken somewhere upstream.
 */
export async function corpusStatus(): Promise<{
  documents: number;
  claims: number;
  events: number;
  activeSources: number;
  unevidencedFacts: number;
}> {
  const [row] = await db()
    .select({
      documents: sql<number>`(select count(*)::int from raw_documents)`,
      claims: sql<number>`(select count(*)::int from claims)`,
      events: sql<number>`(select count(*)::int from events where is_suppressed = false)`,
      activeSources: sql<number>`(select count(*)::int from source_connectors where is_active)`,
      unevidencedFacts: sql<number>`(
        select count(*)::int from claims c
        where c.claim_type = 'FACT'
          and not exists (select 1 from claim_evidence ce where ce.claim_id = c.id)
      )`,
    })
    .from(sql`(select 1) as _`);

  return row ?? { documents: 0, claims: 0, events: 0, activeSources: 0, unevidencedFacts: 0 };
}
