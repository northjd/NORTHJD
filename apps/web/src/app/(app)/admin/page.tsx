import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { getCoverage, getRecentPipelineRuns } from '@/lib/queries';
import { Badge, Card, SectionHeading, StatusBadge } from '@mios/ui';
import { capabilities } from '@mios/config';
import { formatRelative } from '@mios/domain';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  const coverage = await getCoverage();
  const runs = await getRecentPipelineRuns(5);
  const caps = capabilities();

  const failing = coverage.sources.filter((s) => s.health === 'failing').length;
  const pending = coverage.sources.filter((s) => s.rightsStatus === 'pending_review').length;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Source registry, pipeline health, capability status and evaluation.
        </p>
      </header>

      {coverage.totals.unevidencedFactClaims > 0 ? (
        <div className="rounded border border-alert-500 bg-alert-100 p-3 text-[13px] text-alert-700">
          <strong>{coverage.totals.unevidencedFactClaims} FACT claims have no evidence span.</strong> This
          breaks the core invariant and should be zero. Investigate before trusting anything derived
          from them.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Documents', value: coverage.totals.documents },
          { label: 'Evidenced claims', value: coverage.totals.claims },
          { label: 'Events', value: coverage.totals.events },
          { label: 'Unevidenced facts', value: coverage.totals.unevidencedFactClaims },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
              {stat.label}
            </p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeading hint="What is actually configured. Nothing here is aspirational.">
          Capabilities
        </SectionHeading>
        <ul className="space-y-2.5">
          {caps.map((cap) => (
            <li key={cap.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{cap.label}</span>
                <StatusBadge status={cap.status} />
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">{cap.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHeading
          action={
            <Link href="/admin/sources" className="text-[13px] text-[var(--accent)] underline underline-offset-2">
              Source registry
            </Link>
          }
        >
          Sources
        </SectionHeading>
        <p className="text-[13px] text-[var(--text-muted)]">
          {coverage.sources.length} registered · {failing} failing · {pending} awaiting rights review
        </p>
      </Card>

      <Card>
        <SectionHeading>Recent pipeline runs</SectionHeading>
        {runs.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">
            No runs yet. Run <code className="rounded bg-[var(--surface-inset)] px-1">npm run pipeline</code>.
          </p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-1.5">
                  <Badge tone={run.status === 'succeeded' ? 'verified' : run.status === 'failed' ? 'alert' : 'neutral'}>
                    {run.status}
                  </Badge>
                  <span className="text-[var(--text-muted)]">{run.kind.replace(/_/g, ' ')}</span>
                </span>
                <span className="text-[12px] text-[var(--text-subtle)]">
                  {Object.entries(run.stats as Record<string, number>)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' · ') || 'no changes'}{' '}
                  · {formatRelative(run.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/coverage" className="rounded border border-[var(--border)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--surface-inset)]">
          Coverage dashboard
        </Link>
        <Link href="/admin/evaluation" className="rounded border border-[var(--border)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--surface-inset)]">
          Evaluation
        </Link>
        <Link href="/admin/capabilities" className="rounded border border-[var(--border)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--surface-inset)]">
          Capabilities detail
        </Link>
      </div>
    </div>
  );
}
