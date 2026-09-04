/**
 * One account, widened by scope until it has something to say.
 *
 * The first version of this keyed everything off the entity's primary industry, so an
 * unclassified company produced three empty rings — a blank screen for exactly the user
 * who most needs context. This walks a ladder instead, mirroring the time ladder in
 * `queryExploreWidening`:
 *
 *     the company → who it is compared against → its industry → its topics → the market
 *
 * and reports which rung produced the answer. The final rung carries no filter at all,
 * so the result is never empty. "Nothing on the company itself, but here is what moved in its
 * market" is the whole point of a market-intelligence product; a blank page is not
 * something a consultant can take into a meeting.
 *
 * No company is hard-coded anywhere. The subject comes from a configured mission where
 * one exists, otherwise from the watchlist, otherwise from an explicit choice.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

export interface AccountEvent {
  id: string;
  title: string;
  caseMaturity: string;
  evidenceStrength: string;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  sourceCount: number;
  independentSourceCount: number;
  firstPartyOnly: boolean;
  insightId: string | null;
  entityNames: string | null;
}

export type ScopeLevel = 'industry' | 'peers' | 'company' | 'regulatory' | 'topics' | 'market';

export interface AccountRung {
  level: ScopeLevel;
  index: string;
  title: string;
  why: string;
  /** What this particular kind of empty means, and what would fix it. */
  emptyMeans: string;
  events: AccountEvent[];
  /**
   * Age of the newest item in this rung, in days.
   *
   * Rungs are never time-filtered: restricting them to "today" is how a market
   * intelligence tool ends up showing nothing on a quiet Tuesday. They reach as far
   * back as they need to and then say how far that was, so nothing is passed off as
   * fresher than it is. Null when the rung is empty.
   */
  newestAgeDays: number | null;
}

export interface AccountBoard {
  entity: {
    slug: string;
    name: string;
    legalName: string | null;
    description: string | null;
    aliases: string | null;
  };
  industryNames: string | null;
  /** Recorded against the company, excluding any override. */
  recordedIndustryNames: string | null;
  industrySlugs: string[];
  industryIsInferred: boolean;
  allIndustries: { slug: string; name: string }[];
  peers: { slug: string; name: string; events: number }[];
  sources: { name: string; perspective: string }[];
  rungs: AccountRung[];
  /** The first rung with anything in it. */
  leadWith: ScopeLevel;
  /** Rungs above the lead that were empty, so the UI can explain the jump. */
  skipped: AccountRung[];
}

const EVENT_COLUMNS = sql`
  e.id,
  e.title,
  e.case_maturity             as "caseMaturity",
  e.evidence_strength         as "evidenceStrength",
  e.event_at                  as "eventAt",
  e.first_reported_at         as "firstReportedAt",
  e.source_count              as "sourceCount",
  e.independent_source_count  as "independentSourceCount",
  e.first_party_only          as "firstPartyOnly",
  i.id                        as "insightId",
  (select string_agg(en2.name, ', ')
     from event_entities ee2
     join entities en2 on en2.id = ee2.entity_id
    where ee2.event_id = e.id) as "entityNames"
`;

const rows = <T>(result: { rows?: unknown[] }): T[] => (result.rows ?? []) as T[];

