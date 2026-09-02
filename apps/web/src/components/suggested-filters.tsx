'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { SuggestedFilter } from '@/lib/explore-queries';

/**
 * Suggested filters, derived from the user's own profile and watchlist.
 *
 * Placed above the results rather than in the rail, because the rail is a narrow
 * sidebar that collapses on smaller screens and people did not find it.
 *
 * Each suggestion sets several dimensions at once — "my industries" is three
 * industries, "measured outcomes" is two maturity levels — and shows its live count,
 * including the unflattering ones. A suggestion that matches everything is telling the
 * user their profile is too broad for the current coverage; that is worth knowing.
 */
export function SuggestedFilters({
  suggestions,
  role,
}: {
  suggestions: SuggestedFilter[];
  role: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const isApplied = (s: SuggestedFilter) =>
    Object.entries(s.params).every(([k, v]) => params.get(k) === v);

  const toggle = (s: SuggestedFilter) => {
    const next = new URLSearchParams(params.toString());
    if (isApplied(s)) {
      Object.keys(s.params).forEach((k) => next.delete(k));
    } else {
      Object.entries(s.params).forEach(([k, v]) => next.set(k, v));
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  if (suggestions.length === 0) return null;

  return (
    <section className={`no-print mb-5 ${pending ? 'opacity-70' : ''}`}>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <strong className="text-[12.5px] font-semibold tracking-tight">Suggested for you</strong>
        <span className="t-meta">
          {role || 'Your profile'} · one tap sets several filters · counts are live
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((s) => {
          const on = isApplied(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={on}
              className={`surface card-lift flex max-w-[250px] shrink-0 items-center gap-2 px-3 py-2.5 text-left ${
                on ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''
              }`}
            >
              <span
                aria-hidden
                className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[13px] ${
                  on ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-inset)]'
                }`}
              >
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold tracking-tight">
                  {s.name}
                  <span
                    className={`ml-1 font-medium ${on ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]'}`}
                  >
                    · {s.narrows ? s.count : `all ${s.count}`}
                  </span>
                </span>
                <span
                  className={`block truncate text-[11px] ${on ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]'}`}
                >
                  {s.narrows ? s.detail : 'Matches everything — too broad to narrow anything'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
