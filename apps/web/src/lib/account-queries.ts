/**
 * One company, then the market around it.
 *
 * The journey this serves is: choose a market, see what moved in it and who is in it,
 * choose a company, read that company. So it leads with the company's own events and
 * widens outward — its sector, the others in that sector, the regulators over it, the
 * forces cutting across it. Each rung says what it is, so market context is never
 * mistaken for news about the client.
 *
 * No rung is time-filtered, and that is deliberate. Restricting to "this week" is how a
 * market-intelligence tool shows a blank page on a quiet Tuesday. Each reaches back as
 * far as it needs to and then reports how far that was, so a six-week-old story appears
 * as a six-week-old story rather than being withheld or passed off as current.
 *
 * There is no unfiltered rung. An earlier version ended with the highest-impact events
 * across every source regardless of sector, so the page could never be blank; what it did
 * in practice was append a global news feed to every company. Honest emptiness beats
 * padding.
 *
 * No company is hard-coded anywhere.
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

export type ScopeLevel = 'company' | 'industry' | 'peers' | 'regulatory' | 'topics';

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
  const recorded = [...(entity.primaryIndustry ? [entity.primaryIndustry] : []), ...linked].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

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
  /*
   * No fallback, deliberately.
   *
   * This used to reach for `select slug from topics order by slug limit 6` when the
   * company had no topics of its own — the first six topics alphabetically, which is a
   * arbitrary slice of the corpus presented as though it bore on the company. Better to
   * show no topic rung than an arbitrary one.
   */
  const topicSlugs = profileTopics;

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
  const regulatory = industrySlugs.length
    ? rows<AccountEvent>(
        await db().execute(sql`
          select ${EVENT_COLUMNS}
            from events e
            join event_taxonomy t on t.event_id = e.id and t.kind = 'industry'
                 and t.slug = any(${sql.param(industrySlugs)}::text[])
            left join insights i on i.event_id = e.id
           where e.is_suppressed = false
             and exists (
                   select 1 from event_documents ed
                     join raw_documents rd on rd.id = ed.document_id
                     join sources src on src.id = rd.source_id
                    where ed.event_id = e.id
                      and src.perspective in ('REGULATOR', 'PUBLIC_INSTITUTION'))
           order by coalesce(e.event_at, e.first_reported_at) desc
           limit 8
        `),
      )
    : [];

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
  /*
   * The company first, then its market. Not the other way round.
   *
   * This used to lead with the sector, on the reasoning that a consultant needs the
   * market before the client's press releases. That is true of the market page — and this
   * is not the market page. By the time someone has chosen a sector and clicked a company
   * they have had the market context; what they came for is the company. Leading with the
   * sector meant clicking Zalando and reading about Retail, with Zalando's own news third
   * down the page.
   *
   * The rungs still widen, and each still says what it is, so market context is never
   * mistaken for news about the client. It simply widens *after* the answer rather than
   * in front of it.
   */
  const rungs: AccountRung[] = [
    {
      level: 'company',
      index: '01',
      title: `On ${entity.name}`,
      why: 'Events naming this company directly.',
      emptyMeans: sources.length
        ? `${sources.length} source${sources.length > 1 ? 's are' : ' is'} registered for ${entity.name}, but ${sources.length > 1 ? 'they have' : 'it has'} produced nothing yet.`
        : `No source is registered for ${entity.name}. This silence is about our monitoring, not about the company — the fix is a source, not a better query.`,
      events: direct,
      newestAgeDays: null,
    },
    {
      level: 'industry',
      index: '02',
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
      index: '03',
      title: 'Who else is in it',
      why: `Companies sharing ${industryLabel}, and what they have been doing. A shared industry is what the taxonomy records — not a competitive relationship, which nobody has asserted.`,
      emptyMeans:
        'No other company in this industry has produced an event. Either the sector is unmonitored, or the companies in it are the only ones we track and none has published.',
      events: peerEvents,
      newestAgeDays: null,
    },
    {
      level: 'regulatory',
      index: '04',
      title: 'Regulatory and policy',
      why: `Published by regulators and public institutions, and classified into ${industryLabel}. What a regulator publishes is regulatory by definition, so this is keyed on the source rather than on subject tags — but scoped to the sector, or every company would show the same eight items.`,
      emptyMeans:
        'No regulator or public institution has published anything classified into this sector.',
      events: regulatory,
      newestAgeDays: null,
    },
    {
      level: 'topics',
      index: '05',
      title: 'Cross-industry forces',
      why: 'Pricing, supply chain, workforce and technology cut across sectors, and these are the ones recorded against your own profile.',
      emptyMeans: 'No topic-classified events bear on this company.',
      events: topicEvents,
      newestAgeDays: null,
    },
  ];

  /*
   * There is no "everything monitored" rung any more.
   *
   * It carried no filter at all — the highest-impact events across every source
   * regardless of sector — and existed so the page could never be blank. What it actually
   * did was append a global news feed to every company page, which is what "the
   * information below the summary is unrelated" turned out to mean. A page that honestly
   * says nothing is monitored here is more useful than one padded with a shipping story
   * on a fashion company.
   */

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

