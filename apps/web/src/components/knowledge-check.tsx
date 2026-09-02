'use client';

import { useState, useTransition } from 'react';
import { answerKnowledgeCheckAction } from '@/app/(app)/learn/actions';

interface Check {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * A knowledge check.
 *
 * A wrong answer gets the explanation, not just a cross — the point is to correct the
 * understanding, and the result feeds the knowledge state either way.
 */
export function KnowledgeCheck({ unitId, check }: { unitId: string; check: Check }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const submit = (index: number) => {
    setSelected(index);
    start(async () => {
      await answerKnowledgeCheckAction({ unitId, selectedIndex: index });
    });
  };

  return (
    <div className="surface p-4">
      <p className="mb-3 text-[15px] font-medium leading-relaxed">{check.question}</p>
      <ol className="space-y-1.5">
        {check.options.map((option, i) => {
          const chosen = selected === i;
          const correct = i === check.correctIndex;
          const reveal = selected !== null;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={reveal || pending}
                onClick={() => submit(i)}
                className={`w-full rounded border px-3 py-2 text-left text-[14px] leading-relaxed transition-colors disabled:cursor-default ${
                  reveal && correct
                    ? 'border-verified-500 bg-verified-100 dark:bg-verified-700/20'
                    : reveal && chosen
                      ? 'border-alert-500 bg-alert-100 dark:bg-alert-700/20'
                      : 'border-[var(--border)] hover:bg-[var(--surface-inset)]'
                }`}
              >
                {option}
                {reveal && correct ? <span className="ml-2 text-[12px] font-semibold">correct</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {selected !== null ? (
        <div className="mt-3 rounded bg-[var(--surface-inset)] p-3">
          <p className="text-[13px] leading-relaxed">{check.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
