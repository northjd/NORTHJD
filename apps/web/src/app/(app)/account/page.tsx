import Link from 'next/link';
import { requireUser, IS_STATIC_EXPORT } from '@/lib/session';
import { queryCorpusReach, queryMarketIndex } from '@/lib/account-queries';
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
  const [companies, shortcuts, markets, reach] = await Promise.all([
    listAllCompanies(),
    listWatchlistShortcuts(user.workspaceId),
    queryMarketIndex(),
    queryCorpusReach(),
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

      {/*
        Chips, not a table.

        This was eighteen full-width rows in two columns, each carrying a name and an
        event and company count — a screen and a half of chrome before the reader had
        chosen anything. Markets are the *filter* on this page, not its content: the
        content is whatever you pick. Counts stay, because "how much is in here" is what
        decides which one you click, but they ride along inside the chip instead of
        claiming a column of their own.
      */}
      <section className="mt-7">
        <h2 className="t-rule">Pick a market</h2>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {covered.map((m) => (
            <li key={m.slug}>
              <Link
                href={`/account/market/${m.slug}`}
                className="inline-flex items-baseline gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-inset)]"
              >
                {m.name}
                <span className="text-[10.5px] tabular-nums text-[var(--text-subtle)]">
                  {m.events}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/*
          A date, not an adjective.

          This claimed to count "events published since monitoring began" while the
          database was being rebuilt from empty every three hours — so the archive it
          described did not exist, and a market's count could fall simply because a
          publisher rotated its feed. The corpus is now carried between builds, which
          makes the original sentence true and this one checkable: the date comes from
          the oldest thing actually held, so it cannot drift from what it describes.
        */}
        <p className="mt-2.5 text-[11.5px] text-[var(--text-subtle)]">
          {reach.oldest ? (
            <>
              Every event kept since {reach.oldest} — {reach.documents.toLocaleString('en-GB')}{' '}
              documents, carried forward between builds and refreshed every three hours. Nothing
              here is filtered by date. A market with few events has few sources covering it, not a
              quiet quarter.
            </>
          ) : (
            <>
              Counts are what the monitored feeds are carrying now, refreshed every three hours.
              Nothing here is filtered by date.
            </>
          )}
        </p>
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
          <MarketSearchControls
            companies={IS_STATIC_EXPORT ? [] : companies}
            activeCompany={null}
            shortcuts={shortcuts}
          />
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
