'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('mios-theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing with storage disabled: the toggle still works for this page.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded px-2 py-1.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-inset)]"
    >
      {dark ? '☾' : '☀'}
    </button>
  );
}
