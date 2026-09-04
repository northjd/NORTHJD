import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { queryMarketIndex } from '@/lib/account-queries';
import { listAllCompanies, listWatchlistShortcuts } from '@/lib/market-shared';
import { MarketSearchControls } from '@/components/market-search-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Market search' };

/**
 * Market search — the market list is the page.
 *
 * Deliberately not called Accounts: naming it that would assert a client relationship
 * the data does not record, and would turn a company list into a client list for anyone
 * reading over a shoulder.
 *
 * Markets come first and the company box sits under them, because the order on screen is
 * the argument: a conversation needs the market before it needs four press releases.
 * Having the search box on top said the opposite of every word next to it.
 *
 * Nothing is selected until you select it. This used to fall back to the watchlist, so
 * the page always opened on some company and its industries — which reads as an assertion
 * that this is the one you care about. An empty search page is not a failure state, it is
 * the question.
 */
export default async function MarketSearchPage() {
  const user = await requireUser();
  const [companies, shortcuts, markets] = await Promise.all([
    listAllCompanies(),
    listWatchlistShortcuts(user.workspaceId),
    queryMarketIndex(),
  ]);

  const covered = markets.filter((m) => m.events > 0);
  const uncovered = markets.filter((m) => m.events === 0);

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="t-eyebrow">Market search</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        Get market and company insights
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        Start with a market: what moved in the sector, who is in it, and what regulators have said.
        Then narrow to a company — in that order, because a conversation needs the market before it
        needs four press releases.
      </p>

      <section className="mt-8">
        <h2 className="t-rule">Markets with coverage</h2>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
          Everything published since monitoring began, not just today — nothing here is filtered to
          a date, so a quiet week never empties the page.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {covered.map((m) => (
            <li key={m.slug}>
              <Link
                href={`/account/market/${m.slug}`}
                className="flex items-baseline gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-[var(--surface-inset)]"
              >
                <span className="text-[13.5px] font-medium">{m.name}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--text-subtle)]">
                  {m.events} events · {m.companies} companies
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/*
        Second, not last.

        Markets lead because that is the order the page argues for, but the previous
        version pushed this to the bottom under a small grey line — below even the list of
        sectors nobody is watching. Someone who already knows the company name should not
        have to scroll past everything they did not ask for to type it.
      */}
      <section className="mt-9">
        <h2 className="t-rule">Or go straight to a company</h2>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
          Every tracked company, including the ones nothing has been published about — those say
          what would change it rather than returning an empty page.
        </p>
        <div className="mt-3">
          <MarketSearchControls companies={companies} activeCompany={null} shortcuts={shortcuts} />
        </div>
      </section>

      {uncovered.length > 0 ? (
        <section className="mt-9">
          <h2 className="t-rule">Recognised, not yet monitored</h2>
          {/* Separated rather than mixed in. A row reading "0 events" next to one reading
              "86 events" looks like a slow sector; it is actually a sector no registered
              source publishes about, which is a statement about us, not about the market. */}
          <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
            NORTH classifies and searches these sectors, but no source in the registry publishes
            about them, so there is nothing to show. That is a gap in our monitoring, not quiet in
            the market — registering one feed for a sector is what changes it.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {uncovered.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/account/market/${m.slug}`}
                  className="inline-flex items-baseline gap-1.5 rounded-md border border-[var(--border-strong)] px-2 py-1 text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--text)]"
                >
                  {m.name}
                  <span className="text-[10.5px] tabular-nums text-[var(--text-subtle)]">
                    {m.companies || 'no'} {m.companies === 1 ? 'company' : 'companies'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
