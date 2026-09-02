'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CompanionPanel } from './companion-panel';

/**
 * Global Companion access: a floating button, and ⌘K / Ctrl-K.
 *
 * The panel passes the current route as page context so a question asked on a company
 * page is scoped to that company. Context may add to the question; it never silently
 * changes what was asked, and the answer lists the context objects it used.
 */
export function CompanionLauncher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The Companion page already has the panel; the launcher would be redundant there.
  if (pathname.startsWith('/companion')) return null;

  const pageContext = derivePageContext(pathname);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-4 right-4 z-40 rounded-full bg-[var(--accent)] px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
        >
          Ask the Companion <kbd className="ml-1 opacity-70">⌘K</kbd>
        </button>
      ) : null}

      {open ? (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Companion"
            className="surface max-h-[90dvh] w-full max-w-3xl overflow-y-auto p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Companion</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded px-2 py-1 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
              >
                Close
              </button>
            </div>
            <CompanionPanel pageContext={pageContext} compact />
          </div>
        </div>
      ) : null}
    </>
  );
}

function derivePageContext(pathname: string): { kind: string; id: string | null; label: string | null } {
  if (pathname === '/') return { kind: 'today', id: null, label: 'today’s brief' };

  const insight = /^\/insights\/([0-9a-f-]{36})/.exec(pathname);
  if (insight) return { kind: 'insight', id: insight[1] ?? null, label: 'this insight' };

  const company = /^\/explore\/companies\/([\w-]+)/.exec(pathname);
  if (company) return { kind: 'company', id: null, label: company[1] ?? null };

  const industry = /^\/explore\/industries\/([\w-]+)/.exec(pathname);
  if (industry) return { kind: 'industry', id: null, label: industry[1] ?? null };

  const unit = /^\/learn\/([\w-]+)/.exec(pathname);
  if (unit) return { kind: 'learning_unit', id: null, label: unit[1] ?? null };

  return { kind: 'other', id: null, label: null };
}
