'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assetPath } from '@/lib/asset-path';
import { IS_STATIC_BUILD } from '@/lib/static-build';
import { readPreferences } from '@/lib/local-preferences';
import type { CompanyOption } from '@/lib/market-shared';

/**
 * Jumping straight to a company, when you already know which one.
 *
 * Below the markets, not above them: putting it on top made picking a company look like
 * the primary action on a page whose whole argument is that you choose a market first.
 *
 * But below is not the same as hidden, and the first attempt at this overshot — a 280px
 * input under a small grey line, beneath even the list of sectors nobody monitors. Typing
 * a name is half of what the page is for, so it is sized like every other input in the
 * tool and sits directly under the market list.
 *
 * The industry override that used to live here is gone. It existed because markets had
 * no pages of their own, so re-reading a company through another sector was the only way
 * to get there. Markets are routes now, which is both simpler and the order the page
 * argues for.
 */
export function MarketSearchControls({
  companies = [],
  activeCompany,
  shortcuts,
  shortcutsLabel = 'Your watchlist',
}: {
  /**
   * Optional, and empty in the static export.
   *
   * Passing the list as a prop put all 119 companies into the RSC payload of every one of
   * the 102 market and company pages — Audemars Piguet and Kesko embedded in H&M's page,
   * for no reason but that the control might be typed into. That is the duplication which
   * took the command palette from 161 MB to 133 MB, in a second place.
   *
   * The export fetches `palette.json` instead: one 10 KB file, already built, already
   * carrying slug, name and event count. The server build keeps passing the prop, because
   * there is no static file for it to read.
   */
  companies?: CompanyOption[];
  activeCompany: string | null;
  shortcuts: { slug: string; name: string }[];
  /** What these shortcuts are, since they change with the view. */
  shortcutsLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const [fetched, setFetched] = useState<CompanyOption[] | null>(null);
  useEffect(() => {
    if (companies.length > 0) return;
    void fetch(assetPath('/palette.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.entities && setFetched(data.entities as CompanyOption[]))
      // The shortcuts and the market list still work; only free-text search needs this.
      .catch(() => setFetched([]));
  }, [companies.length]);

  // Memoised because the shortcut effect depends on it; a fresh array each render would
  // re-run that effect on every keystroke.
  const all = useMemo(
    () => (companies.length > 0 ? companies : (fetched ?? [])),
    [companies, fetched],
  );

  /*
   * The reader's own companies, when they have chosen some.
   *
   * `shortcuts` arrives from the server, where it is read from `watchlist_items` — one
   * seeded row shared by every visitor to the export. So this row offered Inditex,
   * Zalando, OpenAI and NVIDIA to someone who had picked Migros and Coop, under the
   * heading "Your watchlist". Preferences live in the browser; this reads them there.
   */
  const [mine, setMine] = useState<{ slug: string; name: string }[] | null>(null);
  useEffect(() => {
    if (!IS_STATIC_BUILD) return;
    const chosen = readPreferences().companies;
    if (chosen.length === 0) return;
    const bySlug = new Map(all.map((c) => [c.slug, c.name]));
    setMine(
      chosen
        .filter((slug) => bySlug.has(slug))
        .slice(0, 6)
        .map((slug) => ({ slug, name: bySlug.get(slug)! })),
    );
  }, [all]);

  const shownShortcuts = mine ?? shortcuts;
  const shownLabel = mine ? 'Your companies' : shortcutsLabel;

  const term = query.trim().toLowerCase();
  const matches = term ? all.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8) : [];

  const go = (slug: string) => {
    setQuery('');
    router.push(`/account/company/${slug}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      {/* Sized like every other input in the tool. Shrunk to a 280px one-liner it read as
          a minor filter and was easy to miss entirely, which is the opposite of the job:
          typing a name is half of what this page is for. */}
      <div className="relative w-full max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) go(matches[0].slug);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search a company…"
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-inset)]"
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

      {shownShortcuts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
          <span className="text-[var(--text-subtle)]">{shownLabel}:</span>
          {shownShortcuts.map((c) => (
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
