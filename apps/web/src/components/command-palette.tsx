'use client';

import { assetPath } from '@/lib/asset-path';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Command palette.
 *
 * A platform is navigated by typing, not by hunting. ⌘K opens this from anywhere; it
 * covers the seven areas, every tracked company, industries and topics, the plain-language
 * confidence filters, and the coverage check.
 *
 * Two behaviours worth keeping:
 *
 *  - **Companies with no coverage are listed.** A company you cannot select is a question
 *    you cannot ask. Selecting one takes you to the coverage check, which explains which
 *    kind of silence it is and what would fix it.
 *  - **Anything unmatched still offers the coverage check.** Typing a term the product has
 *    never heard of should not produce an empty menu; it should produce the honest answer.
 */

export interface PaletteEntity {
  slug: string;
  name: string;
  events: number;
  aliases: string | null;
}

export interface PaletteTaxonomy {
  slug: string;
  name: string;
}

interface Item {
  group: string;
  icon: string;
  label: string;
  detail?: string;
  href: string;
}

const AREAS: Item[] = [
  { group: 'Go to', icon: '◎', label: 'Today', href: '/' },
  { group: 'Go to', icon: '◇', label: 'Watch', href: '/watch' },
  { group: 'Go to', icon: '⊞', label: 'Explore', href: '/explore' },
  { group: 'Go to', icon: '◆', label: 'My client', href: '/account' },
  { group: 'Go to', icon: '▤', label: 'Learn', href: '/learn' },
  { group: 'Go to', icon: '◈', label: 'Prepare', href: '/prepare' },
  { group: 'Go to', icon: '▢', label: 'Library', href: '/library' },
  { group: 'Go to', icon: '◍', label: 'Coverage check', href: '/coverage' },
];

const CONFIDENCE: Item[] = [
  { group: 'Filter', icon: '⊟', label: 'Measured outcomes', detail: 'quantified + independent', href: '/explore?confidence=measured' },
  { group: 'Filter', icon: '⊟', label: 'Actually deployed', detail: 'not announcements', href: '/explore?confidence=deployed' },
  { group: 'Filter', icon: '⊟', label: 'Independently reported', detail: 'not self-reported', href: '/explore?confidence=corroborated' },
  { group: 'Filter', icon: '⊟', label: 'Announcements only', detail: 'see what is noise', href: '/explore?confidence=announced' },
  { group: 'Filter', icon: '⊟', label: 'Reversals', detail: 'stopped or rolled back', href: '/explore?confidence=reversed' },
];

/**
 * Palette contents are fetched, not passed in.
 *
 * They used to arrive as props, which serialised eighty-five companies and every taxonomy
 * row into the HTML of all 831 pages — 161 MB of output, most of it the same list over
 * and over. Fetching one shared JSON file on first open costs a few milliseconds nobody
 * notices and takes the build to a fraction of that.
 */
export function CommandPalette({
  entities: initialEntities = [],
  industries: initialIndustries = [],
  topics: initialTopics = [],
}: {
  entities?: PaletteEntity[];
  industries?: PaletteTaxonomy[];
  topics?: PaletteTaxonomy[];
}) {
  const [entities, setEntities] = useState<PaletteEntity[]>(initialEntities);
  const [industries, setIndustries] = useState<PaletteTaxonomy[]>(initialIndustries);
  const [topics, setTopics] = useState<PaletteTaxonomy[]>(initialTopics);
  const [loaded, setLoaded] = useState(initialEntities.length > 0);

  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    void fetch(assetPath('/palette.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEntities(data.entities ?? []);
        setIndustries(data.industries ?? []);
        setTopics(data.topics ?? []);
        setLoaded(true);
      })
      .catch(() => {
        // The palette still navigates: the fixed destinations do not depend on this.
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const hit = (text: string) => !q || text.toLowerCase().includes(q);
    const out: Item[] = [];

    out.push(...AREAS.filter((a) => hit(a.label)));

    for (const e of entities) {
      if (!hit(e.name) && !(e.aliases && hit(e.aliases))) continue;
      out.push({
        group: 'Companies',
        icon: '▣',
        label: e.name,
        detail: e.events > 0 ? `${e.events} events` : 'no coverage',
        href: e.events > 0 ? `/account?slug=${e.slug}` : `/coverage?q=${encodeURIComponent(e.name)}`,
      });
      if (out.filter((o) => o.group === 'Companies').length >= 8) break;
    }

    for (const i of industries.filter((i) => hit(i.name)).slice(0, 5)) {
      out.push({ group: 'Industries', icon: '◱', label: i.name, href: `/explore?industry=${i.slug}` });
    }
    for (const t of topics.filter((t) => hit(t.name)).slice(0, 6)) {
      out.push({ group: 'Topics', icon: '◇', label: t.name, href: `/explore?topic=${t.slug}` });
    }
    out.push(...CONFIDENCE.filter((c) => hit(c.label)));

    if (q) {
      out.push({
        group: 'Coverage',
        icon: '⌕',
        label: `Check coverage for “${query.trim()}”`,
        detail: 'what we have, and what we do not',
        href: `/coverage?q=${encodeURIComponent(query.trim())}`,
      });
      out.push({
        group: 'Ask',
        icon: '◧',
        label: `Ask: “${query.trim()}”`,
        detail: 'answers cite their evidence',
        href: `/companion?q=${encodeURIComponent(query.trim())}`,
      });
    }
    return out;
  }, [query, entities, industries, topics]);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      setOpen(false);
      setQuery('');
      router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
        (e.target as HTMLElement | null)?.tagName ?? '',
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (!typing && e.key === '/') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);
  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-5 pt-[11vh] backdrop-blur-[3px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="flex max-h-[74vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow-3)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <span aria-hidden className="text-[var(--text-subtle)]">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, items.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                go(items[cursor]);
              }
            }}
            placeholder="Jump to a company, filter the market, or check coverage…"
            className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-[var(--text-subtle)]"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-[12.5px] text-[var(--text-subtle)]">No matches.</p>
          ) : (
            items.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={`${item.href}-${i}`}>
                  {showGroup ? <div className="t-eyebrow px-2.5 pb-1 pt-2.5">{item.group}</div> : null}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] ${
                      i === cursor
                        ? 'bg-[var(--surface-inset)] text-[var(--text)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <span aria-hidden className="w-4 shrink-0 text-center text-[11px] opacity-70">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {item.detail ? (
                      <span className="ml-auto shrink-0 pl-3 text-[10.5px] text-[var(--text-subtle)]">
                        {item.detail}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3.5 border-t border-[var(--border)] px-3.5 py-2 text-[10px] text-[var(--text-subtle)]">
          <span>↑↓ move</span>
          <span>⏎ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
