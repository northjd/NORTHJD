import type { CompanyProfile, ProfileFact } from '@/lib/account-queries';

/**
 * The company profile block.
 *
 * Two columns of facts and a deliberate refusal. What we hold — description, legal name,
 * headquarters, sectors, business model, listing, brands — comes from the entity registry
 * and is shown plainly. What we do not hold — revenue, growth, margin, headcount, market
 * capitalisation, market share — is shown as *absent*, with the reason it is absent and
 * what would supply it.
 *
 * Naming the gap costs a line and buys the reader something they cannot otherwise have:
 * the knowledge that nobody looked it up and got it wrong. A market-intelligence page
 * that quietly omits revenue looks like a page whose author forgot; one that says "no
 * monitored source publishes company financials" is telling you the shape of the tool.
 */
export function CompanyProfileBlock({ profile }: { profile: CompanyProfile }) {
  /*
   * Split on whether there is a value, not on which group the fact belongs to.
   *
   * This previously read `[...identity.filter(v => v === null), ...financial]` — every
   * financial fact went into the "not available" list whichever it was, because when it
   * was written none of them had values. Once EDGAR started supplying revenue, growth and
   * margin, the page kept insisting they were unavailable while holding them.
   */
  const identityKnown = profile.identity.filter((f) => f.value !== null);
  const financialKnown = profile.financial.filter((f) => f.value !== null);
  const missing = [...profile.identity, ...profile.financial].filter((f) => f.value === null);
  const missingReasons = [...new Set(missing.map((f) => f.missingBecause).filter(Boolean))];

  return (
    <section className="mt-6 border-y border-[var(--border)] py-5">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {identityKnown.map((f) => (
          <Fact key={f.label} fact={f} />
        ))}
      </dl>

      {financialKnown.length > 0 ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="t-section">Reported financials</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
            From the company&rsquo;s own annual filing to the SEC — a 10-K for a US registrant, a
            20-F for a European one. Each figure carries its reporting period, the currency it was
            filed in, and a link to the filing it came from. Nothing here is estimated and nothing
            is converted: an exchange rate would need a date the filing does not give.
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {financialKnown.map((f) => (
              <Fact key={f.label} fact={f} />
            ))}
          </dl>
        </div>
      ) : null}

      {profile.brands.length > 0 ? (
        <div className="mt-5">
          <p className="t-section">Brands and trade names</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
            {profile.brands.join(' · ')}
          </p>
        </div>
      ) : null}

      {missing.length > 0 ? (
        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-[11.5px] text-[var(--text-subtle)] hover:text-[var(--text-muted)]">
            <span className="underline underline-offset-2">
              {missing.length} figure{missing.length === 1 ? '' : 's'} not available from monitored
              sources
            </span>
            <span aria-hidden className="ml-1.5 transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <div className="mt-3">
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {missing.map((f) => (
                <li key={f.label} className="text-[12px] text-[var(--text-subtle)]">
                  {f.label}
                </li>
              ))}
            </ul>
            {missingReasons.map((reason) => (
              <p
                key={reason}
                className="mt-2.5 max-w-[70ch] border-l border-[var(--border-strong)] pl-3 text-[11.5px] leading-relaxed text-[var(--text-subtle)]"
              >
                {reason}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Fact({ fact }: { fact: ProfileFact }) {
  return (
    <div>
      <dt className="t-section">{fact.label}</dt>
      <dd className="mt-1 text-[13.5px] leading-relaxed">
        {fact.value}
        {fact.source ? (
          <a
            href={fact.source}
            className="ml-1.5 text-[11px] text-[var(--text-subtle)] underline underline-offset-2"
            rel="noreferrer"
          >
            filing
          </a>
        ) : null}
      </dd>
    </div>
  );
}
