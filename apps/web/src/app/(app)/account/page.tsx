import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import {
  queryAccount,
  queryMarket,
  queryMarketIndex,
  type AccountEvent,
  type AccountRung,
} from '@/lib/account-queries';
import { searchEntities } from '@/lib/entity-search';
import { MarketSearchControls } from '@/components/market-search-controls';
import { Badge, Card, InterpretationBlock, MaturityBadge } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity, EvidenceStrength } from '@mios/domain';
import { EvidenceBadge } from '@mios/ui';

export const dynamic = 'force-dynamic';

/**
 * Market search — look up a company, read it through its market.
 *
 * Deliberately not called Accounts: naming it that would assert a client relationship
 * the data does not record, and would turn a company list into a client list for anyone
 * reading over a shoulder.
 *
 * If there is nothing on the company, this shows who it is compared against; failing
 * that, their industry; failing that, the cross-industry forces; failing that, the
 * market. There is always something worth walking into a meeting with, and the page
 * always states which level it is speaking at, so market context is never mistaken for
 * news about your client.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; industry?: string }>;
}) {
  const user = await requireUser();
  const { slug: requested, industry } = await searchParams;

  /*
   * Nothing is selected until you select it.
   *
   * This used to fall back to the watchlist, so the page always opened on some company
   * and its industries — which reads as an assertion that this is the one you care about,
   * and made the first thing you saw a market you had not asked for.
   *
   * "Never show nothing" earns its keep once a company is chosen: from there the rungs
   * widen until they have something. Before that, an empty search page is not a failure
   * state, it is the question.
   */
  const slug = requested ?? null;
  // Every entity, including those with no coverage: a company you cannot search for is
  // a question you cannot ask, and the page has an honest answer for an empty one.
  const allCompanies = (await searchEntities('', 200)).map((e) => ({
    slug: e.slug,
    name: e.name,
    events: e.events,
  }));

  const watchlistShortcuts = (
    await db()
      .select({ slug: schema.entities.slug, name: schema.entities.name })
      .from(schema.watchlistItems)
      .innerJoin(schema.watchlists, eq(schema.watchlists.id, schema.watchlistItems.watchlistId))
      .innerJoin(schema.entities, eq(schema.entities.id, schema.watchlistItems.entityId))
      .where(eq(schema.watchlists.workspaceId, user.workspaceId))
  ).slice(0, 6);

  /*
   * Market first, then a company inside it.
   *
   * Three states, in the order someone actually works: choose a sector, see what moved
   * in it and who is in it, then narrow to one company. Opening on a company assumes you
   * already know which one matters, which is the opposite of what the page is for.
   */
  if (!slug) {
    // ── No company, but a market chosen: the market view.
    if (industry) {
      const market = await queryMarket(user.workspaceId, industry);
      if (market) {
        return (
          <div className="mx-auto max-w-[900px]">
            <p className="t-eyebrow">Market and company insights</p>
            <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
              {market.industry.name}
            </h1>
            {market.industry.definition ? (
              <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
                {market.industry.definition}
              </p>
            ) : null}
            {!market.industry.isModelled ? (
              <p className="mt-2 max-w-[64ch] text-[12px] leading-relaxed text-[var(--text-subtle)]">
                NORTH recognises this sector for classification and search but has not built
                a market model for it — no value chain, KPI tree or business models. Writing
                one nobody has researched would be a fabrication, so it says so instead.
              </p>
            ) : null}

            <nav className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-subtle)]">
              <Link href="/account" className="hover:text-[var(--text)]">
                ← All markets
              </Link>
              <span>
                {market.events.length} events · {market.companies.length} companies
              </span>
            </nav>

            <MarketSearchControls
              companies={allCompanies}
              industries={[]}
              activeCompany={null}
              activeCompanyName={null}
              recordedIndustries={null}
              overrideIndustry={null}
              shortcuts={market.companies.filter((c) => c.events > 0).slice(0, 6)}
              shortcutsLabel="Most active here"
            />

            <section className="mt-9">
              <h2 className="t-rule">
                Companies in {market.industry.name}
                <Badge tone="muted">{market.companies.length}</Badge>
              </h2>
              <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
                Everything classified into this sector. A zero is a coverage statement, not
                a claim that the company is quiet — open one and it names what would change
                that.
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {market.companies.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/account?slug=${c.slug}`}
                      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums opacity-60">
                        {c.events || '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-9">
              <h2 className="t-rule">
                What moved in {market.industry.name}
                <Badge tone="muted">{market.events.length}</Badge>
              </h2>
              {market.newestAgeDays != null && market.newestAgeDays > 7 ? (
                <p className="mt-1.5 text-[11.5px] text-caution-700 dark:text-caution-100">
                  Nothing in the last week — the most recent here is {market.newestAgeDays}{' '}
                  days old.
                </p>
              ) : null}
              {market.events.length === 0 ? (
                <p className="mt-3 text-[13px] text-[var(--text-subtle)]">
                  No event is classified under this sector. No source in the registry covers
                  it yet — a gap in our monitoring rather than quiet in the market.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2.5">
                  {market.events.map((e, i) => (
                    <EventRow key={e.id} event={e} index={i + 1} />
                  ))}
                </ul>
              )}
            </section>

            {market.regulatory.length > 0 ? (
              <section className="mt-9">
                <h2 className="t-rule">
                  Regulatory and policy
                  <Badge tone="muted">{market.regulatory.length}</Badge>
                </h2>
                <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
                  Published by regulators and public institutions. Keyed on the source
                  rather than on subject tags: what a regulator publishes is regulatory by
                  definition.
                </p>
                <ul className="mt-3 grid gap-2.5">
                  {market.regulatory.map((e, i) => (
                    <EventRow key={e.id} event={e} index={i + 1} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        );
      }
    }

    // ── Nothing chosen: pick a market, or jump straight to a company.
    const markets = await queryMarketIndex();
    return (
      <div className="mx-auto max-w-[900px]">
        <p className="t-eyebrow">Market search</p>
        <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
          Get market and company insights
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
          Start with a market: what moved in the sector, who is in it, and what regulators
          have said. Then narrow to a company — in that order, because a conversation needs
          the market before it needs four press releases.
        </p>

        <MarketSearchControls
          companies={allCompanies}
          industries={[]}
          activeCompany={null}
          activeCompanyName={null}
          recordedIndustries={null}
          overrideIndustry={null}
          shortcuts={watchlistShortcuts}
        />

        <section className="mt-9">
          <h2 className="t-rule">Markets</h2>
          <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
            Counts are events published in each sector. A sector with none is one no source
            in the registry covers yet.
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {markets.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/account?industry=${m.slug}`}
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
      </div>
    );
  }

  const board = await queryAccount(user.workspaceId, slug, industry ?? null);
  if (!board) {
    return (
      <div className="mx-auto max-w-[820px]">
        <h1 className="text-[22px] font-semibold">No such company</h1>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          <Link href={`/coverage?q=${encodeURIComponent(slug)}`} className="underline">
            Check whether anything mentions “{slug}”
          </Link>
        </p>
      </div>
    );
  }

  const leadRung = board.rungs.find((r) => r.level === board.leadWith)!;

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="t-eyebrow">Market search</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        {board.entity.name}
      </h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        {board.entity.description ?? 'No description stored for this entity.'}
      </p>

      {board.entity.aliases ? (
        <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">
          Also known as: {board.entity.aliases}
        </p>
      ) : null}

      {board.skipped.length > 0 ? (
        <div className="mt-6 border-l border-caution-500/50 pl-4">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.17em] text-caution-700 dark:text-caution-100">
            Nothing at the level you asked for
          </p>
          <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
            {board.skipped.map((r) => r.emptyMeans).join(' ')} So this leads with{' '}
            <strong className="font-semibold text-[var(--text)]">
              {leadRung.title.toLowerCase()}
            </strong>{' '}
            instead. Every level below is still shown, and each says what it is.
          </p>
        </div>
      ) : null}

      {/* Counts as one quiet line of jump links rather than five large numerals. They
          describe how much there is, which matters far less than the material itself —
          the same reason the corpus totals moved off Today. */}
      <nav className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-subtle)]">
        {board.rungs.map((r) => (
          <a
            key={r.level}
            href={`#rung-${r.level}`}
            className={`hover:text-[var(--text)] ${
              r.level === board.leadWith ? 'text-[var(--text-muted)]' : ''
            }`}
          >
            {r.title.replace(/^On /, '')}{' '}
            <span className="tabular-nums opacity-70">{r.events.length}</span>
          </a>
        ))}
      </nav>

      <MarketSearchControls
        companies={allCompanies}
        industries={board.allIndustries}
        activeCompany={board.entity.slug}
        activeCompanyName={board.entity.name}
        recordedIndustries={board.recordedIndustryNames ?? board.industryNames}
        overrideIndustry={industry ?? null}
        shortcuts={
          board.peers.length > 0
            ? board.peers.slice(0, 6).map((p) => ({ slug: p.slug, name: p.name }))
            : watchlistShortcuts
        }
        shortcutsLabel={board.peers.length > 0 ? 'Also in this market' : 'Your watchlist'}
      />

      {board.rungs.map((rung) => (
        <RungSection key={rung.level} rung={rung} />
      ))}

      <section className="mt-10">
        <h2 className="t-rule">Ask about this account</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            `What changed for ${board.entity.name} recently?`,
            `What is moving in ${board.industryNames ?? 'this market'} that ${board.entity.name} has not addressed?`,
            `Challenge the claim that ${board.entity.name} is ahead on AI`,
            `Prepare me for a meeting with ${board.entity.name}`,
          ].map((q) => (
            <Link
              key={q}
              href={`/companion?q=${encodeURIComponent(q)}`}
              className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]"
            >
              {q}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <InterpretationBlock label="What this view cannot do">
          <p>
            It cannot tell you a company&rsquo;s internal position, its financials beyond
            what is published, or what they think. It reports what monitored public sources
            have said, widens its scope until it has something, and names the level it is
            speaking at so you never mistake market context for news about your client.
          </p>
        </InterpretationBlock>
      </div>
    </div>
  );
}


function RungSection({ rung }: { rung: AccountRung }) {
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

function EventRow({ event, index }: { event: AccountEvent; index: number }) {
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
