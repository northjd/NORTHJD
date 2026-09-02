import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { generationMode } from '@mios/ai';
import { CompanionLauncher } from '@/components/companion-launcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavLink } from '@/components/nav-link';
import { corpusStatus } from '@/lib/queries';

/**
 * Application shell — an operator console rather than a document.
 *
 * A persistent sidebar, a top bar, a scrolling main area and a status bar. The earlier
 * horizontal tab strip read as a website; this reads as a tool you keep open, which is
 * what the product is for.
 *
 * The sidebar groups seven areas by what they are for rather than listing them flat:
 * Intelligence is what changed, Practice is what you do with it, System is how the
 * machine is doing. There is deliberately no navigation entry for Accenture, for
 * consulting firms, or for any single company — those are companies inside Explore,
 * reachable through the same mechanisms as everything else.
 *
 * Corpus statistics live in the status bar, not the header. They describe our
 * monitoring, not the market, and they were competing with the content for attention.
 */

const NAV_GROUPS = [
  {
    label: 'Intelligence',
    items: [
      { href: '/', label: 'Today', icon: '◎', hint: 'Your finite daily brief' },
      { href: '/watch', label: 'Watch', icon: '◇', hint: 'What is unresolved, and what would settle it' },
      { href: '/explore', label: 'Explore', icon: '⊞', hint: 'Companies, industries, technologies' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { href: '/account', label: 'My client', icon: '◆', hint: 'Everything relevant to one account, widened until it has something' },
      { href: '/companion', label: 'Companion', icon: '◧', hint: 'Ask, research, prepare, be challenged' },
      { href: '/learn', label: 'Learn', icon: '▤', hint: 'Industry fundamentals and learning paths' },
      { href: '/prepare', label: 'Prepare', icon: '◈', hint: 'Meeting preparation' },
      { href: '/library', label: 'Library', icon: '▢', hint: 'Saved insights, notes, collections' },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const mode = generationMode();
  const isAdmin = user.role === 'owner' || user.role === 'admin';
  const corpus = await corpusStatus();

  return (
    <div className="app-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav aria-label="Main" className="shell-side no-print flex flex-col">
        <Link
          href="/"
          className="flex h-[46px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-3"
        >
          <span
            aria-hidden
            className="grid h-5 w-5 place-items-center rounded bg-[var(--accent)] text-[10px] font-bold text-[var(--surface)]"
          >
            M
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
            Market Intelligence
          </span>
        </Link>

        <div className="flex-1 py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="pb-1.5">
              <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.href} href={item.href} title={item.hint} icon={item.icon}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="pb-1.5">
            <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">System</div>
            <NavLink href="/search" title="Search everything monitored" icon="⌕">
              Search
            </NavLink>
            <NavLink href="/coverage" title="Is a company or term in the monitored sources at all?" icon="◍">
              Coverage check
            </NavLink>
            {isAdmin ? (
              <NavLink href="/admin" title="Sources, coverage, capabilities, evaluation" icon="⚙">
                Sources &amp; admin
              </NavLink>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] p-2">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
            title={`${user.name || user.email} · ${user.workspaceName}`}
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-inset)] text-[10px] font-semibold">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{user.name || user.email}</span>
          </Link>
        </div>
      </nav>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="shell-bar no-print flex items-center gap-3 px-4">
        {mode.generator === 'deterministic_extractive' ? (
          <Link
            href="/admin/capabilities"
            className="inline-flex items-center gap-1.5 rounded border border-caution-500/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.055em] text-caution-700 dark:text-caution-100"
            title="No language model is configured, so summaries reuse source sentences verbatim and nothing is paraphrased."
          >
            Extractive mode
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)]"
            title={
              corpus.unevidencedFacts === 0
                ? 'Every fact carries an evidence span.'
                : `${corpus.unevidencedFacts} facts have no evidence span.`
            }
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  corpus.unevidencedFacts === 0 ? 'var(--color-verified-500)' : 'var(--color-alert-500)',
              }}
            />
            {corpus.unevidencedFacts === 0 ? 'evidence intact' : `${corpus.unevidencedFacts} unevidenced`}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main id="main" className="shell-main px-5 py-6">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* ── Status bar ──────────────────────────────────────────────────────
          Corpus size belongs here: it matters, but it is not what the reader is
          looking at, and in the header it competed with the content. */}
      <footer className="shell-status no-print flex items-center gap-4 overflow-hidden whitespace-nowrap px-4 text-[10.5px] text-[var(--text-subtle)]">
        <span className="tabular-nums">
          {corpus.documents} docs · {corpus.claims} claims · {corpus.events} events
        </span>
        <span className="hidden sm:inline">
          {corpus.activeSources} active sources
        </span>
        <span className="ml-auto hidden md:inline">
          This reflects the monitored sources only — not a claim about everything that happened.
        </span>
      </footer>

      <CompanionLauncher />
    </div>
  );
}
