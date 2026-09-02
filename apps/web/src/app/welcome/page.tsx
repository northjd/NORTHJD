import Link from 'next/link';
import type { Metadata } from 'next';
import { Wordmark, CompassMark } from '@/components/wordmark';

export const metadata: Metadata = {
  // `absolute` so the root template does not render this as "NORTH · NORTH".
  title: { absolute: 'NORTH' },
  description: 'Know what changed. Understand what matters. Be ready for what’s next.',
};

/**
 * The landing page.
 *
 * Scandinavian in the strict sense rather than the decorative one: near-black ground,
 * one weight of type, wide tracking, and a great deal of nothing. Everything here earns
 * its place — the mark, the name, three sentences, one action. There is no illustration,
 * no gradient and no stock photography, because a product whose entire argument is
 * "we only assert what the evidence supports" should not open with decoration that
 * asserts nothing.
 *
 * The three lines under the name are not marketing copy. They are the product's three
 * obligatory dimensions — recency, depth, applicability — and every feature behind this
 * page serves at least one of them.
 */
export default function WelcomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--surface)] px-6">
      {/* A single hairline horizon. The only ornament on the page, and it is a rule. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--border)] opacity-60"
      />

      <header className="relative z-10 flex items-center justify-between py-7">
        <CompassMark size={22} className="text-[var(--text)]" />
        <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--text-subtle)]">
          Market intelligence
        </p>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-16 text-center">
        <CompassMark size={104} className="mb-12 text-[var(--text)]" />

        <h1 className="sr-only">NORTH</h1>
        <Wordmark size="xl" aria-hidden />

        <div className="mt-14 max-w-[46ch] space-y-1.5">
          {[
            'Know what changed.',
            'Understand what matters.',
            'Be ready for what’s next.',
          ].map((line, i) => (
            <p
              key={line}
              className={`text-[15px] leading-relaxed sm:text-[17px] ${
                i === 0 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {line}
            </p>
          ))}
        </div>

        <Link
          href="/login"
          className="group mt-16 inline-flex items-center gap-3 border border-[var(--border-strong)] px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text)] transition-colors hover:border-[var(--text)]"
        >
          Activate NORTH
          <span
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      </div>

      <footer className="relative z-10 flex flex-wrap items-baseline justify-between gap-3 py-7">
        <Wordmark size="sm" />
        <p className="max-w-[52ch] text-[10.5px] leading-relaxed text-[var(--text-subtle)]">
          Every fact carries the passage it came from. Where the evidence is not there,
          NORTH says so rather than filling the gap.
        </p>
      </footer>
    </main>
  );
}
