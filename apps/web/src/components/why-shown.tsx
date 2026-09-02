'use client';

import { useState } from 'react';

/**
 * "Why am I seeing this?" — the ranking model's reasons, verbatim.
 *
 * The strings come from `scoreItem`, not from a separate explanation step, so the
 * panel cannot drift from the scoring that actually happened.
 */
export function WhyShown({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12px] text-[var(--accent)] underline underline-offset-2"
      >
        Why am I seeing this?
      </button>
      {open ? (
        <div className="surface absolute right-0 z-20 mt-1.5 w-72 p-3 text-left shadow-lg">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
            Ranking reasons
          </p>
          <ul className="space-y-1">
            {reasons.map((reason, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-[var(--border)] pt-1.5 text-[11px] text-[var(--text-subtle)]">
            No company or firm receives a ranking bonus for being itself.
          </p>
        </div>
      ) : null}
    </span>
  );
}
