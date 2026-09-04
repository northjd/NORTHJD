'use client';

import { useState, useTransition } from 'react';
import { completeBriefAction } from '@/app/(app)/actions';

/**
 * The end of the brief.
 *
 * This is the "You are caught up" state, and the important behaviour is what it does
 * *not* do: nothing loads after it. The user leaves deliberately, by choosing Explore,
 * rather than by running out of willpower.
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
  const [done, setDone] = useState(completed);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <section className="surface mt-8 p-6 text-center">
        <p className="text-[18px] font-semibold">You are caught up.</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--text-muted)]">
          That is the whole brief for today — {total} item{total === 1 ? '' : 's'}. Nothing more
          will load here. Come back tomorrow, or go looking for something specific.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href="/explore"
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
      </section>
    );
  }

  return (
    <section className="surface mt-8 flex flex-col items-center gap-3 p-5 text-center">
      <p className="text-[14px] text-[var(--text-muted)]">
        {read} of {total} read. This is the end of today&apos;s selection.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await completeBriefAction(briefId);
            setDone(true);
          })
        }
        className="rounded bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--surface)] disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Mark brief as done'}
      </button>
    </section>
  );
}
