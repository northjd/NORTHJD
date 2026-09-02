import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { parseFilters, activeFilterCount, type SearchParams, CONFIDENCE_LEVELS } from '@/lib/filters';
import { queryExploreWidening, queryFacets, querySuggestedFilters, humanise } from '@/lib/explore-queries';
import { FilterRail, ActiveFilterChips } from '@/components/filter-rail';
import { SuggestedFilters } from '@/components/suggested-filters';
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  EvidenceBadge,
  MaturityBadge,
  NoveltyBadge,
  SectionHeading,
  VerificationBadge,
} from '@mios/ui';
import { EVIDENCE_STRENGTH_RANK, formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * Explore.
 *
 * The filter surface the brief asks for in §15. Every dimension is a stored, indexed
 * column, filtering happens server-side, and the URL is the state — so a filtered view
 * is shareable and survives a reload.
 *
 * Consulting and professional services appears as one company group among several,
 * reached through the same pages and the same filters as any other company. There is no
 * dedicated area for it and no ordering advantage.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseFilters(params);
  const activeCount = activeFilterCount(filters);

  const [{ rows, total, windowDays, requestedDays, widened }, facets, suggestions] = [
    await queryExploreWidening(user.workspaceId, filters),
    await queryFacets(user.workspaceId, filters),
    await querySuggestedFilters(user.workspaceId, user.userId),
  ];

  const profile = await db().query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, user.userId),
  });

  // Reference navigation: the industry models and company groups, shown when nothing is
  // filtered so the page opens as a directory rather than as an unfiltered list.
  const showDirectory = activeCount === 0;

  const industries = showDirectory
    ? await db()
        .select({
          slug: schema.industries.slug,
          name: schema.industries.name,
          definition: schema.industries.definition,
          lastReviewedAt: schema.industries.lastReviewedAt,
          stages: sql<number>`(select count(*)::int from value_chain_stages v where v.industry_id = ${schema.industries.id})`,
          kpis: sql<number>`(select count(*)::int from kpis k where k.industry_id = ${schema.industries.id})`,
        })
        .from(schema.industries)
        .orderBy(asc(schema.industries.name))
    : [];

  const strongEvidence = new Set(['QUANTIFIED_PRIMARY_EVIDENCE', 'UNQUANTIFIED_PRIMARY_EVIDENCE', 'MULTIPLE_CREDIBLE_SECONDARY_SOURCES']);

  return (
    <div className="mx-auto max-w-[1380px]">
      <header className="hero-wash surface mb-6 p-7">
        <p className="t-eyebrow">Explore</p>
        <h1 className="t-display mt-2">Filter the market, then ask about it</h1>
        <p className="t-lede mt-2 max-w-[64ch]">
          Every event was extracted from a monitored publisher source, clustered across
          reports, classified for implementation maturity, and linked to the exact passage it
          came from. Filter on any dimension — press ⌘K to jump, ⌘J to ask.
        </p>
      </header>

      <SuggestedFilters suggestions={suggestions} role={profile?.role ?? ''} />

      <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <FilterRail facets={facets} activeCount={activeCount} />

        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--text-muted)]">
              <span>
                <b className="tabular-nums text-[var(--text)]">{total}</b> insight
                {total === 1 ? '' : 's'} match{total === 1 ? 'es' : ''}
                {rows.length < total ? ` · showing ${rows.length}` : ''}
              </span>
              {/* The window was widened because the requested one was empty. Say so here,
                  next to the count — results must never read as fresher than they are. */}
              {widened ? (
                <span
                  className="rounded border border-caution-500/35 px-1.5 py-0.5 text-[10px] font-medium text-caution-700 dark:text-caution-100"
                  title="Nothing was published in the window you selected, so it was widened. These results are older than you asked for."
                >
                  nothing in {requestedDays} days — showing{' '}
                  {windowDays === null ? 'all time' : `${windowDays} days`}
                </span>
              ) : null}
            </p>
            <ActiveFilterChips />
          </div>

          {rows.length === 0 ? (
            /*
             * An empty result under a Confidence filter is a finding, not a failure —
             * "nothing here clears that bar" is exactly what the filter was asked. So it
             * gets explained rather than shrugged at, with the nearest looser filter
             * offered as the next click.
             */
            filters.confidence ? (
              <div className="surface p-6">
                <p className="t-eyebrow">A result, not an error</p>
                <h2 className="mt-2 text-[17px] font-semibold leading-snug">
                  Nothing in the monitored sources clears the{' '}
                  {CONFIDENCE_LEVELS[filters.confidence].label.toLowerCase()} bar.
                </h2>
                <p className="mt-2.5 max-w-[68ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
                  {CONFIDENCE_LEVELS[filters.confidence].hint} That this returns nothing is
                  itself the most useful thing on the page: it says the corpus is dominated
                  by announcements and self-reporting, which is a real limitation of the
                  current source set rather than a bug in the filter.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['deployed', 'corroborated', 'announced'] as const)
                    .filter((k) => k !== filters.confidence)
                    .map((k) => (
                      <Link
                        key={k}
                        href={`/explore?confidence=${k}`}
                        className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] hover:border-[var(--accent-line)]"
                      >
                        Try “{CONFIDENCE_LEVELS[k].label}”
                      </Link>
                    ))}
                  <Link
                    href="/explore"
                    className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] hover:border-[var(--accent-line)]"
                  >
                    Clear the filter
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No events match these filters."
                body={`That is a statement about the monitored sources, not about the world. Loosen a filter, or check where the coverage gaps are.`}
                action={
                  <Link
                    href="/admin/coverage"
                    className="mt-1 text-[13px] font-medium text-[var(--accent)] underline underline-offset-2"
                  >
                    Coverage dashboard
                  </Link>
                }
              />
            )
          ) : (
            <ul className="grid gap-3">
              {rows.map((r, i) => (
                <Card
                  as="li"
                  key={r.insightId}
                  className={`card-lift animate-rise pl-5`}
                  data-evidence={
                    strongEvidence.has(r.evidenceStrength)
                      ? 'strong'
                      : r.firstPartyOnly || EVIDENCE_STRENGTH_RANK[r.evidenceStrength] >= 4
                        ? 'weak'
                        : undefined
                  }
                  style={{ animationDelay: `${Math.min(i, 12) * 26}ms` }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <NoveltyBadge novelty={r.novelty as never} />
                    <MaturityBadge maturity={r.caseMaturity} />
                    <EvidenceBadge strength={r.evidenceStrength} />
                    {r.verificationStatus === 'DISPUTED' ? (
                      <VerificationBadge status="DISPUTED" />
                    ) : null}
                    {r.firstPartyOnly ? (
                      <Badge tone="caution" title="No independent source has confirmed this.">
                        Self-reported only
                      </Badge>
                    ) : null}
                    {r.isDemo ? <DemoBadge /> : null}
                  </div>

                  <h3 className="t-heading">
                    <Link href={`/insights/${r.insightId}`} className="hover:underline underline-offset-2">
                      {r.headline}
                    </Link>
                  </h3>
                  <p className="t-body mt-1.5">{r.takeaway}</p>

                  <div className="t-meta mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
                    <span title="When the event happened, if a source states it">
                      Event {formatAbsolute(r.eventAt)}
                    </span>
                    <span title="When it was first published">
                      Reported {formatAbsolute(r.firstReportedAt)}
                    </span>
                    <span>
                      {r.sourceCount} source{r.sourceCount === 1 ? '' : 's'}
                      {r.independentSourceCount > 0
                        ? ` · ${r.independentSourceCount} independent`
                        : ''}
                    </span>
                    <span>{r.minutes} min</span>
                    <span>{humanise(r.eventType)}</span>
                    {r.entityNames ? <span>{r.entityNames}</span> : null}
                  </div>
                </Card>
              ))}
            </ul>
          )}

          {showDirectory && industries.length > 0 ? (
            <section className="mt-10">
              <SectionHeading hint="Each has a market model: value chain, business models, KPI tree and open questions.">
                Industry models
              </SectionHeading>
              <ul className="grid gap-3 sm:grid-cols-2">
                {industries.map((industry) => (
                  <Card as="li" key={industry.slug} className="card-lift pl-5">
                    <h3 className="t-heading">
                      <Link
                        href={`/explore/industries/${industry.slug}`}
                        className="hover:underline underline-offset-2"
                      >
                        {industry.name}
                      </Link>
                    </h3>
                    <p className="t-body mt-1 line-clamp-3">{industry.definition}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="muted">{industry.stages} value chain stages</Badge>
                      <Badge tone="muted">{industry.kpis} KPIs</Badge>
                      {industry.lastReviewedAt ? (
                        <Badge tone="muted">Reviewed {formatAbsolute(industry.lastReviewedAt)}</Badge>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
