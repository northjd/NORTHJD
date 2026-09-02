/**
 * The NORTH wordmark.
 *
 * A Scandinavian maker's-mark lockup: the name set in wide-tracked capitals with a small
 * monogram set beside it, baseline-aligned and roughly a third of the cap height. It
 * reads "NORTH" aloud and "NORTH JD" in writing — which is how monogram marks behave,
 * and what makes the mark distinctive enough to stand apart from the common noun.
 *
 * Deliberately typographic rather than illustrative. A glyph would date; letterforms with
 * correct spacing do not, and they survive being rendered at 11px in a sidebar.
 */

export function Wordmark({
  size = 'md',
  monogram = true,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  monogram?: boolean;
  className?: string;
}) {
  const scale = {
    sm: { name: 'text-[11px]', track: '0.24em', mark: 'text-[7px]', gap: 'gap-1.5' },
    md: { name: 'text-[15px]', track: '0.26em', mark: 'text-[8px]', gap: 'gap-2' },
    lg: { name: 'text-[34px]', track: '0.22em', mark: 'text-[12px]', gap: 'gap-3' },
    xl: { name: 'text-[68px] sm:text-[92px]', track: '0.18em', mark: 'text-[20px]', gap: 'gap-4' },
  }[size];

  return (
    <span className={`inline-flex items-baseline ${scale.gap} ${className}`}>
      <span
        className={`${scale.name} font-medium leading-none text-[var(--text)]`}
        style={{ letterSpacing: scale.track }}
      >
        NORTH
      </span>
      {monogram ? (
        <span
          aria-hidden
          className={`${scale.mark} font-semibold leading-none text-[var(--text-subtle)]`}
          style={{ letterSpacing: '0.14em' }}
        >
          JD
        </span>
      ) : null}
    </span>
  );
}

/**
 * The compass mark.
 *
 * A single north-pointing needle inside a hairline ring — the whole idea of the product
 * in one glyph: a fixed reference you orient by. Drawn with strokes rather than fills so
 * it stays crisp at 20px in the sidebar and at 120px on the landing page, and inherits
 * `currentColor` so it needs no dark-mode variant.
 */
export function CompassMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
      {/* The needle: filled north half, hollow south half. */}
      <path d="M20 5 L26 24 L20 20.5 Z" fill="currentColor" />
      <path d="M20 5 L14 24 L20 20.5 Z" fill="currentColor" fillOpacity="0.3" />
      <circle cx="20" cy="20.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