export async function queryAccount(
  workspaceId: string,
  slug: string,
  industryOverride?: string | null,
): Promise<AccountBoard | null> {
  void workspaceId;

  const entityRows = rows<{
    slug: string;
    name: string;
    legalName: string | null;
    description: string | null;
    aliases: string | null;
    primaryIndustry: string | null;
  }>(
    await db().execute(sql`
      select en.slug, en.name, en.legal_name as "legalName", en.description,
             (select string_agg(al.alias, ', ') from entity_aliases al
               where al.entity_id = en.id) as aliases,
             (select i.slug from industries i where i.id = en.primary_industry_id) as "primaryIndustry"
        from entities en where en.slug = ${sql.param(slug)}
    `),
  );
  const entity = entityRows[0];
  if (!entity) return null;

  // Industry resolution, most specific first. A null primary industry must not end the
  // search — the join table often knows, and failing that the user's own profile does.
  const linked = rows<{ slug: string }>(
    await db().execute(sql`
      select i.slug from entity_industries ei
        join industries i on i.id = ei.industry_id
        join entities en on en.id = ei.entity_id
       where en.slug = ${sql.param(slug)}
    `),
  ).map((r) => r.slug);

  const profileRows = rows<{ industrySlugs: string[]; topicSlugs: string[] }>(
    await db().execute(sql`
      select industry_slugs as "industrySlugs", topic_slugs as "topicSlugs"
        from user_profiles limit 1
    `),
  );
  const profileIndustries = profileRows[0]?.industrySlugs ?? [];
  const profileTopics = profileRows[0]?.topicSlugs ?? [];

  /*
   * An override replaces; it does not add.
   *
   * Merging the two meant that reading Inditex through Tobacco still scoped every rung
   * to retail and fashion as well, so "who else is in this market" answered Amazon and
   * Walmart. That is the opposite of what choosing an industry is for.
   */
  const recorded = [
    ...(entity.primaryIndustry ? [entity.primaryIndustry] : []),
    ...linked,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const own = industryOverride ? [industryOverride] : recorded;

  const industrySlugs = own.length ? own : profileIndustries;
  const industryIsInferred = own.length === 0 && profileIndustries.length > 0;

  // Kept separate so the surface can say "instead of …" and name what was replaced.
  const recordedSlugs = recorded;

  const recordedIndustryNames =
    recordedSlugs.length > 0
      ? (rows<{ names: string | null }>(
          await db().execute(sql`
            select string_agg(name, ', ') as names from industries
             where slug = any(${sql.param(recordedSlugs)}::text[])
          `),
        )[0]?.names ?? null)
      : null;

  const industryNames =
    industrySlugs.length > 0
      ? (rows<{ names: string | null }>(
          await db().execute(sql`
            select string_agg(name, ', ') as names from industries
             where slug = any(${sql.param(industrySlugs)}::text[])
          `),
        )[0]?.names ?? null)
      : null;

  const allIndustries = rows<{ slug: string; name: string }>(
    await db().execute(sql`select slug, name from industries order by name`),
  );

  const direct = rows<AccountEvent>(
    await db().execute(sql`
      select ${EVENT_COLUMNS}
        from events e
        join event_entities ee on ee.event_id = e.id
        join entities en on en.id = ee.entity_id
        left join insights i on i.event_id = e.id
       where en.slug = ${sql.param(slug)} and e.is_suppressed = false
       order by coalesce(e.event_at, e.first_reported_at) desc
       limit 15
    `),
  );

  const peers = industrySlugs.length
    ? rows<{ slug: string; name: string; events: number }>(
        await db().execute(sql`
          select en.slug, en.name, count(distinct e.id)::int as events
            from entities en
            join entity_industries ei on ei.entity_id = en.id
            join industries ind on ind.id = ei.industry_id
                 and ind.slug = any(${sql.param(industrySlugs)}::text[])
            left join event_entities ee on ee.entity_id = en.id
            left join events e on e.id = ee.event_id and e.is_suppressed = false
           where en.slug <> ${sql.param(slug)}
           group by en.slug, en.name
           order by count(distinct e.id) desc, en.name
           limit 12
        `),
      )
    : [];

  const peerSlugs = peers.filter((p) => p.events > 0).map((p) => p.slug);
  const peerEvents = peerSlugs.length
    ? rows<AccountEvent>(
        await db().execute(sql`
          select ${EVENT_COLUMNS}
            from events e
            join event_entities ee on ee.event_id = e.id
            join entities en on en.id = ee.entity_id
            left join insights i on i.event_id = e.id
           where en.slug = any(${sql.param(peerSlugs)}::text[]) and e.is_suppressed = false
           order by coalesce(e.event_at, e.first_reported_at) desc
           limit 12
        `),
      )
    : [];

  const industryEvents = industrySlugs.length
    ? rows<AccountEvent>(
        await db().execute(sql`
          select ${EVENT_COLUMNS}
            from events e
            join event_taxonomy t on t.event_id = e.id and t.kind = 'industry'
                 and t.slug = any(${sql.param(industrySlugs)}::text[])
            left join insights i on i.event_id = e.id
           where e.is_suppressed = false
             and not exists (
                   select 1 from event_entities ee3
                     join entities en3 on en3.id = ee3.entity_id
                    where ee3.event_id = e.id and en3.slug = ${sql.param(slug)})
           order by coalesce(e.event_at, e.first_reported_at) desc
           limit 12
        `),
      )
    : [];

  // Topics cut across industries, so they keep working when the industry itself has no
  // coverage — regulation, pricing, supply chain and workforce apply to a tobacco client
  // as readily as to a retailer.
  const topicSlugs = profileTopics.length
    ? profileTopics
    : rows<{ slug: string }>(
        await db().execute(sql`select slug from topics order by slug limit 6`),
      ).map((r) => r.slug);

  const topicEvents = topicSlugs.length
    ? rows<AccountEvent>(
        await db().execute(sql`
          select ${EVENT_COLUMNS}
            from events e
            join event_taxonomy t on t.event_id = e.id and t.kind = 'topic'
                 and t.slug = any(${sql.param(topicSlugs)}::text[])
            left join insights i on i.event_id = e.id
           where e.is_suppressed = false
             and not exists (
                   select 1 from event_entities ee3
                     join entities en3 on en3.id = ee3.entity_id
                    where ee3.event_id = e.id and en3.slug = ${sql.param(slug)})
           order by coalesce(e.event_at, e.first_reported_at) desc
           limit 12
        `),
      )
    : [];

  /*
   * Regulatory and policy activity.
   *
   * Keyed on the *source's* perspective rather than a topic tag: nothing in this corpus
   * is tagged `regulation` even though the European Commission, NIST and SEC EDGAR are
   * all registered, because the classifier tags subject matter and not provenance. What
   * a regulator publishes is regulatory by definition, which makes the source the more
   * reliable signal.
   */
  const regulatory = rows<AccountEvent>(
    await db().execute(sql`
      select ${EVENT_COLUMNS}
        from events e
        left join insights i on i.event_id = e.id
       where e.is_suppressed = false
         and exists (
               select 1 from event_documents ed
                 join raw_documents rd on rd.id = ed.document_id
                 join sources src on src.id = rd.source_id
                where ed.event_id = e.id
                  and src.perspective in ('REGULATOR', 'PUBLIC_INSTITUTION'))
       order by coalesce(e.event_at, e.first_reported_at) desc
       limit 12
    `),
  );

  // The final rung: no filter at all, ranked by impact then recency. This is what
  // guarantees the page is never empty.
  const market = rows<AccountEvent>(
    await db().execute(sql`
      select ${EVENT_COLUMNS}
        from events e
        left join insights i on i.event_id = e.id
       where e.is_suppressed = false
       order by case e.strategic_impact
                  when 'very_high' then 0 when 'high' then 1
                  when 'moderate' then 2 else 3 end,
                coalesce(e.event_at, e.first_reported_at) desc
       limit 12
    `),
  );

  const sources = rows<{ name: string; perspective: string }>(
    await db().execute(sql`
      select s.name, s.perspective
        from sources s
       where s.subject_entity_id = (select id from entities where slug = ${sql.param(slug)})
    `),
  );

  const industryLabel = industryNames ?? 'their industry';

  /*
   * Market first, client second.
   *
   * The earlier order started with the company and widened outward, which reads as "here
   * is your company, and failing that, here is everything else" — and on an account with
   * no coverage it opened on an apology. Leading with the market matches what the tool
   * is for: a consultant walking into a meeting needs what is moving in the sector before
   * they need the four press releases their client happened to issue.
   *
   * The client's own events keep their own rung and are never folded into the market
   * ones, because "your client did this" and "this happened in your client's market" are
   * different claims and must not be blurred.
   */
  const rungs: AccountRung[] = [
    {
      level: 'industry',
      index: '01',
      title: industryNames ? `What moved in ${industryNames}` : 'What moved in the market',
      why: `Events in ${industryLabel}, with ${entity.name}'s own removed so this reads as context rather than repetition.`,
      emptyMeans: industrySlugs.length
        ? `No event is classified under ${industryLabel}. No source in the registry covers this sector yet — that is a gap in our monitoring, not quiet in the market.`
        : `${entity.name} carries no industry classification, so there is no sector to report on.`,
      events: industryEvents,
      newestAgeDays: null,
    },
    {
      level: 'peers',
      index: '02',
      title: 'Who is moving in it',
      why: `Companies sharing ${industryLabel}, and what they have been doing. A shared industry is what the taxonomy records — not a competitive relationship, which nobody has asserted.`,
      emptyMeans:
        'No other company in this industry has produced an event. Either the sector is unmonitored, or the companies in it are the only ones we track and none has published.',
      events: peerEvents,
      newestAgeDays: null,
    },
    {
      level: 'company',
      index: '03',
      title: `On ${entity.name}`,
      why: 'Events naming this company directly.',
      emptyMeans: sources.length
        ? `${sources.length} source${sources.length > 1 ? 's are' : ' is'} registered for ${entity.name}, but ${sources.length > 1 ? 'they have' : 'it has'} produced nothing yet.`
        : `No source is registered for ${entity.name}. This silence is about our monitoring, not about the company — the fix is a source, not a better query.`,
      events: direct,
      newestAgeDays: null,
    },
    {
      level: 'regulatory',
      index: '04',
      title: 'Regulatory and policy',
      why: 'Published by regulators and public institutions. What a regulator publishes is regulatory by definition, so this is keyed on the source rather than on subject tags.',
      emptyMeans:
        'No regulator or public institution in the registry has published anything ingested so far.',
      events: regulatory,
      newestAgeDays: null,
    },
    {
      level: 'topics',
      index: '05',
      title: 'Cross-industry forces',
      why: 'Pricing, supply chain, workforce, regulation and technology cut across sectors. These keep working when an industry itself has no coverage — they bear on a tobacco client as readily as on a retailer.',
      emptyMeans: 'No topic-classified events.',
      events: topicEvents,
      newestAgeDays: null,
    },
    {
      level: 'market',
      index: '06',
      title: 'Everything monitored',
      why: 'Highest strategic impact across every source, regardless of sector. The floor that stops this page ever being blank.',
      emptyMeans: 'The corpus is empty. Run the ingestion pipeline.',
      events: market,
      newestAgeDays: null,
    },
  ];

  // Stamp each rung with how old its freshest item is, so the surface can say "nothing
  // this week; the most recent is from three weeks ago" instead of implying currency.
  const now = Date.now();
  for (const rung of rungs) {
    const newest = rung.events
      .map((e) => e.eventAt ?? e.firstReportedAt)
      .filter((d): d is Date => d != null)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => b - a)[0];
    rung.newestAgeDays = newest ? Math.max(0, Math.floor((now - newest) / 86_400_000)) : null;
  }

  const leadIndex = rungs.findIndex((r) => r.events.length > 0);
  const resolvedLead = leadIndex === -1 ? rungs.length - 1 : leadIndex;

  return {
    entity: {
      slug: entity.slug,
      name: entity.name,
      legalName: entity.legalName,
      description: entity.description,
      aliases: entity.aliases,
    },
    industryNames,
    recordedIndustryNames,
    industrySlugs,
    industryIsInferred,
    allIndustries,
    peers,
    sources,
    rungs,
    leadWith: rungs[resolvedLead]!.level,
    skipped: rungs.slice(0, resolvedLead).filter((r) => r.events.length === 0),
  };
}
