import Link from 'next/link';
import { requireUser, IS_STATIC_EXPORT } from '@/lib/session';
import { generationMode } from '@mios/ai';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavLink } from '@/components/nav-link';
import { corpusStatus } from '@/lib/queries';
import { CommandPalette } from '@/components/command-palette';
import { FeedbackWidget } from '@/components/feedback-widget';
import { SetupGate } from '@/components/static-variants/setup-gate';
import { Wordmark, CompassMark } from '@/components/wordmark';
import { MakersMark } from '@/components/makers-mark';
import { querySuggestedFilters } from '@/lib/explore-queries';
import { db, schema } from '@mios/database';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { config } from '@mios/config';

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
 *
 * Ask replaced the Companion. Without a language model the Companion could only return
 * sentences already in the corpus, which made an "ask anything" box a slower search that
 * mostly refused. Ask does the half NORTH is uniquely able to do — finding the evidence
 * that bears on a question — and hands the reasoning to the user's own Claude. The
 * Companion route and engine remain for a deployment that configures a model.
 */

const NAV_GROUPS = [
  {
    label: 'Intelligence',
    items: [
      { href: '/', label: 'Today', icon: '◎', hint: 'Your finite daily brief' },
      {
        href: '/account',
        label: 'Market search',
        icon: '◆',
        hint: 'Look up a company and read it through its market — what moved, who moved it, and what the company itself has said',
      },
      {
        href: '/watch',
        label: 'Watch',
        icon: '◇',
        hint: 'What is unresolved, and what would settle it',
      },
      {
        href: '/deals',
        label: 'Key deals',
        icon: '⇄',
        hint: 'Publicly announced acquisitions, investments, partnerships and market entries',
      },
      {
        href: '/explore',
        label: 'Explore',
        icon: '⊞',
        hint: 'Companies, industries, technologies',
      },
      {
        href: '/ask',
        label: 'Ask',
        icon: '◧',
        hint: 'Find the evidence on a question, then reason over it in your own Claude',
      },
    ],
  },
  {
    label: 'Practice',
    items: [
      {
        href: '/learn',
        label: 'Learn',
        icon: '▤',
        hint: 'Industry fundamentals and learning paths',
      },
      { href: '/prepare', label: 'Prepare', icon: '◈', hint: 'Meeting preparation' },
      { href: '/library', label: 'Library', icon: '▢', hint: 'Saved insights, notes, collections' },
      {
        href: '/you',
        label: 'Your numbers',
        icon: '◔',
        hint: 'What you have read, asked and learned',
      },
    ],
  },
];

/**
 * Routes the static build does not contain.
 *
 * Each needs a server — a query string read at request time, or a server action — so the
 * export leaves them out. Linking to them anyway would produce a sidebar of 404s, which
 * is a worse experience than a shorter sidebar.
 */
