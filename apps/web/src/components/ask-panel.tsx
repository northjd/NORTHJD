'use client';

import { useState } from 'react';
import { retrieveInBrowser } from '@/lib/retrieval-browser';
import { IS_STATIC_BUILD } from '@/lib/static-build';

/**
 * Ask — retrieval here, reasoning in your own Claude.
 *
 * The previous Companion tried to answer questions itself. Without a language model it
 * could only return sentences already present in the corpus, which made an "ask
 * anything" box a slower search that mostly refused.
 *
 * This does the half NORTH is uniquely able to do: find the claims that bear on a
 * question, with their sources, dates and evidence strength, and package them into a
 * prompt. You paste that into the Claude you already have. No API key, no cost, and the
 * evidence guarantee survives the handoff — the model reasons over sourced claims rather
 * than from memory, and the prompt tells it to say so when the evidence runs out.
 */

const MODES = [
  { key: 'explore', label: 'Explore', hint: 'Answer it from the evidence' },
  { key: 'brief', label: 'Brief me', hint: 'Short: what changed, why it matters' },
  { key: 'prepare', label: 'Prepare me', hint: 'For a conversation: questions to ask' },
  { key: 'challenge', label: 'Challenge me', hint: 'Argue against my premise' },
  { key: 'explain', label: 'Explain it', hint: 'How this market actually works' },
] as const;

interface Evidence {
  index: number;
  text: string;
  claimType: string;
  sourceName: string;
  documentUrl: string;
  publishedAt: string | null;
  isFirstParty: boolean;
}

interface AskResult {
  coverage: { ratio: number; missing: string[]; sufficient: boolean };
  evidence: Evidence[];
  prompt: string;
  empty: boolean;
}

export function AskPanel({ initialQuestion = '' }: { initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('explore');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<AskResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const ask = async () => {
    if (question.trim().length < 3 || state === 'working') return;
    setState('working');
    setCopied(false);
    try {
      /*
       * The API route when there is one, the shipped corpus when there is not.
       *
       * Both paths use the same term extraction, the same coverage test and the same
       * prompt builder, so the answer to "can this be answered" and the prompt you copy
       * are identical either way. Only the search differs: PostgreSQL full-text on the
       * server, weighted term overlap over 471 claims in the browser.
       */
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), mode }),
      }).catch(() => null);

      if (res?.ok) {
        setResult(await res.json());
      } else {
        const local = await retrieveInBrowser(question.trim(), mode);
        setResult({
          coverage: local.coverage,
          evidence: local.prompt.evidence,
          prompt: local.prompt.text,
          empty: local.prompt.empty,
        });
      }
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retrieval failed');
      setState('error');
    }
  };

  const copy = async () => {
    if (!result?.prompt) return;
    await navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            title={m.hint}
            onClick={() => setMode(m.key)}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              mode === m.key
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask();
          }}
          rows={2}
          placeholder="Which retailers have moved AI beyond pilots?"
          className="flex-1 resize-none rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-[13.5px] leading-relaxed outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={ask}
          disabled={question.trim().length < 3 || state === 'working'}
          className="shrink-0 self-start rounded-md bg-[var(--accent)] px-4 py-2.5 text-[13px] font-medium text-[var(--surface)] disabled:opacity-40"
        >
          {state === 'working' ? 'Finding…' : 'Find evidence'}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-[var(--text-subtle)]">
        Do not paste confidential client information. ⌘↵ to search.
      </p>

      {state === 'error' ? (
        <p role="alert" className="mt-4 text-[13px] text-alert-700 dark:text-alert-100">
          {error}
        </p>
      ) : null}

      {state === 'done' && result ? (
        result.empty || result.evidence.length === 0 ? (
          <div className="mt-6 border-l border-caution-500/50 pl-4">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.17em] text-caution-700 dark:text-caution-100">
              Nothing to hand over
            </p>
            <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
              No monitored source bears on this.
              {result.coverage.missing.length > 0
                ? ` Nothing mentions: ${result.coverage.missing.join(', ')}.`
                : ''}{' '}
              A prompt built on nothing would invite a confident answer assembled from memory, which
              is the failure this product exists to prevent — so there is no prompt to copy.
            </p>
            <p className="mt-2 text-[12.5px] text-[var(--text-subtle)]">
              Registering a source for this would change it.
              {IS_STATIC_BUILD ? null : (
                <>
                  {' '}
                  <a
                    href={`/coverage?q=${encodeURIComponent(question)}`}
                    className="underline underline-offset-2 hover:text-[var(--text)]"
                  >
                    Check coverage →
                  </a>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3">
              <span className="text-[13px]">
                <strong className="font-semibold">{result.evidence.length}</strong> pieces of
                evidence
              </span>
              {!result.coverage.sufficient ? (
                <span
                  className="text-[11.5px] text-caution-700 dark:text-caution-100"
                  title="Some of what you asked about appears in no source."
                >
                  partial match — nothing mentions {result.coverage.missing.join(', ')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={copy}
                className="ml-auto rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--surface)]"
              >
                {copied ? 'Copied ✓' : 'Copy prompt for Claude'}
              </button>
            </div>

            <p className="mt-3 max-w-[72ch] text-[12.5px] leading-relaxed text-[var(--text-subtle)]">
              Paste it into Claude. The prompt carries only these sourced claims and tells Claude to
              cite them, to separate evidence from inference, to treat self-reported items as claims
              rather than findings, and to say plainly when the evidence does not answer the
              question.
            </p>

            <h3 className="t-rule mt-7">What Claude will be given</h3>
            <ul className="mt-3 grid gap-2.5">
              {result.evidence.map((e) => (
                <li key={e.index} className="border-l border-[var(--border-strong)] pl-3.5">
                  <p className="text-[13px] leading-relaxed">
                    <span className="mr-1.5 text-[11px] tabular-nums text-[var(--text-subtle)]">
                      [{e.index}]
                    </span>
                    {e.text}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--text-subtle)]">
                    <a
                      href={e.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2 hover:text-[var(--text)]"
                    >
                      {e.sourceName}
                    </a>
                    {e.publishedAt ? <span>{e.publishedAt}</span> : null}
                    {e.isFirstParty ? (
                      <span className="text-caution-700 dark:text-caution-100">self-reported</span>
                    ) : null}
                    {e.claimType !== 'FACT' ? <span>{e.claimType.toLowerCase()}</span> : null}
                  </p>
                </li>
              ))}
            </ul>

            <details className="mt-6">
              <summary className="cursor-pointer list-none text-[12px] text-[var(--text-subtle)] hover:text-[var(--text-muted)]">
                <span className="underline underline-offset-2">See the exact prompt</span>
              </summary>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap">
                {result.prompt}
              </pre>
            </details>
          </div>
        )
      ) : null}
    </div>
  );
}
