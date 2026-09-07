import Link from 'next/link';
import { Badge, Card, EvidenceBadge, MaturityBadge } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity, EvidenceStrength } from '@mios/domain';
import type { AccountEvent, AccountRung } from '@/lib/account-queries';

/** One event, rendered the same way on a market page and a company page. */
export function EventRow({ event, index }: { event: AccountEvent; index: number }) {
  return (
    <Card as="li">
      <div className="flex gap-3">
        <span className="row-index pt-1">{String(index).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <MaturityBadge maturity={event.caseMaturity as CaseMaturity} />
            <EvidenceBadge strength={event.evidenceStrength as EvidenceStrength} />
            {event.firstPartyOnly ? <Badge tone="caution">Self-reported</Badge> : null}
          </div>
          {/*
            Every headline leads somewhere.

            Insight generation is selective — 139 of 297 events never get one — and the
            fallback was to render the title as plain text. Nearly half of every market
            and company page was therefore unclickable, which reads as a broken link
            rather than a deliberate absence. With no insight the reader is sent to the
            publisher's own article instead, which is what they wanted anyway.
          */}
          <h3 className="text-[13.5px] font-medium leading-snug">
            {event.insightId ? (
              <Link href={`/insights/${event.insightId}`} className="hover:underline">
                {event.title}
              </Link>
            ) : event.sourceUrl ? (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
                title={`Read at ${event.sourceName ?? 'the source'}`}
              >
                {event.title}
                <span aria-hidden className="ml-1 text-[10px] opacity-60">
                  ↗
                </span>
              </a>
            ) : (
              event.title
            )}
          </h3>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-subtle)]">
            {event.entityNames ? (
              <span className="text-[var(--text-muted)]">
                {event.entityNames.split(', ').slice(0, 2).join(', ')}
              </span>
            ) : null}
            <span>{formatAbsolute(event.eventAt ?? event.firstReportedAt)}</span>
            {!event.insightId && event.sourceUrl ? (
              <span className="text-[var(--text-muted)]">
                Read at {event.sourceName ?? 'source'}
              </span>
            ) : null}
            <span>
              {event.sourceCount} source{event.sourceCount === 1 ? '' : 's'}
              {event.independentSourceCount > 0
                ? ` · ${event.independentSourceCount} independent`
                : ''}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}

export function RungSection({ rung }: { rung: AccountRung }) {
  return (
    <section id={`rung-${rung.level}`} className="mt-9 scroll-mt-4">
      <h2 className="t-rule">
        <span className="row-index mr-1">{rung.index}</span>
        {rung.title}
        <Badge tone="muted">{rung.events.length}</Badge>
      </h2>
      <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
        {rung.why}
      </p>

      {/*
        How old the freshest item is. Rungs are never time-filtered — restricting them to
        "today" is how a market-intelligence tool shows nothing on a quiet Tuesday — so
        they reach back as far as they need to and then say how far that was. Stale is
        fine; stale presented as current is not.
      */}
      {rung.newestAgeDays != null && rung.newestAgeDays > 7 ? (
        <p className="mt-1.5 text-[11.5px] text-caution-700 dark:text-caution-100">
          Nothing in the last week — the most recent here is{' '}
          {rung.newestAgeDays < 31
            ? `${rung.newestAgeDays} days old`
            : `about ${Math.round(rung.newestAgeDays / 30)} months old`}
          .
        </p>
      ) : null}

      {rung.events.length === 0 ? (
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-subtle)]">
          {rung.emptyMeans}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {rung.events.map((e, i) => (
            <EventRow key={e.id} event={e} index={i + 1} />
          ))}
        </ul>
      )}
    </section>
  );
}
