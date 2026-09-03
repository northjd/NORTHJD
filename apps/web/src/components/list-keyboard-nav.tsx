'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keyboard navigation for a result list.
 *
 * `j` and `k` move a highlight, `Enter` opens it, `Escape` clears it. Reading a long
 * filtered list with a mouse means moving the pointer back to the left edge for every
 * item; this is the reason every tool that expects to be lived in has these two keys.
 *
 * Rows are found in the DOM by `[data-row-index]` rather than passed in as data, so this
 * works on any list that marks its rows up, and the pages stay server-rendered.
 */
export function ListKeyboardNav({ hrefAttribute = 'data-row-href' }: { hrefAttribute?: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    const rows = () => [...document.querySelectorAll<HTMLElement>('[data-row-index]')];

    const paint = (next: number) => {
      rows().forEach((row, i) => {
        row.dataset.active = String(i === next);
      });
      rows()[next]?.scrollIntoView({ block: 'nearest' });
    };

    const onKey = (event: KeyboardEvent) => {
      // Never steal a keystroke from a field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const all = rows();
      if (all.length === 0) return;

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((current) => {
          const next = Math.min(current + 1, all.length - 1);
          paint(next);
          return next;
        });
        return;
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => {
          const next = Math.max(current - 1, 0);
          paint(next);
          return next;
        });
        return;
      }
      if (event.key === 'Enter') {
        setIndex((current) => {
          const href = all[current]?.getAttribute(hrefAttribute);
          if (href) router.push(href);
          return current;
        });
        return;
      }
      if (event.key === 'Escape') {
        setIndex(() => {
          paint(-1);
          return -1;
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, hrefAttribute]);

  // `index` drives the DOM directly rather than a re-render, so nothing is drawn here.
  void index;
  return null;
}
