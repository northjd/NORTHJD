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
  const known = profile.identity.filter((f) => f.value !== null);
  const missing = [...profile.identity.filter((f) => f.value === null), ...profile.financial];
  const missingReasons = [...new Set(missing.map((f) => f.missingBecause).filter(Boolean))];

  return (
    <section className="mt-6 border-y border-[var(--border)] py-5">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {known.map((f) => (
          <Fact key={f.label} fact={f} />
        ))}
      </dl>

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
            source
          </a>
        ) : null}
      </dd>
    </div>
  );
}
