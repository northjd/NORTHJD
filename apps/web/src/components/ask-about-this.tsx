'use client';

import { useState } from 'react';
import { CompanionPanel } from './companion-panel';

/** Contextual Companion entry point on an insight. */
export function AskAboutThis({
  insightId,
  headline,
  suggestions,
}: {
  insightId: string;
  headline: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>();

  if (!open) {
    return (
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSeed(s);
              setOpen(true);
            }}
            className="w-full rounded border border-[var(--border)] px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-inset)]"
          >
            {s}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
          Companion
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-[var(--text-muted)] underline underline-offset-2"
        >
          Close
        </button>
      </div>
      <CompanionPanel
        pageContext={{ kind: 'insight', id: insightId, label: headline.slice(0, 60) }}
        initialQuestion={seed}
        compact
      />
    </div>
  );
}
