'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IS_STATIC_BUILD } from '@/lib/static-build';
import type { CompanyOption } from '@/lib/market-shared';

/**
 * Jumping straight to a company, when you already know which one.
 *
 * Sized as a filter, not as a section. It used to be a bordered band with its own
 * padding sitting above the market list, which made picking a company look like the
 * primary action on a page whose whole argument is that you choose a market first. It is
 * a shortcut for people who already know the name, so it reads as one: one line, the
 * same weight as the other controls in the tool.
 *
 * The industry override that used to live here is gone. It existed because markets had
 * no pages of their own, so re-reading a company through another sector was the only way
 * to get there. Markets are routes now, which is both simpler and the order the page
 * argues for.
 */
export function MarketSearchControls({
  companies,
  activeCompany,
  shortcuts,
  shortcutsLabel = 'Your watchlist',
}: {
  companies: CompanyOption[];
  activeCompany: string | null;
  shortcuts: { slug: string; name: string }[];
  /** What these shortcuts are, since they change with the view. */
  shortcutsLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const matches = term
    ? companies.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8)
    : [];

  const go = (slug: string) => {
    setQuery('');
    router.push(`/account/company/${slug}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full max-w-[280px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) go(matches[0].slug);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Go straight to a company…"
          aria-label="Search a company"
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]"
        />

        {matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-lg">
            {matches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => go(c.slug)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--surface-inset)]"
                >
                  <span className="truncate">{c.name}</span>
                  {/* Zero is not hidden: a company we hold nothing on is a real answer,
                      and the page will say what would change it. */}
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--text-subtle)]">
                    {c.events || 'no coverage'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {term && matches.length === 0 ? (
        IS_STATIC_BUILD ? (
          <span className="text-[12px] text-[var(--text-subtle)]">
            Nothing tracked matches “{query}”.
          </span>
        ) : (
          <a
            href={`/coverage?q=${encodeURIComponent(query)}`}
            className="text-[12px] text-[var(--text-subtle)] underline underline-offset-2 hover:text-[var(--text)]"
          >
            Nothing matches “{query}” — check coverage →
          </a>
        )
      ) : null}

      {shortcuts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
          <span className="text-[var(--text-subtle)]">{shortcutsLabel}:</span>
          {shortcuts.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => go(c.slug)}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                c.slug === activeCompany
                  ? 'bg-[var(--surface-inset)] font-medium text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
