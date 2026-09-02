# Patch — two small edits the staged pages depend on

Both are in files that already exist and work. Written as instructions rather than
full-file replacements so nothing already verified gets clobbered.

---

## 1. `packages/ui/src/index.tsx` — let `Card` forward extra props

The staged Explore page sets `data-evidence` and an inline `animationDelay` on cards, so
the left edge can be coloured by evidence strength and the list can stagger its
entrance. The current `Card` accepts only `children`, `className` and `as`.

**Replace:**

```tsx
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return <Tag className={`surface p-4 shadow-[var(--shadow-card)] ${className}`}>{children}</Tag>;
}
```

**With:**

```tsx
type CardTag = 'div' | 'article' | 'section' | 'li';

/**
 * Forwards arbitrary props so callers can set `data-evidence` (which colours the left
 * edge by evidence strength) and a staggered `animationDelay`, without this component
 * needing to know about either.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: CardTag;
} & Omit<React.ComponentPropsWithoutRef<CardTag>, 'children' | 'className'>) {
  return (
    <Tag className={`surface p-4 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
```

Note the removed `shadow-[var(--shadow-card)]` — the new `globals.css` puts the shadow
on `.surface` itself, and `--shadow-card` no longer exists. If any other component
references `--shadow-card`, change it to `--shadow-1`.

`ReactNode` is already imported; add `import type React from 'react';` if the
`ComponentPropsWithoutRef` reference needs it.

---

## 2. `apps/web/src/app/(app)/layout.tsx` — add Watch to the navigation

**Replace the `NAV` array:**

```ts
const NAV = [
  { href: '/', label: 'Today', hint: 'Your finite daily brief' },
  { href: '/watch', label: 'Watch', hint: 'What is unresolved, and what would settle it' },
  { href: '/companion', label: 'Companion', hint: 'Ask, research, prepare, be challenged' },
  { href: '/learn', label: 'Learn', hint: 'Industry fundamentals and learning paths' },
  { href: '/prepare', label: 'Prepare', hint: 'Meeting preparation' },
  { href: '/explore', label: 'Explore', hint: 'Companies, industries, technologies' },
  { href: '/library', label: 'Library', hint: 'Saved insights, notes, collections' },
];
```

Seven areas rather than six. Watch sits second because it is the natural follow-on from
the daily brief: what changed, then what is still unresolved.

---

## 3. Optional — reuse the design classes elsewhere

`globals.css` now provides `.t-display`, `.t-title`, `.t-heading`, `.t-lede`, `.t-body`,
`.t-meta`, `.t-eyebrow`, `.t-section`, `.card-lift`, `.hero-wash`, `.animate-rise`,
`.skeleton`, `.mix-bar` and `.label-counter`.

The existing pages use hard-coded sizes like `text-[17px] font-semibold leading-snug`.
They will still render correctly — the tokens are additive — but replacing them with the
classes is what makes the type scale consistent. Worth doing on Today and the insight
detail page at least, since those are the two surfaces people spend time on.

---

## Verification after applying

None of the staged app code has been typechecked or run — the repository was
inaccessible while it was written. Expect a first pass of type errors, most likely in:

- `packages/ui` `Card` prop spreading against the `as` union
- Drizzle column-type inference in `explore-queries.ts` (`ExploreRow` uses a cast)
- the raw-SQL `leftJoin` in `watch-queries.ts` for the `quiet` band
- `filterConditions` returning `SQL[]` where a caller expects `SQLWrapper`

Run in this order:

```bash
npm run typecheck      # fix what it finds
npm run test           # 94 existing tests must still pass
npm run dev            # or build && start — check /explore and /watch render
npm run test:e2e
```

The filter and Watch logic is proven — it ran against this database in the preview
harness with the counts recorded in HANDOVER.md. What is unproven is the TypeScript and
the Drizzle typing, which is a different and much smaller problem.
