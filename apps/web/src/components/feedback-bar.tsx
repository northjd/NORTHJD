'use client';

import { useState, useTransition } from 'react';
import { submitFeedbackAction } from '@/app/(app)/actions';
import type { FeedbackKind } from '@mios/domain';

/**
 * Reflection controls.
 *
 * These are the flywheel's Reflect step. They are not ratings — "I already knew this"
 * advances the knowledge state for the concepts this insight touches, and "not
 * relevant" changes what the ranking selects tomorrow.
 */
const OPTIONS: { kind: FeedbackKind; label: string; hint: string }[] = [
  { kind: 'already_knew', label: 'I knew this', hint: 'Marks the connected concepts as understood.' },
  { kind: 'new_to_me', label: 'New to me', hint: 'Marks the connected concepts as introduced.' },
  { kind: 'need_more_context', label: 'Need more context', hint: 'Prioritises fundamentals on this topic.' },
  { kind: 'changed_my_view', label: 'Changed my view', hint: 'Recorded for your weekly review.' },
  { kind: 'used_in_conversation', label: 'Used in a conversation', hint: 'The applicability signal that matters most.' },
  { kind: 'not_relevant', label: 'Not relevant', hint: 'Down-weights similar items.' },
];

export function FeedbackBar({ insightId }: { insightId: string }) {
  const [chosen, setChosen] = useState<FeedbackKind | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="no-print surface p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
        Was this useful?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            title={option.hint}
            disabled={pending || chosen !== null}
            onClick={() =>
              start(async () => {
                await submitFeedbackAction({ insightId, kind: option.kind, note: '' });
                setChosen(option.kind);
              })
            }
            className={`rounded border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 ${
              chosen === option.kind
                ? 'border-transparent bg-[var(--accent)] text-[var(--surface)]'
                : 'border-[var(--border)] hover:bg-[var(--surface-inset)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {chosen ? (
        <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
          Recorded. This feeds tomorrow&apos;s selection and your knowledge state — you can review and
          correct both in your profile.
        </p>
      ) : null}
    </div>
  );
}
