'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readPreferences, savedViewsFor, hasCompletedSetup } from '@/lib/local-preferences';

/**
 * Saved views built from the reader's own answers.
 *
 * The server version reads `user_profiles.industry_slugs` and the `watchlist_items`
 * table. The static export has neither — every visitor shares one seeded workspace row —
 * so "My industries" and "My watchlist" showed the seed data (Inditex, Zalando, OpenAI,
 * NVIDIA, Microsoft, H&M) to everybody, whatever they had chosen during set-up. Reported
 * as "these look different to my pre-selection", which was exactly right.
 *
 * `savedViewsFor` was written for this and had no callers.
 *
 * Renders the server's list until the browser's own preferences are read, so the sidebar
 * does not flicker into place or shift the nav under the cursor on first paint.
 */
export function SavedViews({
  fallback,
}: {
  fallback: {
    id: string;
    icon: string;
    name: string;
    detail: string;
    params: Record<string, string>;
  }[];
}) {
  const [mine, setMine] = useState<{ label: string; href: string }[] | null>(null);

  useEffect(() => {
    if (!hasCompletedSetup()) return;
    const prefs = readPreferences();
    const chose =
      prefs.industries.length > 0 || prefs.topics.length > 0 || prefs.companies.length > 0;
    // Nothing chosen means there is no personal view to offer. "This week" alone is not a
    // saved view, it is a date filter, so the section is dropped entirely.
    if (!chose) {
      setMine([]);
      return;
    }
    setMine(savedViewsFor(prefs).filter((v) => v.label !== 'This week'));
  }, []);

  const views =
    mine === null
      ? fallback.map((v) => ({
          label: v.name,
          href: `/explore?${new URLSearchParams(v.params).toString()}`,
        }))
      : mine;

  if (views.length === 0) return null;

  return (
    <div className="pb-1.5" data-shell-secondary>
      <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">Saved views</div>
      {views.map((v) => (
        <Link
          key={v.label}
          href={v.href}
          className="mx-1.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
        >
          <span aria-hidden className="w-[15px] shrink-0 text-center text-[11px] opacity-70">
            ◆
          </span>
          <span className="truncate">{v.label}</span>
        </Link>
      ))}
    </div>
  );
}
