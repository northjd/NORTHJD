'use client';

import { useState } from 'react';

const KINDS = [
  ['already_knew', 'Already knew this'],
  ['new_to_me', 'New to me'],
  ['need_more_context', 'Need more context'],
  ['changed_my_view', 'Changed my view'],
  ['used_in_conversation', 'Used it'],
  ['not_relevant', 'Not relevant'],
] as const;

/**
 * Insight feedback, without a server.
 *
 * On the server build these reactions feed ranking, so what you mark as already-known
 * stops crowding tomorrow's brief. There is nowhere to send them here, and pretending
 * otherwise would be worse than saying so: the control records your choice for the
 * session and tells you it goes no further.
 */
export function FeedbackBar({ insightId }: { insightId: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  void insightId;

  return (
    <div className="no-print surface p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
        Was this useful?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setChosen(key)}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              chosen === key
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-subtle)]">
        {chosen
          ? 'Noted for this session. This snapshot has nowhere to send it, so it does not shape future briefs — on the hosted version it would.'
          : 'On the hosted version these shape what reaches your brief. This snapshot has no server, so they go no further than this page.'}
      </p>
    </div>
  );
}
