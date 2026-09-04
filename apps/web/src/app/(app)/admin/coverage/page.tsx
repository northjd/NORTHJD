import { requireAdmin } from '@/lib/session';
import { getCoverage } from '@/lib/queries';
import { Card, SectionHeading } from '@mios/ui';
import { freshness } from '@mios/domain';

export const dynamic = 'force-dynamic';

export default async function CoveragePage() {
  await requireAdmin();
  const { sources, totals } = await getCoverage();

  const count = <T,>(items: T[], key: (t: T) => string | null | undefined) => {
    const map = new Map<string, number>();
    for (const item of items) {
      const k = key(item);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byPerspective = count(sources, (s) => s.perspective);
  const byType = count(sources, (s) => s.sourceType);
  const byLanguage = count(sources, (s) => s.language);
  const industries = count(
    sources.flatMap((s) => (s.industrySlugs ?? []).map((slug) => ({ slug }))),
    (s) => s.slug,
  );
  const regions = count(
    sources.flatMap((s) => (s.geographySlugs ?? []).map((slug) => ({ slug }))),
    (s) => s.slug,
  );

  const stale = sources.filter(
    (s) => s.isActive && ['stale', 'ageing', 'unknown'].includes(freshness(s.lastSuccessAt)),
  );

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Coverage</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          What is monitored, in which languages and regions, and how current it is. The gaps matter
          as much as the totals: everything outside this set is invisible to the product, and the
          product should say so rather than imply completeness.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Documents', value: totals.documents },
          { label: 'Claims', value: totals.claims },
          { label: 'Events', value: totals.events },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
              {stat.label}
            </p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: 'Source perspective', hint: 'Independence of the monitored set.', data: byPerspective },
          { title: 'Source type', hint: '', data: byType },
          { title: 'Industries covered', hint: '', data: industries },
          { title: 'Regions covered', hint: '', data: regions },
          { title: 'Languages', hint: 'Multilingual ingestion is supported; coverage is currently narrow.', data: byLanguage },
        ].map((block) => (
          <Card key={block.title}>
            <SectionHeading hint={block.hint || undefined}>{block.title}</SectionHeading>
            <ul className="space-y-1 text-[13px]">
              {block.data.map(([label, n]) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{label.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeading hint="Active sources that have not synchronised recently.">
          Freshness problems
        </SectionHeading>
        {stale.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">All active sources synchronised recently.</p>
        ) : (
          <ul className="space-y-1.5 text-[13px]">
            {stale.map((source) => (
              <li key={source.slug} className="flex justify-between gap-2">
                <span>{source.name}</span>
                <span className="text-[var(--text-subtle)]">{freshness(source.lastSuccessAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading>Known coverage gaps</SectionHeading>
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
          <li>· No regulatory filings connector: SEC EDGAR is registered but the filing API connector is not implemented.</li>
          <li>· Coverage is English-only in practice, despite multilingual support in the model.</li>
          <li>· Feed sources provide the publisher&apos;s summary, not the article body, so evidence spans are short.</li>
          <li>· Several first-party newsrooms publish no feed and are registered as candidates only.</li>
          <li>· No licensed premium sources; paywalled reporting is entirely absent.</li>
        </ul>
      </Card>
    </div>
  );
}
