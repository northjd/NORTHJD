import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { lookupCoverage } from '@/lib/entity-search';
import { Badge, Card, EmptyState, InterpretationBlock, MaturityBadge } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * Coverage check — what we know about a term, and what we do not.
 *
 * Reached when a search or a company filter matches nothing. An empty result list is
 * technically correct and useless; this says which of three different silences you are
 * looking at — the company is untracked, the company is tracked under another name, or
 * the company is tracked but nothing has been published — and names the action that
 * would fix each.
 *
 * It deliberately refuses the alternative. Answering "what's happening at X" from
 * general knowledge would produce a paragraph indistinguishable, on screen, from a
 * sourced one, and that is the failure this product exists to prevent.
 */
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q = '' } = await searchParams;
  const term = q.trim();

  if (!term) {
    return (
      <div className="mx-auto max-w-[820px]">
        <p className="t-eyebrow">Coverage check</p>
        <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
          Is this in the monitored sources?
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
          Type a company, product or term. This reports what exists, what does not, and
          what would have to change — rather than returning an empty list and leaving you
          to guess which kind of nothing it is.
        </p>
        <form action="/coverage" className="mt-6 flex gap-2">
          <input
            name="q"
            placeholder="Philip Morris, IQOS, markdown rate…"
            className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <button className="rounded-md border border-[var(--accent-line)] px-4 py-2 text-[13px] font-medium">
            Check
          </button>
        </form>
      </div>
    );
  }

  const result = await lookupCoverage(term);

  return (
    <div className="mx-auto max-w-[820px]">
      <p className="t-eyebrow">Coverage check</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        “{term}”
      </h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        {result.empty
          ? 'Nothing in the monitored sources refers to this. That is a statement about our coverage, not about the world — the term may be significant and simply unmonitored.'
          : 'Found in the corpus. Below is exactly where.'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-[var(--border)] py-5 sm:grid-cols-3">
        {(
          [
            ['Matching entities', result.entities.length],
            ['Events mentioning it', result.events.length],
            ['Claims mentioning it', result.claimMentions],
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

      {result.entities.length > 0 ? (
        <section className="mt-8">
          <h2 className="t-rule">Tracked entities</h2>
          <ul className="mt-3 grid gap-3">
            {result.entities.map((e) => (
              <Card as="li" key={e.slug}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-medium">{e.name}</h3>
                  {e.legalName && e.legalName !== e.name ? (
                    <span className="text-[12px] text-[var(--text-subtle)]">{e.legalName}</span>
                  ) : null}
                  <Badge tone={e.events > 0 ? 'accent' : 'caution'}>
                    {e.events > 0 ? `${e.events} events` : 'no coverage'}
                  </Badge>
                </div>
                {e.matchedAlias ? (
                  <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">
                    matched on the alias “{e.matchedAlias}”
                  </p>
                ) : null}
                {e.aliases ? (
                  <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                    also known as: {e.aliases}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/explore?entity=${e.slug}`}
                    className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] hover:border-[var(--accent-line)]"
                  >
                    Filter to this company
                  </Link>
                  <Link
                    href={`/account/company/${e.slug}`}
                    className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] hover:border-[var(--accent-line)]"
                  >
                    Open as account
                  </Link>
                </div>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      {result.events.length > 0 ? (
        <section className="mt-8">
          <h2 className="t-rule">Events mentioning “{term}”</h2>
          <ul className="mt-3 grid gap-3">
            {result.events.map((e) => (
              <Card as="li" key={e.id}>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <MaturityBadge maturity={e.caseMaturity as CaseMaturity} />
                </div>
                <h3 className="text-[13.5px] font-medium leading-snug">
                  {e.insightId ? (
                    <Link href={`/insights/${e.insightId}`} className="hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    e.title
                  )}
                </h3>
                <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
                  {formatAbsolute(e.eventAt ?? e.firstReportedAt)} · {e.sourceCount} source
                  {e.sourceCount === 1 ? '' : 's'}
                </p>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      {result.empty ? (
        <>
          <section className="mt-8">
            <h2 className="t-rule">What would change this</h2>
            <ol className="mt-3 grid gap-3 pl-5 text-[13px] leading-[1.65] text-[var(--text-muted)]">
              <li>
                <strong className="font-semibold text-[var(--text)]">
                  Register the company and its newsroom.
                </strong>{' '}
                One entity row, one feed URL, one rights decision. Coverage starts at the
                next pipeline run.
              </li>
              <li>
                <strong className="font-semibold text-[var(--text)]">Add an alias</strong> if
                the company is tracked under a different name — “{term}” may be a short form
                the system has not been told about. Aliases already resolve “Zara” to
                Inditex and “AWS” to Amazon.
              </li>
              <li>
                <strong className="font-semibold text-[var(--text)]">
                  Ingest a specific URL.
                </strong>{' '}
                A single article or filing, extracted and evidenced like any other source.
                Useful when the question is urgent and the connector is not built yet.
              </li>
            </ol>
          </section>

          <div className="mt-6">
            <InterpretationBlock label="What this will not do">
              <p>
                It will not answer from general knowledge. A plausible paragraph about “
                {term}” assembled from memory would be indistinguishable, on screen, from a
                sourced one — and that is precisely the failure this product exists to
                avoid. An honest gap is more useful than a fluent guess.
              </p>
            </InterpretationBlock>
          </div>
        </>
      ) : null}

      {!result.empty && result.entities.length === 0 && result.events.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Mentioned in claims, but not in any event"
            body={`${result.claimMentions} claims mention this, but none has been clustered into an event yet.`}
          />
        </div>
      ) : null}

      <form action="/coverage" className="mt-10 flex gap-2 border-t border-[var(--border)] pt-6">
        <input
          name="q"
          defaultValue={term}
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
        />
        <button className="rounded-md border border-[var(--accent-line)] px-4 py-2 text-[13px] font-medium">
          Check another
        </button>
      </form>
    </div>
  );
}