/* ── Market view ───────────────────────────────────────────────────────────── */

export interface MarketCompany {
  slug: string;
  name: string;
  events: number;
  lastSeen: Date | null;
}

export interface MarketBoard {
  industry: { slug: string; name: string; definition: string | null; isModelled: boolean };
  events: AccountEvent[];
  companies: MarketCompany[];
  regulatory: AccountEvent[];
  newestAgeDays: number | null;
}

/**
 * A market before any company is chosen.
 *
 * Market search starts here on purpose: you pick a sector, see what moved in it and who
 * is in it, and only then narrow to one company. Starting from a company assumes you
 * already know which one matters, which is the opposite of what a market-intelligence
 * tool is for.
 *
 * Companies are listed whether or not anything has been published about them. A zero is
 * a coverage statement, and the company page says what would change it.
 */
export async function queryMarket(
  workspaceId: string,
  industrySlug: string,
): Promise<MarketBoard | null> {
  const [industry] = rows<{
    slug: string;
    name: string;
    definition: string | null;
    stages: number;
  }>(
    await db().execute(sql`
      select i.slug, i.name, i.definition,
             (select count(*)::int from value_chain_stages v where v.industry_id = i.id) stages
        from industries i where i.slug = ${sql.param(industrySlug)}
    `),
  );
  if (!industry) return null;

  const events = rows<AccountEvent>(
    await db().execute(sql`
      select ${EVENT_COLUMNS}
        from events e
        join event_taxonomy t on t.event_id = e.id and t.kind = 'industry'
             and t.slug = ${sql.param(industrySlug)}
        left join insights i on i.event_id = e.id and i.workspace_id = ${sql.param(workspaceId)}
       where e.is_suppressed = false
       order by coalesce(e.event_at, e.first_reported_at) desc
       limit 20
    `),
  );

  const companies = rows<MarketCompany>(
    await db().execute(sql`
      select en.slug, en.name,
             count(distinct e.id)::int                        as events,
             max(coalesce(e.event_at, e.first_reported_at))   as "lastSeen"
        from entities en
        join entity_industries ei on ei.entity_id = en.id
        join industries ind on ind.id = ei.industry_id and ind.slug = ${sql.param(industrySlug)}
        left join event_entities ee on ee.entity_id = en.id
        left join events e on e.id = ee.event_id and e.is_suppressed = false
       group by en.slug, en.name
       order by count(distinct e.id) desc, en.name asc
    `),
  );

  /*
   * Regulatory items *in this sector*.
   *
   * The industry join is the whole point and was missing: without it every market showed
   * the same eight items, so a tobacco page presented retail and AI regulation as though
   * it were tobacco regulation. Keying on source perspective is still right — what a
   * regulator publishes is regulatory by definition, whatever subject tags it carries —
   * but it has to be scoped to the sector being read.
   */
  const regulatory = rows<AccountEvent>(
    await db().execute(sql`
      select ${EVENT_COLUMNS}
        from events e
        join event_taxonomy t on t.event_id = e.id and t.kind = 'industry'
             and t.slug = ${sql.param(industrySlug)}
        left join insights i on i.event_id = e.id and i.workspace_id = ${sql.param(workspaceId)}
       where e.is_suppressed = false
         and exists (
               select 1 from event_documents ed
                 join raw_documents rd on rd.id = ed.document_id
                 join sources src on src.id = rd.source_id
                where ed.event_id = e.id
                  and src.perspective in ('REGULATOR', 'PUBLIC_INSTITUTION'))
       order by coalesce(e.event_at, e.first_reported_at) desc
       limit 8
    `),
  );

  const newest = events
    .map((e) => e.eventAt ?? e.firstReportedAt)
    .filter((d): d is Date => d != null)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a)[0];

  return {
    industry: {
      slug: industry.slug,
      name: industry.name,
      definition: industry.definition,
      // Four sectors carry a full market model; the rest exist for classification.
      isModelled: industry.stages > 0,
    },
    events,
    companies,
    regulatory,
    newestAgeDays: newest ? Math.max(0, Math.floor((Date.now() - newest) / 86_400_000)) : null,
  };
}

/** Every industry, with how much has been published in it. */
export async function queryMarketIndex(): Promise<
  { slug: string; name: string; events: number; companies: number }[]
> {
  return rows(
    await db().execute(sql`
      select i.slug, i.name,
             (select count(*)::int from event_taxonomy t
                join events e on e.id = t.event_id and e.is_suppressed = false
               where t.kind = 'industry' and t.slug = i.slug)      as events,
             (select count(*)::int from entity_industries ei
               where ei.industry_id = i.id)                        as companies
        from industries i
       order by 3 desc, i.name asc
    `),
  );
}

/* ── Company profile ───────────────────────────────────────────────────────── */

export interface ProfileFact {
  label: string;
  /** Null renders as "not available from monitored sources", never as a guess. */
  value: string | null;
  /** Where the value came from, when there is one. */
  source?: string;
  /** What would have to exist for this to be filled in. */
  missingBecause?: string;
}

