'use client';

import { useState } from 'react';

interface Check {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * A knowledge check, without a server.
 *
 * The teaching happens entirely in the browser anyway: the point of a check is the
 * explanation you get afterwards, not the score. Only the record of having answered is
 * lost, and with it the knowledge-state estimate that record feeds — which the Learn page
 * says plainly rather than showing a confident zero.
 */
export function KnowledgeCheck({ unitId, check }: { unitId: string; check: Check }) {
  const [selected, setSelected] = useState<number | null>(null);
  void unitId;

  return (
    <div className="surface p-4">
      <p className="text-[13.5px] font-medium">{check.question}</p>
      <ul className="mt-3 grid gap-1.5">
        {check.options.map((option, i) => {
          const chosen = selected === i;
          const isCorrect = i === check.correctIndex;
          const revealed = selected !== null;
          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                disabled={revealed}
                className={`w-full rounded-md border px-3 py-2 text-left text-[13px] transition-colors ${
                  revealed && isCorrect
                    ? 'border-verified-500/50 text-verified-700 dark:text-verified-100'
                    : chosen
                      ? 'border-alert-500/50 text-alert-700 dark:text-alert-100'
                      : 'border-[var(--border-strong)] hover:border-[var(--accent-line)]'
                }`}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {selected !== null ? (
        <div className="mt-3 border-l-2 border-[var(--accent-line)] pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-subtle)]">
            {selected === check.correctIndex ? 'Correct' : 'Not quite'}
          </p>
          {/* The explanation runs either way: being told why is the part that teaches. */}
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
            {check.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
