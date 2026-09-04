/**
 * Explore data access — filtered results and facet counts.
 *
 * Facet counts are computed against the *other* active filters, not against the whole
 * corpus. That is the behaviour that makes faceted filtering usable: the count next to
 * "Pilot" tells you how many results you would get if you added it to what is already
 * selected, so a zero count is a dead end you can see before clicking it.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import {
  CASE_MATURITIES,
  EVENT_TYPES,
  EVIDENCE_STRENGTHS,
  type CaseMaturity,
  type EvidenceStrength,
} from '@mios/domain';
import { filterConditions, type ExploreFilters } from './filters';

const { eventEntities, eventTaxonomy, events, industries, insights, technologies, topics } = schema;

export interface ExploreRow {
  insightId: string;
  eventId: string;
  headline: string;
  takeaway: string;
  novelty: string;
  isDemo: boolean;
  minutes: number;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  eventType: string;
  caseMaturity: CaseMaturity;
  evidenceStrength: EvidenceStrength;
  verificationStatus: string;
  firstPartyOnly: boolean;
  sourceCount: number;
  independentSourceCount: number;
  strategicImpact: string;
  entityNames: string | null;
}

export interface ExploreResult {
  rows: ExploreRow[];
  total: number;
  /** The lookback actually used, once widening has been applied. */
  windowDays: number | null;
  /** What the user asked for, so the UI can say the two differ. */
  requestedDays: number | null;
  widened: boolean;
}

/**
 * Lookbacks tried, in order, when the requested window returns nothing.
 *
 * "No results today" is technically correct and practically useless. Widening and
 * *saying which window was used* is the honest version: the reader gets something to
 * work with and is never misled about how fresh it is. `null` means no date filter at
 * all, which is why the ladder can always terminate with results if any exist.
 */
const WIDEN_LADDER: (number | null)[] = [7, 30, 90, 365, null];

/**
 * Runs the query, widening the time window until something comes back.
 *
 * Widening only applies when a window was actually requested. An earlier version
 * widened unconditionally, which silently turned the unfiltered default from 184 items
 * into 80 — a filter nobody selected.
 */
export async function queryExploreWidening(
  workspaceId: string,
  f: ExploreFilters,
  page = 0,
): Promise<ExploreResult> {
  const requested = f.withinDays;
  const first = await queryExplore(workspaceId, f, page);
  if (first.total > 0 || requested === null) return first;

  for (const days of WIDEN_LADDER) {
    if (days !== null && days <= requested) continue;
    const attempt = await queryExplore(
      workspaceId,
      { ...f, withinDays: days as ExploreFilters['withinDays'] },
      page,
    );
    if (attempt.total > 0 || days === null) {
      return { ...attempt, windowDays: days, requestedDays: requested, widened: true };
    }
  }
  return first;
}

const PAGE_SIZE = 40;

/** Conditions every Explore query carries, regardless of user filters. */
const baseConditions = (workspaceId: string) => [
  eq(insights.workspaceId, workspaceId),
  eq(events.isSuppressed, false),
];

/**
 * Ordering, expressed in SQL rather than sorted in memory.
 *
 * Every option falls back to recency, so ties never come back in an arbitrary order —
 * two loads of the same filtered view produce the same list, which matters when someone
 * refers to "the third one down".
 */