export interface CompanyProfile {
  identity: ProfileFact[];
  financial: ProfileFact[];
  /** Brand and trade names recorded as aliases, which is the only place we hold them. */
  brands: string[];
  /** Sources registered against this company specifically. */
  ownSources: { name: string; perspective: string }[];
}

/**
 * The company profile, and an honest account of what is missing from it.
 *
 * A market-intelligence page is expected to open with revenue, growth, margin, headcount
 * and market share. This corpus holds none of them: it is built from news feeds, and a
 * news feed does not carry a balance sheet. The entity table has a `publicProfile` column
 * for exactly these figures, annotated "only what a public source states, never inferred
 * financials", and it is empty.
 *
 * Two ways to fill it were examined and rejected today rather than quietly fudged.
 * Wikidata carries revenue and headcount for most large companies, but its statements are
 * years stale — it returns H&M's revenue as the 2014 figure, and a 2014 number on a 2026
 * page is worse than a blank one because it looks like an answer. SEC EDGAR is current
 * and authoritative but covers US filers only, which excludes Migros, Coop, Aldi, Rewe
 * and Breuninger — precisely the companies this practice cares about.
 *
 * So every financial field returns `null` with the reason it is null. That is the
 * behaviour the brief asked for: do not estimate, do not invent, say what is not there.
 */
export async function queryCompanyProfile(slug: string): Promise<CompanyProfile | null> {
  const [row] = rows<{
    name: string;
    legalName: string | null;
    description: string | null;
    officialDomain: string | null;
    ticker: string | null;
    hq: string | null;
    hqName: string | null;
    businessModel: string | null;
    industries: string | null;
    publicProfile: { label: string; value: string; sourceUrl: string }[] | null;
  }>(
    await db().execute(sql`
      select en.name, en.legal_name as "legalName", en.description,
             en.official_domain as "officialDomain", en.ticker,
             en.hq_geography_slug as "hq",
             (select g.name from geographies g where g.slug = en.hq_geography_slug) as "hqName",
             en.business_model_slug as "businessModel",
             en.public_profile as "publicProfile",
             (select string_agg(i.name, ', ' order by i.name)
                from entity_industries ei join industries i on i.id = ei.industry_id
               where ei.entity_id = en.id) as industries
        from entities en where en.slug = ${sql.param(slug)}
    `),
  );
  if (!row) return null;

  // Trade and brand aliases are the only brand data we hold. Legal names and tickers are
  // the same company under another label, so they are excluded.
  const brands = rows<{ alias: string; aliasType: string }>(
    await db().execute(sql`
      select al.alias, al.alias_type as "aliasType" from entity_aliases al
        join entities en on en.id = al.entity_id
       where en.slug = ${sql.param(slug)}
         and al.alias_type not in ('legal', 'ticker', 'abbreviation')
       order by al.alias
    `),
  )
    .map((a) => a.alias)
    .filter((a) => a.toLowerCase() !== row.name.toLowerCase());

  const ownSources = rows<{ name: string; perspective: string }>(
    await db().execute(sql`
      select s.name, s.perspective from sources s
       where s.subject_entity_id = (select id from entities where slug = ${sql.param(slug)})
    `),
  );

  const stated = new Map((row.publicProfile ?? []).map((p) => [p.label.toLowerCase(), p]));
  const fromRegistry = (label: string, missingBecause: string): ProfileFact => {
    const hit = stated.get(label.toLowerCase());
    return hit
      ? { label, value: hit.value, source: hit.sourceUrl }
      : { label, value: null, missingBecause };
  };

  const NO_FINANCIALS =
    'No monitored source publishes company financials. A filings connector — EDGAR for US filers, or the company’s own investor-relations feed — would supply it.';

  return {
    identity: [
      {
        label: 'Business',
        value: row.description || null,
        missingBecause: 'No description recorded.',
      },
      { label: 'Legal name', value: row.legalName || null, missingBecause: 'Not recorded.' },
      {
        label: 'Headquarters',
        value: row.hqName ?? row.hq ?? null,
        missingBecause: 'Not recorded.',
      },
      {
        label: 'Markets',
        value: row.industries || null,
        missingBecause: 'Not classified into any sector.',
      },
      {
        label: 'Business model',
        value: row.businessModel || null,
        missingBecause: 'Not recorded.',
      },
      {
        label: 'Listing',
        value: row.ticker || null,
        missingBecause: 'No ticker recorded — the company may be private.',
      },
      { label: 'Website', value: row.officialDomain || null, missingBecause: 'Not recorded.' },
    ],
    financial: [
      fromRegistry('Latest annual revenue', NO_FINANCIALS),
      fromRegistry('Revenue growth', NO_FINANCIALS),
      fromRegistry('Operating margin', NO_FINANCIALS),
      fromRegistry('Employees', NO_FINANCIALS),
      fromRegistry('Market capitalisation', NO_FINANCIALS),
      fromRegistry(
        'Market share',
        'Market share requires a defined market, geography and period from a credible source. Nothing in the registry publishes it, and estimating it would be a fabrication.',
      ),
    ],
    brands,
    ownSources,
  };
}
