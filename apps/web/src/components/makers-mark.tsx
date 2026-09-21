'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CompassMark } from './wordmark';

/**
 * The maker's mark, and what is behind it.
 *
 * The JD monogram on the landing page is a real button. Clicking it opens a note from
 * the person who built the thing — which is exactly what a maker's mark is for, and why
 * this is the only place in the product where an easter egg belongs rather than being
 * decoration bolted onto a serious surface.
 *
 * Findable rather than hidden: it looks like part of the wordmark, and only a cursor
 * change and a title attribute suggest otherwise. Someone poking at the logo finds it;
 * nobody else is interrupted by it.
 *
 * The panel is portalled to `document.body`, and that is load-bearing rather than tidy.
 * This component is mounted in three places with very different surroundings, and being
 * a DOM descendant of any of them leaks their styling into a panel that covers the whole
 * screen.
 *
 * The app-shell footer is `... overflow-hidden whitespace-nowrap text-[10.5px] ...`, and
 * `white-space` inherits. Every paragraph of the note rendered as one unwrapped line
 * running out of both sides of the card — on the footer that appears on every page, so
 * on the only route by which anyone would normally find it.
 *
 * The set-up gate is worse in a different way: it is `fixed inset-0 z-[95]` and its
 * footer is `relative z-10`, so a panel rendered in place sits two stacking contexts
 * deep and can never rise above either of them.
 *
 * A portal fixes both at once — the panel inherits from `body` and paints in the root
 * stacking context — which is why it is a portal rather than a `whitespace-normal` patch.
 */
export function MakersMark({ className = '' }: { className?: string }) {
  const [found, setFound] = useState(false);
  // `document` does not exist while this renders on the server, and the portal needs it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!found) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFound(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [found]);

  return (
    <>
      <button
        type="button"
        onClick={() => setFound(true)}
        title="JD"
        aria-label="About the maker"
        className={`cursor-pointer text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] ${className}`}
        style={{ letterSpacing: '0.14em' }}
      >
        JD
      </button>

      {found && mounted
        ? createPortal(
            <div
              // Above the set-up gate's z-[95]: this is a panel the reader opened on
              // purpose, so nothing in the product should be in front of it.
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-6 backdrop-blur-[3px]"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFound(false);
              }}
              role="dialog"
              aria-modal="true"
              aria-label="You found the easter egg"
            >
              <div className="w-full max-w-[440px] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-9 py-10 text-center">
                <CompassMark size={44} className="mx-auto text-[var(--text)]" />

                <p className="t-eyebrow mt-7">You found me</p>

                <p className="mt-4 text-[16px] leading-relaxed text-[var(--text)]">
                  Congratulations &mdash; I&rsquo;m an easter egg.
                </p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                  JD hid me here for you to find. If you got this far you were poking at the logo
                  instead of reading the copy, which is exactly the right instinct.
                </p>
                <p className="mt-5 text-[13.5px] font-medium text-[var(--text)]">
                  Welcome to the team.
                </p>

                <button
                  type="button"
                  onClick={() => setFound(false)}
                  className="mt-8 border border-[var(--border-strong)] px-6 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Back to true north
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
