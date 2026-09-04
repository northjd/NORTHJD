'use client';

import { useEffect, useState } from 'react';

/**
 * Brief progress, without a server.
 *
 * The brief being *finite* is the point of it — there is a bottom, and reaching it means
 * something. That has to survive the static build, so completion is recorded in
 * `localStorage` keyed by brief rather than written to the database.
 *
 * The consequence is real and worth knowing: it belongs to this browser. Clear your site
 * data and the brief is unread again.
 */
export function BriefProgress({
  briefId,
  total,
  read,
  completed,
}: {
  briefId: string;
  total: number;
  read: number;
  completed: boolean;
}) {
  const key = `north:brief:${briefId}`;
  const [done, setDone] = useState(completed);

  useEffect(() => {
    try {
      if (localStorage.getItem(key) === 'done') setDone(true);
    } catch {
      // Private browsing or storage disabled: the brief simply never marks itself done.
    }
  }, [key]);

  if (done) {
    return (
      <div className="no-print surface mt-8 p-5 text-center">
        <p className="text-[15px] font-medium">You are caught up.</p>
        <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
          Nothing more will load here. That is the whole idea — the brief is a decision made once a
          day, not a feed that keeps going until you stop.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href="/account"
            className="rounded border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--surface-inset)]"
          >
            Explore a market
          </a>
          <a
            href="/deals"
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--surface)]"
          >
            Key deals
          </a>
          <a
            href="/learn"
            className="rounded border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--surface-inset)]"
          >
            Continue learning
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="no-print surface mt-8 flex flex-wrap items-center gap-3 p-4">
      <p className="text-[13px] text-[var(--text-muted)]">
        <strong className="font-semibold text-[var(--text)]">
          {read}/{total}
        </strong>{' '}
        read
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, 'done');
          } catch {
            /* nothing to do; the button still completes visually */
          }
          setDone(true);
        }}
        className="ml-auto rounded bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--surface)]"
      >
        Mark brief as done
      </button>
    </div>
  );
}
