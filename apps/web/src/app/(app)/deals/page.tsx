import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { queryDeals, type Deal } from '@/lib/deals-queries';
import {
  Badge,
  Card,
  EmptyState,
  InterpretationBlock,
  MaturityBadge,
  EvidenceBadge,
} from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity, EvidenceStrength } from '@mios/domain';
import { ListKeyboardNav } from '@/components/list-keyboard-nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Key deals' };

/**
 * Key deals — publicly announced transactions.
 *
 * The event types that move ownership, capital or market position, separated from the
 * product and technology news that fills most of the corpus.
 *
 * The maturity model does more work here than anywhere else. An announced acquisition is
 * not a completed one, and the announcement is almost always written by the party that
 * wants it to proceed — so every deal shows its maturity and whether anyone other than
 * the participants has reported it. The header states the base rate plainly rather than
 * leaving the reader to infer it.
 */
export default async function DealsPage() {
  const user = await requireUser();
  const board = await queryDeals(user.workspaceId);

  return (
    <div className="mx-auto max-w-[900px]">
      <ListKeyboardNav />

      <p className="t-eyebrow">Key deals</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        Publicly announced transactions
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        Acquisitions, divestitures, investments, partnerships and market entries — what moves
        ownership, capital or position, as opposed to what launches a product. Figures appear only
        where a source stated one.
      </p>

      {board.total === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No deals in the monitored sources"
            body="No acquisition, investment or partnership has been ingested yet. The registry is weighted towards product and technology newsrooms; a filings source such as SEC EDGAR is what would change this."
          />
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-[var(--border)] py-5 sm:grid-cols-4">
            {(
              [
                ['deals tracked', board.total],
                ['announced only', board.counts.announcedOnly],
                ['independently reported', board.counts.corroborated],
                ['with a stated figure', board.counts.withFigures],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dd className="text-[25px] font-semibold leading-none tabular-nums tracking-tight">
                  {value}
                </dd>
                <dt className="t-section mt-1.5">{label}</dt>
              </div>
            ))}
          </dl>

          {board.newestAgeDays != null && board.newestAgeDays > 7 ? (
            <p className="mt-3 text-[11.5px] text-caution-700 dark:text-caution-100">
              Nothing in the last week — the most recent deal here is {board.newestAgeDays} days
              old. Deals are not filtered by date: an old deal that is still the newest one is
              itself the finding.
            </p>
          ) : null}

          <div className="mt-6">
            <InterpretationBlock label="Announced is not completed">
              <p>
                {board.counts.announcedOnly} of {board.total} of these are announcements with no
                reported completion, and {board.total - board.counts.corroborated} have been
                reported only by the parties to the deal. Transactions collapse, regulators block
                them and terms get renegotiated — and the press release is written by the side that
                wants it to proceed. Read the maturity badge before you read the headline.
              </p>
            </InterpretationBlock>
          </div>

          {board.groups.map((group) => (
            <section key={group.kind} className="mt-10">
              <h2 className="t-rule">
                {group.label}
                <Badge tone="muted">{group.deals.length}</Badge>
              </h2>
              <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
                {group.why}
              </p>
              <ul className="mt-3 grid gap-2.5">
                {group.deals.map((deal, i) => (
                  <DealRow key={deal.id} deal={deal} index={i + 1} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function DealRow({ deal, index }: { deal: Deal; index: number }) {
  const href = deal.insightId ? `/insights/${deal.insightId}` : null;

  return (
    <Card
      as="li"
      className="card-lift relative pl-9"
      data-row-index={index - 1}
      data-row-href={href ?? undefined}
    >
      <span className="row-index absolute left-1.5 top-4" aria-hidden>
        {String(index).padStart(2, '0')}
      </span>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <MaturityBadge maturity={deal.caseMaturity as CaseMaturity} />
        <EvidenceBadge strength={deal.evidenceStrength as EvidenceStrength} />
        {deal.firstPartyOnly ? (
          <Badge tone="caution" title="Reported only by parties to the deal.">
            Parties only
          </Badge>
        ) : null}
        {deal.hasFigure ? (
          <Badge
            tone="accent"
            title="A source states a monetary figure, with an evidence span behind it."
          >
            Figure stated
          </Badge>
        ) : null}
        {deal.verificationStatus === 'DISPUTED' ? (
          <Badge tone="alert">Sources disagree</Badge>
        ) : null}
      </div>

      <h3 className="text-[13.5px] font-medium leading-snug">
        {href ? (
          <Link href={href} className="hover:underline underline-offset-2">
            {deal.title}
          </Link>
        ) : (
          deal.title
        )}
      </h3>

      {deal.takeaway ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          {deal.takeaway}
        </p>
      ) : null}

      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-subtle)]">
        {deal.entityNames ? <span>{deal.entityNames}</span> : null}
        <span>{formatAbsolute(deal.eventAt ?? deal.firstReportedAt)}</span>
        <span>
          {deal.sourceCount} source{deal.sourceCount === 1 ? '' : 's'}
          {deal.independentSourceCount > 0 ? ` · ${deal.independentSourceCount} independent` : ''}
        </span>
      </p>
    </Card>
  );
}
