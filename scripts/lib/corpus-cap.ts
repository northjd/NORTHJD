/**
 * The document cap, derived from what the site actually weighed — and carried forward.
 *
 * The derivation was already here; what was missing was memory. `db-retain` computed a
 * cap after the build, deleted down to it, and then the *next* run's pre-build prune
 * started again from `CORPUS_MAX_DOCUMENTS`, because nothing wrote the derived figure
 * anywhere that survived the job. So every run ground several hundred of the oldest
 * documents away and refilled the corpus to the configured ceiling before building.
 *
 * Measured on 2026-09-28: the corpus sat at exactly 2,200 documents — the ceiling to the
 * unit — the export weighed 748.9 MB against a 700 MB budget on every single run, and
 * the oldest document had moved forward from 2026-02-28 to 2026-05-22 in six days. Three
 * months of archive destroyed in a week by a correction that was being applied and then
 * immediately discarded.
 *
 * Writing the cap next to the corpus and reading it back closes the loop, and the loop
 * converges. With `F` the part of the export that does not depend on the corpus and `v`
 * the marginal cost of a document, the iteration
 *
 *     n' = headroom · target · n / (F + v · n)
 *
 * has a single fixed point at `n* = (headroom · target − F) / v` — the corpus whose
 * export weighs exactly `headroom · target`. It approaches from above without
 * overshooting, and it re-derives itself from measurement every run, so it falls when
 * fixed page weight grows and rises again when it shrinks. Nothing has to be re-estimated
 * by hand, which matters: hand-estimating this is what froze the site for two days.
 */

export interface CapInput {
  /** What the last build weighed, in MB, as the build itself measured it. */
  totalMb: number;
  /** The non-demo documents that produced it. */
  documents: number;
  /** What the next build should come in under, in MB. */
  targetMb: number;
  /** The configured ceiling. A derived cap never rises above it. */
  ceiling: number;
  /**
   * The fraction of the target to aim at. A tenth is held back because the relationship
   * is not quite linear, and because erring small costs a few days of history while
   * erring large costs the whole publication.
   */
  headroom?: number;
}

/**
 * The cap that fits, or `null` when the inputs cannot support a derivation.
 *
 * `null` rather than the ceiling, so the caller can tell "measured, and the ceiling is
 * right" apart from "nothing to measure" — the second is worth saying out loud, since a
 * missing measurement is how this silently stopped working.
 */
export function capForTarget(input: CapInput): number | null {
  const { totalMb, documents, targetMb, ceiling, headroom = 0.9 } = input;
  if (!Number.isFinite(totalMb) || totalMb <= 0) return null;
  if (!Number.isFinite(documents) || documents <= 0) return null;
  if (!Number.isFinite(targetMb) || targetMb <= 0) return null;

  const perDocument = totalMb / documents;
  const fits = Math.floor((targetMb / perDocument) * headroom);
  return Math.max(1, Math.min(ceiling, fits));
}

/** What gets written beside the corpus, so the next run can start from it. */
export interface RememberedCap {
  cap: number;
  /** Kept for the log line, so a surprising cap can be explained without a rerun. */
  totalMb: number;
  documents: number;
  at: string;
}

export function rememberedCap(value: unknown): RememberedCap | null {
  if (typeof value !== 'object' || value === null) return null;
  const { cap, totalMb, documents, at } = value as Record<string, unknown>;
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 1) return null;
  return {
    cap: Math.floor(cap),
    totalMb: typeof totalMb === 'number' ? totalMb : 0,
    documents: typeof documents === 'number' ? documents : 0,
    at: typeof at === 'string' ? at : '',
  };
}
