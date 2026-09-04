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
          <h3 className="text-[13.5px] font-medium leading-snug">
            {event.insightId ? (
              <Link href={`/insights/${event.insightId}`} className="hover:underline">
                {event.title}
              </Link>
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
