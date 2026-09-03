'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Product feedback, from anywhere.
 *
 * The point of sharing NORTH with colleagues is to find out what is wrong with it, and
 * feedback you have to go looking for does not get given. This sits in the shell, one
 * click away on every page, and captures the route automatically — the commonest failure
 * of a feedback box is a report nobody can reproduce.
 *
 * Distinct from the per-insight feedback bar, which records reactions to *content* and
 * feeds ranking. This one is about the product.
 */

const KINDS = [
  { key: 'confusing', label: 'Confusing', hint: 'I could not work out what this was for' },
  { key: 'broken', label: 'Broken', hint: 'Something did not work' },
  { key: 'idea', label: 'Idea', hint: 'It would be better if…' },
  { key: 'praise', label: 'This worked', hint: 'Worth keeping' },
] as const;

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('idea');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async () => {
    if (!message.trim() || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, message: message.trim(), route: pathname }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not send');
      setState('sent');
      setMessage('');
      setTimeout(() => {
        setOpen(false);
        setState('idle');
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
      setState('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-4 left-4 z-40 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3.5 py-2 text-[11.5px] text-[var(--text-muted)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)] lg:left-[244px]"
        title="Tell us what is wrong with this"
      >
        Feedback
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-start bg-black/50 p-4 backdrop-blur-[2px] sm:items-center sm:justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div className="w-full max-w-[440px] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="t-eyebrow">Feedback</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13px] text-[var(--text-subtle)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {state === 'sent' ? (
              <p className="py-8 text-center text-[13.5px] text-[var(--text)]">
                Sent. Thank you — this is the useful part.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  Blunt is more useful than polite. The page you are on is recorded
                  automatically.
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      title={k.hint}
                      onClick={() => setKind(k.key)}
                      className={`rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
                        kind === k.key
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                          : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)]'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder={KINDS.find((k) => k.key === kind)?.hint ?? ''}
                  className="mt-3 w-full resize-none rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-[13px] leading-relaxed outline-none focus:border-[var(--accent)]"
                />

                {state === 'error' ? (
                  <p role="alert" className="mt-2 text-[12px] text-alert-700 dark:text-alert-100">
                    {error}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[10.5px] leading-relaxed text-[var(--text-subtle)]">
                    Do not paste confidential client information.
                  </p>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!message.trim() || state === 'sending'}
                    className="shrink-0 rounded bg-[var(--accent)] px-4 py-2 text-[12.5px] font-medium text-[var(--surface)] disabled:opacity-50"
                  >
                    {state === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
