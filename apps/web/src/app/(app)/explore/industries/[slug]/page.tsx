import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getIndustryPage } from '@/lib/queries';
import { Badge, Card, MaturityBadge, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const { db, schema } = await import('@mios/database');
  const rows = await db().select({ slug: schema.industries.slug }).from(schema.industries);
  return rows.map((r) => ({ slug: r.slug }));
}


/**
 * Industry page — the Market Model layer made readable.
 *
 * This is the Depth half of the product: value chain, business models, profit pools,
 * KPI tree, regulation and, importantly, the open questions the platform cannot
 * currently answer.
 */
export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const page = await getIndustryPage(slug);
  if (!page) notFound();

  const { industry, stages, kpis, models, paths, recentEvents } = page;
  const topKpis = kpis.filter((k) => !k.parentId);
  const childKpis = kpis.filter((k) => k.parentId);

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav className="mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/explore" className="hover:underline underline-offset-2">
          Explore
        </Link>
        <span className="mx-1.5">/</span>
        <span>{industry.name}</span>
      </nav>

      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight">{industry.name}</h1>
        <p className="prose-reading mt-2">{industry.definition}</p>
        {industry.lastReviewedAt ? (
          <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
            Market model last reviewed {formatAbsolute(industry.lastReviewedAt)}. Evergreen content,
            versioned and dated — distinct from the news above it.
          </p>
        ) : null}
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-7">
          <section>
            <SectionHeading>Market structure</SectionHeading>
            <p className="prose-reading">{industry.marketStructure}</p>
          </section>

          <section>
            <SectionHeading hint="Upstream to downstream. Each stage notes where margin actually sits.">
              Value chain
            </SectionHeading>
            <ol className="space-y-2">
              {stages.map((stage, i) => (
                <li key={stage.id} className="surface-flat rounded-md p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-[var(--text-subtle)]">{i + 1}</span>
                    <h3 className="text-[14px] font-semibold">{stage.name}</h3>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {stage.description}
                  </p>
                  {stage.profitPoolNote ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed">
                      <span className="font-medium">Profit pool: </span>
                      <span className="text-[var(--text-muted)]">{stage.profitPoolNote}</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionHeading hint="How participants earn money, and what breaks each model.">
              Business models
            </SectionHeading>
            <ul className="space-y-2">
              {models.map((model) => (
                <li key={model.id} className="surface-flat rounded-md p-3">
                  <h3 className="text-[14px] font-semibold">{model.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {model.description}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed">
                    <span className="font-medium">Economics: </span>
                    <span className="text-[var(--text-muted)]">{model.economics}</span>
                  </p>
                  {model.exampleCompanyNames.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {model.exampleCompanyNames.map((name) => (
                        <Badge key={name} tone="muted">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHeading hint="What moves, and why an executive cares. Children sit under their parent metric.">
              KPI tree
            </SectionHeading>
            <ul className="space-y-2.5">
              {topKpis.map((kpi) => (
                <li key={kpi.id}>
                  <div className="surface-flat rounded-md p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-semibold">{kpi.name}</h3>
                      {kpi.typicalRange ? (
                        <span className="text-[12px] text-[var(--text-subtle)]">{kpi.typicalRange}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{kpi.definition}</p>
                    {kpi.formula ? (
                      <p className="mt-1 font-mono text-[12px] text-[var(--text-subtle)]">{kpi.formula}</p>
                    ) : null}
                    <p className="mt-1.5 text-[13px] leading-relaxed">{kpi.whyItMatters}</p>
                  </div>
                  {childKpis.filter((c) => c.parentId === kpi.id).length > 0 ? (
                    <ul className="mt-2 space-y-2 border-l border-[var(--border)] pl-4">
                      {childKpis
                        .filter((c) => c.parentId === kpi.id)
                        .map((child) => (
                          <li key={child.id}>
                            <h4 className="text-[13px] font-semibold">{child.name}</h4>
                            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                              {child.whyItMatters}
                            </p>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHeading>Regulatory environment</SectionHeading>
            <p className="prose-reading">{industry.regulatoryEnvironment}</p>
          </section>

          <section>
            <SectionHeading>Current transformation agenda</SectionHeading>
            <p className="prose-reading">{industry.transformationAgenda}</p>
          </section>
        </div>

        <aside className="space-y-4">
          {paths.length > 0 ? (
            <Card>
              <SectionHeading>Learning paths</SectionHeading>
              <ul className="space-y-1.5">
                {paths.map((path) => (
                  <li key={path.id} className="text-[13px]">
                    <Link href={`/learn?path=${path.slug}`} className="font-medium text-[var(--accent)] underline underline-offset-2">
                      {path.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">
                      {path.description}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionHeading hint="Events classified into this industry.">Current signals</SectionHeading>
            {recentEvents.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                No events classified into this industry yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentEvents.map((event) => (
                  <li key={event.eventId} className="text-[13px]">
                    <p className="leading-snug">{event.title}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <MaturityBadge maturity={event.maturity} />
                      <span className="text-[11px] text-[var(--text-subtle)]">
                        {formatAbsolute(event.eventAt ?? event.firstReportedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading hint="Questions this model cannot currently answer.">
              Open questions
            </SectionHeading>
            <ul className="space-y-1.5">
              {industry.openQuestions.map((question, i) => (
                <li key={i} className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {question}
                </li>
              ))}
            </ul>
          </Card>

          {industry.sourceRefs.length > 0 ? (
            <Card>
              <SectionHeading>Reference sources</SectionHeading>
              <ul className="space-y-1.5">
                {industry.sourceRefs.map((ref) => (
                  <li key={ref.url} className="text-[13px]">
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2"
                    >
                      {ref.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
