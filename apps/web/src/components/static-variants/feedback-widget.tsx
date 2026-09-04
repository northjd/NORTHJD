'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Product feedback, with nowhere to POST it.
 *
 * The static export has no API route, so the server version's `fetch('/api/feedback')`
 * was a button that failed. A feedback control that silently does nothing is worse than
 * no feedback control: the colleague believes they have told you, and you never hear it.
 *
 * So this composes the report — the kind, the message, the page it was written on, the
 * build it was written against — and hands it back to be copied or mailed. It is one more
 * step than a POST and it actually arrives.
 *
 * `NEXT_PUBLIC_FEEDBACK_EMAIL` turns the mail button on. Left unset by default: putting
 * an address in a public repository is how it ends up in a scraper, and the copy button
 * works without one.
 */

const KINDS = [
  { key: 'confusing', label: 'Confusing', hint: 'I could not work out what this was for' },
  { key: 'broken', label: 'Broken', hint: 'Something did not work' },
  { key: 'idea', label: 'Idea', hint: 'It would be better if…' },
  { key: 'praise', label: 'This worked', hint: 'Worth keeping' },
] as const;

const MAIL_TO = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL ?? '';

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('idea');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const report = `NORTH feedback — ${kind}
Page: ${pathname}
When: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}

${message.trim()}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the textarea is right there and selectable.
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

            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Blunt is more useful than polite. This build has no server to receive it, so copy the
              report and send it however you like — the page you are on is included.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  title={k.hint}
                  aria-pressed={kind === k.key}
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

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10.5px] leading-relaxed text-[var(--text-subtle)]">
                Do not paste confidential client information.
              </p>
              <div className="flex shrink-0 gap-2">
                {MAIL_TO ? (
                  <a
                    href={`mailto:${MAIL_TO}?subject=${encodeURIComponent(
                      `NORTH feedback — ${kind}`,
                    )}&body=${encodeURIComponent(report)}`}
                    className="rounded border border-[var(--border-strong)] px-3 py-2 text-[12.5px] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]"
                  >
                    Email
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={copy}
                  disabled={!message.trim()}
                  className="rounded bg-[var(--accent)] px-4 py-2 text-[12.5px] font-medium text-[var(--surface)] disabled:opacity-50"
                >
                  {copied ? 'Copied' : 'Copy report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
