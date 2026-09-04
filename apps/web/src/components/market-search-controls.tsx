'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Choosing what Market search is about.
 *
 * This replaced two walls of chips: ten company buttons and seventeen industry buttons,
 * stacked above the content, with the two active industries scattered alphabetically
 * among the rest. Between them they pushed the actual market intelligence below the fold
 * and made "which of these is on?" a question you had to scan for.
 *
 * A search box answers "show me this company" directly, which is what the page is for.
 * The industry override is real but rare, so it sits behind a disclosure — and when one
 * is applied it says so in one line with a single way to undo it.
 */
export function MarketSearchControls({
  companies,
  industries,
  activeCompany,
  activeCompanyName,
  recordedIndustries,
  overrideIndustry,
  shortcuts,
  shortcutsLabel = 'Your watchlist',
}: {
  companies: { slug: string; name: string; events: number }[];
  industries: { slug: string; name: string }[];
  activeCompany: string | null;
  activeCompanyName: string | null;
  recordedIndustries: string | null;
  overrideIndustry: string | null;
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
    router.push(`/account?slug=${slug}`);
  };

  return (
    <div className="mt-6 border-y border-[var(--border)] py-5">
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) go(matches[0].slug);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder={activeCompanyName ? `Search another company…` : 'Search a company…'}
          aria-label="Search a company"
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
        />

        {matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-lg">
            {matches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => go(c.slug)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-inset)]"
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

        {term && matches.length === 0 ? (
          <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
            No tracked company matches “{query}”.{' '}
            <a
              href={`/coverage?q=${encodeURIComponent(query)}`}
              className="underline underline-offset-2 hover:text-[var(--text)]"
            >
              Check coverage for it →
            </a>
          </p>
        ) : null}
      </div>

      {shortcuts.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
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

      {/* The override: one line when off, one line when on, and never seventeen buttons.
          Hidden entirely with no company chosen — there is nothing yet to scope. */}
      <div className="mt-3.5 text-[12px] text-[var(--text-subtle)]" hidden={!activeCompany}>
        {overrideIndustry ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>
              Reading {activeCompanyName} through{' '}
              <strong className="font-medium text-[var(--text)]">
                {industries.find((i) => i.slug === overrideIndustry)?.name ?? overrideIndustry}
              </strong>{' '}
              instead of {recordedIndustries ?? 'its recorded industries'}.
            </span>
            <button
              type="button"
              onClick={() => router.push(`/account?slug=${activeCompany}`)}
              className="rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]"
            >
              ✕ Clear
            </button>
          </span>
        ) : (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1">
              <span>
                Industry: <span className="text-[var(--text-muted)]">{recordedIndustries ?? 'not recorded'}</span>
              </span>
              <span className="underline underline-offset-2 group-open:hidden">change</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {industries.map((i) => (
                <button
                  key={i.slug}
                  type="button"
                  onClick={() => router.push(`/account?slug=${activeCompany}&industry=${i.slug}`)}
                  className="rounded-md border border-[var(--border-strong)] px-2 py-0.5 text-[11.5px] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]"
                >
                  {i.name}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