function orderFor(sort: ExploreFilters['sort']) {
  const recency = desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`);
  switch (sort) {
    case 'impact':
      return [
        sql`case ${events.strategicImpact}
              when 'very_high' then 0 when 'high' then 1
              when 'moderate' then 2 else 3 end`,
        recency,
      ];
    case 'evidence':
      return [
        sql`case ${events.evidenceStrength}
              when 'QUANTIFIED_PRIMARY_EVIDENCE' then 0
              when 'UNQUANTIFIED_PRIMARY_EVIDENCE' then 1
              when 'MULTIPLE_CREDIBLE_SECONDARY_SOURCES' then 2
              when 'SINGLE_CREDIBLE_SECONDARY_SOURCE' then 3
              when 'COMPANY_SELF_REPORTING' then 4 else 5 end`,
        recency,
      ];
    case 'sources':
      return [desc(events.sourceCount), desc(events.independentSourceCount), recency];
    case 'shortest':
      return [asc(insights.estimatedReadingMinutes), recency];
    case 'recent':
    default:
      return [recency];
  }
}

export async function queryExplore(
  workspaceId: string,
  f: ExploreFilters,
  page = 0,
): Promise<ExploreResult> {
  const where = and(...baseConditions(workspaceId), ...filterConditions(f));

  const rows = await db()
    .select({
      insightId: insights.id,
      eventId: events.id,
      headline: insights.headline,
      takeaway: insights.takeaway,
      novelty: insights.novelty,
      isDemo: insights.isDemo,
      minutes: insights.estimatedReadingMinutes,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      eventType: events.eventType,
      caseMaturity: events.caseMaturity,
      evidenceStrength: events.evidenceStrength,
      verificationStatus: events.verificationStatus,
      firstPartyOnly: events.firstPartyOnly,
      sourceCount: events.sourceCount,
      independentSourceCount: events.independentSourceCount,
      strategicImpact: events.strategicImpact,
      entityNames: sql<string | null>`(
        select string_agg(en.name, ', ' order by en.name)
        from ${eventEntities} ee
        join ${schema.entities} en on en.id = ee.entity_id
        where ee.event_id = ${events.id}
      )`.as('entity_names'),
    })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(where)
    .orderBy(...orderFor(f.sort))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const [count] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(where);

  return {
    rows: rows as ExploreRow[],
    total: count?.n ?? 0,
    windowDays: f.withinDays,
    requestedDays: f.withinDays,
    widened: false,
  };
}

// ── Facets ───────────────────────────────────────────────────────────────────

export interface Facet {
  slug: string;
  label: string;
  count: number;
}

export interface ExploreFacets {
  industries: Facet[];
  topics: Facet[];
  technologies: Facet[];
  companies: Facet[];
  eventTypes: Facet[];
  maturities: Facet[];
  evidenceStrengths: Facet[];
}

/**
 * Counts for one dimension, computed with that dimension's own selection removed.
 *
 * Without the removal, selecting "Pilot" would show every other maturity at zero —
 * true but useless, because you could never see what switching to "Scaled" would give
 * you.
 */
function withoutDimension(f: ExploreFilters, key: keyof ExploreFilters): ExploreFilters {
  const cleared = Array.isArray(f[key]) ? [] : null;
  return { ...f, [key]: cleared } as ExploreFilters;
}

async function taxonomyFacet(
  workspaceId: string,
  f: ExploreFilters,
  kind: 'industry' | 'topic' | 'technology',
  key: keyof ExploreFilters,
  labels: Map<string, string>,
): Promise<Facet[]> {
  const scoped = withoutDimension(f, key);
  const rows = await db()
    .select({
      slug: eventTaxonomy.slug,
      count: sql<number>`count(distinct ${insights.id})::int`,
    })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .innerJoin(eventTaxonomy, eq(eventTaxonomy.eventId, events.id))
    .where(and(...baseConditions(workspaceId), eq(eventTaxonomy.kind, kind), ...filterConditions(scoped)))
    .groupBy(eventTaxonomy.slug)
    .orderBy(desc(sql`count(distinct ${insights.id})`));

  return rows
    .filter((r) => labels.has(r.slug))
    .map((r) => ({ slug: r.slug, label: labels.get(r.slug)!, count: r.count }));
}

async function columnFacet<T extends string>(
  workspaceId: string,
  f: ExploreFilters,
  key: keyof ExploreFilters,
  column: typeof events.caseMaturity | typeof events.evidenceStrength | typeof events.eventType,
  vocabulary: readonly T[],
): Promise<Facet[]> {
  const scoped = withoutDimension(f, key);
  const rows = await db()
    .select({ value: column, count: sql<number>`count(*)::int` })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(and(...baseConditions(workspaceId), ...filterConditions(scoped)))
    .groupBy(column);

  const found = new Map(rows.map((r) => [String(r.value), r.count]));
  return vocabulary
    .map((value) => ({ slug: value, label: humanise(value), count: found.get(value) ?? 0 }))
    .filter((facet) => facet.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function humanise(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export async function queryFacets(
  workspaceId: string,
  f: ExploreFilters,
): Promise<ExploreFacets> {
  // Label lookups are small reference tables; fetched sequentially because the local
  // PGlite backend serialises anyway (ADR 0001).
  const industryLabels = new Map(
    (await db().select({ slug: industries.slug, name: industries.name }).from(industries)).map(
      (r) => [r.slug, r.name],
    ),
  );
  const topicLabels = new Map(
    (await db().select({ slug: topics.slug, name: topics.name }).from(topics)).map((r) => [
      r.slug,
      r.name,
    ]),
  );
  const technologyLabels = new Map(
    (await db().select({ slug: technologies.slug, name: technologies.name }).from(technologies)).map(
      (r) => [r.slug, r.name],
    ),
  );

  /*
   * Every entity, including those with no coverage.
   *
   * This used to start from `insights` and inner-join through to entities, which meant a
   * company nothing had been published about was simply absent from the filter — so
   * searching for a client returned "not found" when the honest answer is "we are not
   * monitoring them". Starting from `entities` and left-joining the filtered set gives
   * every company a row, with a count of zero where that is the truth.
   *
   * No limit: the entity table is reference data in the tens, and truncating it would
   * reintroduce the same invisibility by a different route.
   */
  const companies = await db()
    .select({
      slug: schema.entities.slug,
      label: schema.entities.name,
      count: sql<number>`count(distinct ${insights.id})::int`,
    })
    .from(schema.entities)
    .leftJoin(eventEntities, eq(eventEntities.entityId, schema.entities.id))
    .leftJoin(
      events,
      and(eq(events.id, eventEntities.eventId), eq(events.isSuppressed, false)),
    )
    .leftJoin(
      insights,
      and(
        eq(insights.eventId, events.id),
        eq(insights.workspaceId, workspaceId),
        ...filterConditions(withoutDimension(f, 'entities')),
      ),
    )
    .groupBy(schema.entities.slug, schema.entities.name)
    .orderBy(desc(sql`count(distinct ${insights.id})`), asc(schema.entities.name));

  return {
    industries: await taxonomyFacet(workspaceId, f, 'industry', 'industries', industryLabels),
    topics: await taxonomyFacet(workspaceId, f, 'topic', 'topics', topicLabels),
    technologies: await taxonomyFacet(workspaceId, f, 'technology', 'technologies', technologyLabels),
    companies,
    eventTypes: await columnFacet(workspaceId, f, 'eventTypes', events.eventType, EVENT_TYPES),
    maturities: await columnFacet(workspaceId, f, 'maturities', events.caseMaturity, CASE_MATURITIES),
    evidenceStrengths: await columnFacet(
      workspaceId,
      f,
      'evidenceStrengths',
      events.evidenceStrength,
      EVIDENCE_STRENGTHS,
    ),
  };
}

// ── Suggested filters, derived from the user's own profile ──────────────────

export interface SuggestedFilter {
  id: string;
  icon: string;
  name: string;
  detail: string;
  /** Query-string fragment this suggestion applies. */
  params: Record<string, string>;
  count: number;
  /** False when the suggestion matches everything — worth saying so. */
  narrows: boolean;
}

/**
 * Suggestions built from the signed-in user's stored profile and watchlist.
 *
 * Counts are shown, including the unflattering ones. A suggestion that matches
 * everything is telling the user their profile is too broad for the current coverage,
 * and one that matches two is telling them where the scarce signal is. Hiding that
 * would make the feature look better and be worth less.
 */
export async function querySuggestedFilters(
  workspaceId: string,
  userId: string,
): Promise<SuggestedFilter[]> {
  const profile = await db().query.userProfiles.findFirst({
    where: and(eq(schema.userProfiles.userId, userId), eq(schema.userProfiles.workspaceId, workspaceId)),
  });

  const watched = await db()
    .select({ slug: schema.entities.slug, name: schema.entities.name })
    .from(schema.watchlistItems)
    .innerJoin(schema.watchlists, eq(schema.watchlists.id, schema.watchlistItems.watchlistId))
    .innerJoin(schema.entities, eq(schema.entities.id, schema.watchlistItems.entityId))
    .where(eq(schema.watchlists.workspaceId, workspaceId))
    .limit(12);

  const industryNames = profile?.industrySlugs?.length
    ? await db()
        .select({ name: industries.name })
        .from(industries)
        .where(sql`${industries.slug} = any(${sql.param(profile.industrySlugs)}::text[])`)
    : [];

  const topicNames = profile?.topicSlugs?.length
    ? await db()
        .select({ name: topics.name })
        .from(topics)
        .where(sql`${topics.slug} = any(${sql.param(profile.topicSlugs)}::text[])`)
    : [];

  const budget = profile?.dailyReadingMinutes ?? 12;

  const candidates: Omit<SuggestedFilter, 'count' | 'narrows'>[] = [];

  if (profile?.industrySlugs?.length) {
    candidates.push({
      id: 'my-industries',
      icon: '◆',
      name: 'My industries',
      detail: industryNames.map((i) => i.name).join(', '),
      params: { industry: profile.industrySlugs.join(',') },
    });
  }
  if (watched.length) {
    candidates.push({
      id: 'my-watchlist',
      icon: '★',
      name: 'My watchlist',
      detail:
        watched.slice(0, 3).map((w) => w.name).join(', ') +
        (watched.length > 3 ? ` +${watched.length - 3}` : ''),
      params: { company: watched.map((w) => w.slug).join(',') },
    });
  }
  if (profile?.topicSlugs?.length) {
    candidates.push({
      id: 'my-topics',
      icon: '◈',
      name: 'My topics',
      detail: topicNames.map((t) => t.name).join(', '),
      params: { topic: profile.topicSlugs.join(',') },
    });
  }

  candidates.push(
    {
      id: 'this-week',
      icon: '●',
      name: 'This week',
      detail: 'Occurred or reported in the last 7 days',
      params: { within: '7' },
    },
    {
      id: 'confirmed',
      icon: '✓',
      name: 'Independently confirmed',
      detail: 'At least one non-first-party source',
      params: { independent: '1' },
    },
    {
      id: 'measured',
      icon: '▲',
      name: 'Measured outcomes',
      detail: 'Quantified or independently validated impact',
      params: { maturity: 'QUANTIFIED_BUSINESS_IMPACT,INDEPENDENTLY_VALIDATED_IMPACT' },
    },
    {
      id: 'reversals',
      icon: '▼',
      name: 'Reversals',
      detail: 'Discontinued or rolled back — often the most informative',
      params: { maturity: 'DISCONTINUED_OR_REVERSED' },
    },
    {
      id: 'fits-budget',
      icon: '◷',
      name: `Fits my ${budget} min`,
      detail: 'Short enough for today’s reading budget',
      params: { minutes: '3' },
    },
    {
      id: 'no-self-report',
      icon: '◐',
      name: 'Skip self-reported',
      detail: 'Hide announcements only the company itself has made',
      params: { independent: '1', hideDemo: '1' },
    },
  );

  // An aggregate always returns one row, but the type does not know that.
  const [corpusRow] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(and(...baseConditions(workspaceId)));
  const corpus = corpusRow?.n ?? 0;

  const out: SuggestedFilter[] = [];
  for (const candidate of candidates) {
    const { parseFilters } = await import('./filters');
    const { total } = await queryExplore(workspaceId, parseFilters(candidate.params));
    out.push({ ...candidate, count: total, narrows: total > 0 && total < corpus });
  }
  return out;
}
