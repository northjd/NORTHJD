import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { queryAccount, queryCompanyProfile } from '@/lib/account-queries';
import { listAllCompanies, listWatchlistShortcuts } from '@/lib/market-shared';
import { MarketSearchControls } from '@/components/market-search-controls';
import { RungSection } from '@/components/market-parts';
import { CompanyProfileBlock } from '@/components/company-profile';
import { InterpretationBlock, MaturityBadge } from '@mios/ui';
import type { CaseMaturity } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * One company, read through its market.
 *
 * If there is nothing on the company, this shows who it is compared against; failing
 * that, their industry; failing that, the cross-industry forces; failing that, the
 * market. There is always something worth walking into a meeting with, and the page
 * always states which level it is speaking at, so market context is never mistaken for
 * news about your client.
 *
 * A path rather than `?slug=`. Query strings need a server to re-render on each change,
 * and the published build does not have one.
 */
export async function generateStaticParams() {
  const { db, schema } = await import('@mios/database');
  const rows = await db().select({ slug: schema.entities.slug }).from(schema.entities);
  return rows.map((r) => ({ slug: r.slug }));
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;

  const [board, profile, companies, watchlist] = await Promise.all([
    queryAccount(user.workspaceId, slug),
    queryCompanyProfile(slug),
    listAllCompanies(),
    listWatchlistShortcuts(user.workspaceId),
  ]);

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

  // Maturity spread across the company's own events — announcements against deployments.
  const own = board.rungs.find((r) => r.level === 'company')?.events ?? [];
  const evidenceMix = Object.entries(
    own.reduce<Record<string, number>>((acc, e) => {
      acc[e.caseMaturity] = (acc[e.caseMaturity] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="t-eyebrow">Market search</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        {board.entity.name}
      </h1>
      {profile ? (
        <CompanyProfileBlock profile={profile} />
      ) : (
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
          {board.entity.description ?? 'No description stored for this entity.'}
        </p>
      )}

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
          the same reason the corpus totals moved off Today. The markets it belongs to sit
          in the same line: this page reads a company through a sector, so getting back to
          that sector should not mean going via the index. */}
      <nav className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-subtle)]">
        <Link href="/account" className="hover:text-[var(--text)]">
          ← All markets
        </Link>
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

      {board.industrySlugs.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11.5px] text-[var(--text-subtle)]">
          <span>{board.industryIsInferred ? 'Inferred market:' : 'Market:'}</span>
          {board.allIndustries
            .filter((i) => board.industrySlugs.includes(i.slug))
            .map((i) => (
              <Link
                key={i.slug}
                href={`/account/market/${i.slug}`}
                className="text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text)]"
              >
                {i.name}
              </Link>
            ))}
        </p>
      ) : null}

      <div className="mt-5 border-y border-[var(--border)] py-4">
        <MarketSearchControls
          companies={companies}
          activeCompany={board.entity.slug}
          shortcuts={
            board.peers.length > 0
              ? board.peers.slice(0, 6).map((p) => ({ slug: p.slug, name: p.name }))
              : watchlist
          }
          shortcutsLabel={board.peers.length > 0 ? 'Also in this market' : 'Your watchlist'}
        />
      </div>

      {board.rungs.map((rung) => (
        <RungSection key={rung.level} rung={rung} />
      ))}

      {/*
        Source coverage and evidence mix.
        Carried over from the second company page under /explore, which has been removed.
        Both belong here: a thin timeline means limited monitoring rather than an inactive
        company, and that distinction is only legible if the page says which sources it
        has. Duplicating the page to hold them was the wrong way to keep them.
      */}
      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="t-rule">Source coverage</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-subtle)]">
            What we watch — and, by omission, what we do not. A thin timeline above means limited
            monitoring, not an inactive company.
          </p>
          {board.sources.length === 0 ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              No first-party source is registered for {board.entity.name}. Events involving it
              arrive only when another monitored source mentions it.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {board.sources.map((s) => (
                <li key={s.name} className="text-[13px]">
                  {s.name}{' '}
                  <span className="text-[11px] text-[var(--text-subtle)]">
                    {s.perspective.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {evidenceMix.length > 0 ? (
          <div>
            <h2 className="t-rule">Evidence mix</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-subtle)]">
              Announcements versus things actually evidenced as deployed, across everything naming
              this company.
            </p>
            <ul className="mt-2.5 space-y-1.5 text-[13px]">
              {evidenceMix.map(([maturity, count]) => (
                <li key={maturity} className="flex items-center justify-between gap-2">
                  <MaturityBadge maturity={maturity as CaseMaturity} />
                  <span className="tabular-nums font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="t-rule">Ask about this company</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            `What changed for ${board.entity.name} recently?`,
            `What is moving in ${board.industryNames ?? 'this market'} that ${board.entity.name} has not addressed?`,
            `Challenge the claim that ${board.entity.name} is ahead on AI`,
            `Prepare me for a meeting with ${board.entity.name}`,
          ].map((q) => (
            <Link
              key={q}
              href={`/ask?q=${encodeURIComponent(q)}`}
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
            It cannot tell you a company&rsquo;s internal position, its financials beyond what is
            published, or what they think. It reports what monitored public sources have said,
            widens its scope until it has something, and names the level it is speaking at so you
            never mistake market context for news about your client.
          </p>
        </InterpretationBlock>
      </div>
    </div>
  );
}