const NOT_IN_STATIC_BUILD = new Set(['/search', '/coverage', '/prepare', '/companion']);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  /*
   * First run.
   *
   * With passwords, "first run" is a property of the account and the profile row decides
   * it. In open mode everyone shares one account, so that test never fires again after
   * the first visitor — which is why a second person would land straight in a brief
   * assembled for someone else's interests.
   *
   * So in open mode first-run is a property of the *browser*: a cookie set when set-up is
   * completed or skipped. The honest consequence is that preferences are still shared —
   * the last person through overwrites the previous one — and the set-up page says so.
   * That is the cost of having no accounts, and it is reversible by turning passwords on.
   */
  const profile = await db().query.userProfiles.findFirst({
    where: and(
      eq(schema.userProfiles.userId, user.userId),
      eq(schema.userProfiles.workspaceId, user.workspaceId),
    ),
  });

  // The static build has no request and therefore no cookie, so set-up cannot be gated
  // on one. It is reachable from the profile instead.
  const openMode = config().AUTH_MODE === 'open';
  const seenSetup =
    IS_STATIC_EXPORT || (openMode ? Boolean((await cookies()).get('north_setup_seen')) : false);
  const needsSetup = IS_STATIC_EXPORT
    ? false
    : openMode
      ? !seenSetup
      : !profile?.onboardingCompletedAt;
  if (needsSetup) redirect('/onboarding');

  const mode = generationMode();
  const isAdmin = user.role === 'owner' || user.role === 'admin';
  const corpus = await corpusStatus();

  // Saved views in the sidebar rather than only on Explore: they are how someone gets to
  // the slice they care about, and having to reach Explore first to find them made the
  // most personalised thing in the product the least reachable. Counts are live, so a
  // view that currently matches nothing says so before you click it.
  const PERSONAL_VIEWS = new Set(['my-industries', 'my-watchlist', 'my-topics', 'this-week']);
  const savedViews = (await querySuggestedFilters(user.workspaceId, user.userId))
    .filter((v) => v.narrows && PERSONAL_VIEWS.has(v.id))
    .slice(0, 4);

  return (
    <div className="app-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav aria-label="Main" className="shell-side no-print">
        <Link
          href="/"
          className="flex h-[46px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-3"
        >
          <CompassMark size={18} className="text-[var(--text)]" />
          <Wordmark size="sm" />
        </Link>

        <div className="flex-1 py-2">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !(IS_STATIC_EXPORT && NOT_IN_STATIC_BUILD.has(item.href)),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="pb-1.5">
                <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">{group.label}</div>
                {items.map((item) => (
                  <NavLink key={item.href} href={item.href} title={item.hint} icon={item.icon}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}

          {savedViews.length > 0 ? (
            <div className="pb-1.5" data-shell-secondary>
              <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">Saved views</div>
              {savedViews.map((v) => (
                <Link
                  key={v.id}
                  href={`/explore?${new URLSearchParams(v.params).toString()}`}
                  title={v.detail}
                  className="mx-1.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
                >
                  <span
                    aria-hidden
                    className="w-[15px] shrink-0 text-center text-[11px] opacity-70"
                  >
                    {v.icon}
                  </span>
                  <span className="truncate">{v.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums opacity-55">
                    {v.count}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="pb-1.5">
            <div className="t-eyebrow px-3.5 pb-1.5 pt-2.5">System</div>
            {IS_STATIC_EXPORT ? null : (
              <>
                <NavLink href="/search" title="Search everything monitored" icon="⌕">
                  Search
                </NavLink>
                <NavLink
                  href="/coverage"
                  title="Is a company or term in the monitored sources at all?"
                  icon="◍"
                >
                  Coverage check
                </NavLink>
              </>
            )}
            {isAdmin ? (
              <NavLink href="/admin" title="Sources, coverage, capabilities, evaluation" icon="⚙">
                Sources &amp; admin
              </NavLink>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] p-2" data-shell-secondary>
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
          <span className="hidden items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-subtle)] sm:inline-flex">
            Search, filter or ask
            <kbd className="rounded border border-[var(--border-strong)] px-1 text-[9.5px]">⌘K</kbd>
          </span>
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
                  corpus.unevidencedFacts === 0
                    ? 'var(--color-verified-500)'
                    : 'var(--color-alert-500)',
              }}
            />
            {corpus.unevidencedFacts === 0
              ? 'evidence intact'
              : `${corpus.unevidencedFacts} unevidenced`}
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
        <span className="hidden sm:inline">{corpus.activeSources} active sources</span>
        <span className="ml-auto hidden md:inline">Monitored sources only.</span>
        {/* The maker's mark lives here as well as on the landing page, because the
            landing page is shown once and there is no way back to it — which made the
            thing behind it unreachable for everyone after their first visit. */}
        <MakersMark className="ml-auto text-[9px] font-semibold leading-none md:ml-3" />
      </footer>

      {/* The static build has no server to run set-up through, so it runs in the
          browser and stores per person — see components/static-variants/setup-gate. */}
      {IS_STATIC_EXPORT ? <SetupGate /> : null}
      <CommandPalette />
      <FeedbackWidget />
    </div>
  );
}
