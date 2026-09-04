import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { queryMarket } from '@/lib/account-queries';
import { listAllCompanies } from '@/lib/market-shared';
import { MarketSearchControls } from '@/components/market-search-controls';
import { EventRow } from '@/components/market-parts';
import { Badge } from '@mios/ui';

export const dynamic = 'force-dynamic';

/**
 * One market: what moved in it, who is in it, what regulators said.
 *
 * A path rather than `?industry=`. The query-string version could only ever work with a
 * server to re-render on each change — in the published static build the URL changed and
 * the page did not, so choosing a market did nothing at all. A route per market is
 * prerendered like every other page here and works on a plain file host.
 */
export async function generateStaticParams() {
  const { db, schema } = await import('@mios/database');
  const rows = await db().select({ slug: schema.industries.slug }).from(schema.industries);
  return rows.map((r) => ({ industry: r.slug }));
}

export default async function MarketPage({ params }: { params: Promise<{ industry: string }> }) {
  const user = await requireUser();
  const { industry } = await params;

  const [market, companies] = await Promise.all([
    queryMarket(user.workspaceId, industry),
    listAllCompanies(),
  ]);
  if (!market) notFound();

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
          NORTH recognises this sector for classification and search but has not built a market
          model for it — no value chain, KPI tree or business models. Writing one nobody has
          researched would be a fabrication, so it says so instead.
        </p>
      ) : null}

      <nav className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-subtle)]">
        <Link href="/account" className="hover:text-[var(--text)]">
          ← All markets
        </Link>
        <span>
          {market.events.length} events · {market.companies.length} companies
        </span>
        {market.industry.isModelled ? (
          <Link href={`/explore/industries/${industry}`} className="hover:text-[var(--text)]">
            Market model →
          </Link>
        ) : null}
      </nav>

      <div className="mt-5 border-y border-[var(--border)] py-4">
        <MarketSearchControls
          companies={companies}
          activeCompany={null}
          shortcuts={market.companies.filter((c) => c.events > 0).slice(0, 6)}
          shortcutsLabel="Most active here"
        />
      </div>

      <section className="mt-9">
        <h2 className="t-rule">
          Companies in {market.industry.name}
          <Badge tone="muted">{market.companies.length}</Badge>
        </h2>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
          Everything classified into this sector. A zero is a coverage statement, not a claim that
          the company is quiet — open one and it names what would change that.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {market.companies.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/account/company/${c.slug}`}
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
            Nothing in the last week — the most recent here is {market.newestAgeDays} days old.
          </p>
        ) : null}
        {market.events.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--text-subtle)]">
            No event is classified under this sector. No source in the registry covers it yet — a
            gap in our monitoring rather than quiet in the market.
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
            Published by regulators and public institutions. Keyed on the source rather than on
            subject tags: what a regulator publishes is regulatory by definition.
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
