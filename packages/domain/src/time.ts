/**
 * Timestamp discipline.
 *
 * The product makes a hard distinction between *when something happened* and *when
 * somebody wrote about it* — acceptance criterion 2. Collapsing them is the single
 * easiest way to make a market intelligence tool subtly wrong, so the six timestamps
 * travel together in one type and are never merged.
 */

export interface DocumentTimestamps {
  /** When the real-world event occurred. Frequently unknown; null is honest. */
  eventAt: Date | null;
  /** When the source published its document. */
  publishedAt: Date | null;
  /** When the source last modified that document. */
  sourceUpdatedAt: Date | null;
  /** When we first saw it. */
  discoveredAt: Date;
  /** When the pipeline last processed it. */
  processedAt: Date | null;
  /** When a human or a corroboration run last confirmed the derived claims. */
  lastVerifiedAt: Date | null;
}

export const DAY_MS = 86_400_000;

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export function daysAgo(d: Date, now: Date = new Date()): number {
  return (now.getTime() - d.getTime()) / DAY_MS;
}

export function subtractDays(d: Date, days: number): Date {
  return new Date(d.getTime() - days * DAY_MS);
}

/**
 * The date to sort and display by. Prefers the real event date and falls back to
 * publication; callers must still show both, this only decides ordering.
 */
export function effectiveDate(t: Pick<DocumentTimestamps, 'eventAt' | 'publishedAt'>): Date | null {
  return t.eventAt ?? t.publishedAt ?? null;
}

/** Freshness buckets used by the coverage dashboard and the source health badge. */
export type FreshnessBucket = 'fresh' | 'recent' | 'ageing' | 'stale' | 'unknown';

export function freshness(lastSuccessAt: Date | null, now: Date = new Date()): FreshnessBucket {
  if (!lastSuccessAt) return 'unknown';
  const d = daysAgo(lastSuccessAt, now);
  if (d <= 1) return 'fresh';
  if (d <= 7) return 'recent';
  if (d <= 30) return 'ageing';
  return 'stale';
}

/** Fixed lookback windows offered in Prepare and on company timelines. */
export const LOOKBACK_WINDOWS = ['7d', '30d', '90d', '12m'] as const;
export type LookbackWindow = (typeof LOOKBACK_WINDOWS)[number];

export const LOOKBACK_DAYS: Record<LookbackWindow, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

export function windowStart(w: LookbackWindow, now: Date = new Date()): Date {
  return subtractDays(now, LOOKBACK_DAYS[w]);
}

/** ISO-8601 with offset, the only serialised form we put on the wire. */
export function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export function parseDateOrNull(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Human phrasing for dates in briefs and spoken answers. Deliberately conservative:
 * "on 28 August 2026" rather than "recently", because vagueness about dates is how
 * stale information passes for current.
 */
export function formatAbsolute(d: Date | string | number | null, locale = 'en-GB'): string {
  // Coerce rather than trust the caller. Raw SQL projections hand back timestamps as
  // strings, and `Intl.format` throws `RangeError: Invalid time value` on anything that
  // is not a valid Date — which takes down the entire page over one unparseable date.
  // An honest "date not stated in source" is the better failure.
  const date = parseDateOrNull(d);
  if (!date) return 'date not stated in source';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatRelative(d: Date | string | number | null, now: Date = new Date()): string {
  const parsed = parseDateOrNull(d);
  if (!parsed) return 'undated';
  const days = Math.floor(daysAgo(parsed, now));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 31) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}

/** Reading time at 220 wpm, floored at one minute. Used for the reading budget. */
export function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Speaking time at 150 wpm — slower than reading, which the voice session relies on. */
export function estimateSpeakingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}
