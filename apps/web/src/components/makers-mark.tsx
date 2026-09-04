'use client';

import { useEffect, useState } from 'react';
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
 */
export function MakersMark({ className = '' }: { className?: string }) {
  const [found, setFound] = useState(false);

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

      {found ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-6 backdrop-blur-[3px]"
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
              Congratulations — I&rsquo;m an easter egg.
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
        </div>
      ) : null}
    </>
  );
}
