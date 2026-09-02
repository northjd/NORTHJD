import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getCompanyPage } from '@/lib/queries';
import {
  Badge,
  Card,
  DemoBadge,
  EvidenceBadge,
  MaturityBadge,
  PerspectiveBadge,
  SectionHeading,
  VerificationBadge,
} from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const page = await getCompanyPage(user.workspaceId, slug);
  if (!page) notFound();

  const { entity, timeline, industry, monitoringSources } = page;

  const byMaturity = timeline.reduce<Record<string, number>>((acc, e) => {
    acc[e.maturity] = (acc[e.maturity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav className="mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/explore" className="hover:underline underline-offset-2">
          Explore
        </Link>
        <span className="mx-1.5">/</span>
        <span>{entity.name}</span>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{entity.kind.replace(/_/g, ' ')}</Badge>
          {industry ? (
            <Link href={`/explore/industries/${industry.slug}`}>
              <Badge tone="accent">{industry.name}</Badge>
            </Link>
          ) : null}
          {entity.ticker ? <Badge tone="muted">{entity.ticker}</Badge> : null}
          {entity.isDemo ? <DemoBadge /> : null}
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">{entity.name}</h1>
        {entity.legalName && entity.legalName !== entity.name ? (
          <p className="text-[13px] text-[var(--text-subtle)]">{entity.legalName}</p>
        ) : null}
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-[var(--text-muted)]">
          {entity.description}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <SectionHeading hint="Every event this company appears in, newest first. Dates distinguish when it happened from when it was reported.">
            Timeline
          </SectionHeading>

          {timeline.length === 0 ? (
            <Card>
              <p className="text-[14px] font-medium">No events recorded for {entity.name}.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {monitoringSources.length === 0
                  ? 'No source in this workspace is registered as speaking for this company. That is a coverage gap, not evidence that nothing happened.'
                  : `${monitoringSources.length} source${monitoringSources.length === 1 ? ' is' : 's are'} monitored for this company, but nothing has been ingested yet.`}
              </p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {timeline.map((event) => (
                <Card as="li" key={event.eventId}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="muted">{event.eventType.replace(/_/g, ' ')}</Badge>
                    <MaturityBadge maturity={event.maturity} />
                    <EvidenceBadge strength={event.evidenceStrength} />
                    {event.verificationStatus === 'DISPUTED' ? (
                      <VerificationBadge status="DISPUTED" />
                    ) : null}
                    {event.firstPartyOnly ? <Badge tone="caution">Self-reported only</Badge> : null}
                    {event.isDemo ? <DemoBadge /> : null}
                  </div>

                  <h3 className="text-[15px] font-semibold leading-snug">
                    {event.insightId ? (
                      <Link href={`/insights/${event.insightId}`} className="hover:underline underline-offset-2">
                        {event.title}
                      </Link>
                    ) : (
                      event.title
                    )}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {event.summary}
                  </p>
                  <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">
                    Event {formatAbsolute(event.eventAt)} · reported {formatAbsolute(event.firstReportedAt)} ·{' '}
                    {event.sourceCount} source{event.sourceCount === 1 ? '' : 's'}
                  </p>
                </Card>
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <SectionHeading hint="What we watch — and, by omission, what we do not.">
              Source coverage
            </SectionHeading>
            {monitoringSources.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                No first-party source registered. Events involving this company arrive only when
                another monitored source mentions it.
              </p>
            ) : (
              <ul className="space-y-2">
                {monitoringSources.map((source) => (
                  <li key={source.slug} className="text-[13px]">
                    <span className="font-medium">{source.name}</span>
                    <div className="mt-0.5">
                      <PerspectiveBadge perspective={source.perspective} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-[var(--border)] pt-2 text-[12px] leading-relaxed text-[var(--text-subtle)]">
              A thin timeline means limited monitoring, not an inactive company.
            </p>
          </Card>

          {Object.keys(byMaturity).length > 0 ? (
            <Card>
              <SectionHeading hint="Announcements versus things actually evidenced as deployed.">
                Implementation mix
              </SectionHeading>
              <ul className="space-y-1.5 text-[13px]">
                {Object.entries(byMaturity)
                  .sort((a, b) => b[1] - a[1])
                  .map(([maturity, count]) => (
                    <li key={maturity} className="flex items-center justify-between gap-2">
                      <MaturityBadge maturity={maturity as never} />
                      <span className="font-medium">{count}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 border-t border-[var(--border)] pt-2 text-[12px] leading-relaxed text-[var(--text-subtle)]">
                Counting announcements is not a measure of market leadership, and this view does not
                claim it is.
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
