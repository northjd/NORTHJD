'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sidebar navigation item.
 *
 * The active state is a hairline marker plus full-contrast text rather than a filled
 * pill — same reasoning as the badges. `data-active` drives the marker from CSS so the
 * rule lives with the rest of the shell styling.
 */
export function NavLink({
  href,
  children,
  title,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
  icon?: string;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? 'page' : undefined}
      data-active={active}
      className={`nav-item mx-1.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
        active
          ? 'bg-[var(--surface-inset)] font-medium text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--text)]'
      }`}
    >
      {icon ? (
        <span aria-hidden className="w-[15px] shrink-0 text-center text-[12px] opacity-80">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </Link>
  );
}
