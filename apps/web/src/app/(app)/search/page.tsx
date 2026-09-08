import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, EmptyState, EvidenceBadge, MaturityBadge, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import { matchesQuery, rankQuery, toTsQuery } from '@mios/search';

export const dynamic = 'force-dynamic';

/**
 * Search returns events, companies and learning units — not a list of articles.
 * Several documents about one announcement are one result.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; perspective?: string }>;
}) {
  const user = await requireUser();
  const { q = '' } = await searchParams;
  // OR the terms: `websearch_to_tsquery` ANDs on whitespace, which makes any
  // multi-word search return nothing. ts_rank still puts the best matches first.
  const query = toTsQuery(q, 12).split(/\s+/).filter(Boolean).join(' or ');

  const events = query
    ? await db()
        .select({
          eventId: schema.events.id,
          title: schema.events.title,
          summary: schema.events.summary,
          eventAt: schema.events.eventAt,
          firstReportedAt: schema.events.firstReportedAt,
          maturity: schema.events.caseMaturity,
          evidenceStrength: schema.events.evidenceStrength,
          sourceCount: schema.events.sourceCount,
          insightId: schema.insights.id,
          rank: sql<number>`${rankQuery(schema.events.searchVector, query)}`.as('rank'),
        })
        .from(schema.events)
        .leftJoin(
          schema.insights,
          and(
            eq(schema.insights.eventId, schema.events.id),
            eq(schema.insights.workspaceId, user.workspaceId),
          ),
        )
        .where(
          and(
            matchesQuery(schema.events.searchVector, query),
            eq(schema.events.isSuppressed, false),
          ),
        )
        .orderBy(desc(sql`rank`))
        .limit(25)
    : [];

  const entities = query
    ? await db()
        .select({
          slug: schema.entities.slug,
          name: schema.entities.name,
          kind: schema.entities.kind,
        })
        .from(schema.entities)
        .where(sql`${schema.entities.searchVector} @@ websearch_to_tsquery('simple', ${query})`)
        .limit(8)
    : [];

  const units = query
    ? await db()
        .select({
          slug: schema.learningUnits.slug,
          title: schema.learningUnits.title,
          depth: schema.learningUnits.depth,
        })
        .from(schema.learningUnits)
        .where(matchesQuery(schema.learningUnits.searchVector, query))
        .limit(8)
    : [];

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="mb-4 text-[24px] font-semibold tracking-tight">Search</h1>

      <form method="get" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search events, companies and learning units"
          aria-label="Search"
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        />
        <button
          type="submit"
          className="rounded bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--surface)]"
        >
          Search
        </button>
      </form>

      {query && events.length === 0 && entities.length === 0 && units.length === 0 ? (
        <EmptyState
          title="No matches in the monitored sources."
          body="That is a statement about what has been ingested, not about what exists. Check the coverage dashboard, or ingest a specific URL."
        />
      ) : null}

      {entities.length > 0 ? (
        <section className="mb-6">
          <SectionHeading>Companies and institutions</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {entities.map((entity) => (
              <Link key={entity.slug} href={`/account/company/${entity.slug}`}>
                <Badge tone="accent">{entity.name}</Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="mb-6">
          <SectionHeading hint="Events, not articles — several reports of one announcement are one result.">
            Events
          </SectionHeading>
          <ul className="space-y-2">
            {events.map((event) => (
              <Card as="li" key={event.eventId}>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <MaturityBadge maturity={event.maturity} />
                  <EvidenceBadge strength={event.evidenceStrength} />
                  <span className="text-[11px] text-[var(--text-subtle)]">
                    {event.sourceCount} source{event.sourceCount === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold leading-snug">
                  {event.insightId ? (
                    <Link
                      href={`/insights/${event.insightId}`}
                      className="hover:underline underline-offset-2"
                    >
                      {event.title}
                    </Link>
                  ) : (
                    event.title
                  )}
                </h3>
                <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-muted)]">
                  {event.summary}
                </p>
                <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
                  {formatAbsolute(event.eventAt ?? event.firstReportedAt)}
                </p>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      {units.length > 0 ? (
        <section>
          <SectionHeading>Learning units</SectionHeading>
          <ul className="space-y-1.5">
            {units.map((unit) => (
              <li key={unit.slug} className="text-[14px]">
                <Link
                  href={`/learn/${unit.slug}`}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {unit.title}
                </Link>
                <Badge tone="muted" className="ml-2">
                  {unit.depth}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
