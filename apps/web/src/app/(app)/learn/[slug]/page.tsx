import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, KnownUnknowns, MaturityBadge, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import { KnowledgeCheck } from '@/components/knowledge-check';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const { db, schema } = await import('@mios/database');
  const rows = await db().select({ slug: schema.learningUnits.slug }).from(schema.learningUnits);
  return rows.map((r) => ({ slug: r.slug }));
}

export default async function LearningUnitPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;

  const unit = await db().query.learningUnits.findFirst({
    where: eq(schema.learningUnits.slug, slug),
  });
  if (!unit) notFound();

  // Events connected to this unit's concept — the link that makes fundamentals current.
  const connected = unit.conceptId
    ? await db()
        .select({
          eventId: schema.events.id,
          title: schema.events.title,
          maturity: schema.events.caseMaturity,
          eventAt: schema.events.eventAt,
          firstReportedAt: schema.events.firstReportedAt,
          insightId: schema.insights.id,
        })
        .from(schema.learningConnections)
        .innerJoin(schema.events, eq(schema.events.id, schema.learningConnections.eventId))
        .leftJoin(schema.insights, eq(schema.insights.eventId, schema.events.id))
        .where(eq(schema.learningConnections.conceptId, unit.conceptId))
        .orderBy(desc(sql`coalesce(${schema.events.eventAt}, ${schema.events.firstReportedAt})`))
        .limit(8)
    : [];

  return (
    <div className="mx-auto max-w-[1000px]">
      <nav className="mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/learn" className="hover:underline underline-offset-2">
          Learn
        </Link>
        <span className="mx-1.5">/</span>
        <span>{unit.title}</span>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{unit.depth}</Badge>
          <Badge tone="muted">{unit.estimatedMinutes} min</Badge>
          <Badge tone="muted">v{unit.version}</Badge>
          {unit.lastReviewedAt ? (
            <Badge tone="muted">Reviewed {formatAbsolute(unit.lastReviewedAt)}</Badge>
          ) : null}
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{unit.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text)]">Objective: </span>
          {unit.objective}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-7">
          <section>
            <p className="prose-reading">{unit.explanation}</p>
          </section>

          {unit.structuredModel.length > 0 ? (
            <section>
              <SectionHeading>The model</SectionHeading>
              <div className="space-y-3">
                {unit.structuredModel.map((block, i) => (
                  <div key={i} className="surface-flat rounded-md p-3">
                    <h3 className="mb-1.5 text-[14px] font-semibold">{block.heading}</h3>
                    <ul className="space-y-1">
                      {block.points.map((point, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-[14px] leading-relaxed text-[var(--text-muted)]"
                        >
                          <span aria-hidden className="text-[var(--text-subtle)]">
                            ·
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {unit.keyTerms.length > 0 ? (
            <section>
              <SectionHeading>Key terms</SectionHeading>
              <dl className="space-y-2">
                {unit.keyTerms.map((term) => (
                  <div key={term.term}>
                    <dt className="text-[14px] font-semibold">{term.term}</dt>
                    <dd className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                      {term.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {unit.knowledgeCheck ? (
            <section>
              <SectionHeading hint="Answering advances your knowledge state for this concept.">
                Check your understanding
              </SectionHeading>
              <KnowledgeCheck unitId={unit.id} check={unit.knowledgeCheck} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {unit.commonMisconceptions.length > 0 ? (
            <KnownUnknowns items={unit.commonMisconceptions} />
          ) : null}

          {unit.practicalQuestions.length > 0 ? (
            <Card>
              <SectionHeading hint="Use these in a real conversation.">
                Questions to ask
              </SectionHeading>
              <ol className="space-y-2">
                {unit.practicalQuestions.map((question, i) => (
                  <li key={i} className="text-[13px] leading-relaxed">
                    <span className="mr-1 font-semibold text-[var(--text-subtle)]">{i + 1}.</span>
                    {question}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {connected.length > 0 ? (
            <Card>
              <SectionHeading hint="Recent events that touch this concept.">
                What changed since
              </SectionHeading>
              <ul className="space-y-2">
                {connected.map((event) => (
                  <li key={event.eventId} className="text-[13px]">
                    {event.insightId ? (
                      <Link
                        href={`/insights/${event.insightId}`}
                        className="leading-snug hover:underline underline-offset-2"
                      >
                        {event.title}
                      </Link>
                    ) : (
                      <span className="leading-snug">{event.title}</span>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <MaturityBadge maturity={event.maturity} />
                      <span className="text-[11px] text-[var(--text-subtle)]">
                        {formatAbsolute(event.eventAt ?? event.firstReportedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {unit.exampleCompanyNames.length > 0 ? (
            <Card>
              <SectionHeading>Example companies</SectionHeading>
              <div className="flex flex-wrap gap-1.5">
                {unit.exampleCompanyNames.map((name) => (
                  <Badge key={name} tone="muted">
                    {name}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
