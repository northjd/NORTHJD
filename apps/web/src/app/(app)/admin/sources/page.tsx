import { requireAdmin } from '@/lib/session';
import { getCoverage } from '@/lib/queries';
import { Badge, Card, PerspectiveBadge, SectionHeading } from '@mios/ui';
import { formatRelative, freshness } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * Source registry.
 *
 * Every source shows its rights status and the review note verbatim. A source that is
 * not running says why, in the reviewer's own words — which is the difference between
 * a coverage gap you can act on and one you cannot see.
 */
export default async function SourcesPage() {
  await requireAdmin();
  const { sources } = await getCoverage();

  const groups = [
    { key: 'active', label: 'Active', filter: (s: (typeof sources)[number]) => s.isActive && s.rightsStatus === 'approved' },
    { key: 'candidate', label: 'Candidates — registered, not running', filter: (s: (typeof sources)[number]) => s.rightsStatus !== 'approved' },
    { key: 'inactive', label: 'Approved but inactive', filter: (s: (typeof sources)[number]) => !s.isActive && s.rightsStatus === 'approved' },
  ];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Source registry</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          Being publicly reachable is not permission to ingest, store or redistribute. Each source
          carries a rights decision, and the fetcher refuses anything that has not passed review.
        </p>
      </header>

      {groups.map((group) => {
        const items = sources.filter(group.filter);
        if (items.length === 0) return null;
        return (
          <section key={group.key}>
            <SectionHeading>{group.label}</SectionHeading>
            <ul className="space-y-2">
              {items.map((source) => (
                <Card as="li" key={source.slug} className="scroll-mt-20">
                  <div id={source.slug} className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{source.name}</p>
                      <p className="text-[12px] text-[var(--text-subtle)]">{source.endpoint || '—'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PerspectiveBadge perspective={source.perspective} />
                      <Badge tone={source.rightsStatus === 'approved' ? 'verified' : 'caution'}>
                        {(source.rightsStatus ?? 'no policy').replace(/_/g, ' ')}
                      </Badge>
                      <Badge
                        tone={
                          source.health === 'healthy'
                            ? 'verified'
                            : source.health === 'failing'
                              ? 'alert'
                              : 'muted'
                        }
                      >
                        {source.health}
                      </Badge>
                      {source.isDemo ? <Badge tone="alert">demo</Badge> : null}
                    </div>
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--text-subtle)]">
                    <span>connector: {source.connectorType ?? '—'}</span>
                    <span>retains: {source.storageScope?.replace('_', ' ') ?? '—'}</span>
                    <span>
                      last success:{' '}
                      {source.lastSuccessAt ? formatRelative(source.lastSuccessAt) : 'never'} (
                      {freshness(source.lastSuccessAt)})
                    </span>
                    {source.lastFailureAt ? (
                      <span>last failure: {formatRelative(source.lastFailureAt)}</span>
                    ) : null}
                  </dl>

                  {source.lastError ? (
                    <p className="mt-2 rounded bg-alert-100 px-2.5 py-1.5 text-[12px] text-alert-700">
                      {source.lastError}
                    </p>
                  ) : null}

                  {source.reviewNotes ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-[var(--text-subtle)]">
                        Rights review
                      </summary>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                        {source.reviewNotes}
                      </p>
                    </details>
                  ) : null}
                </Card>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
