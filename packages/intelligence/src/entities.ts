/**
 * Entity resolution.
 *
 * Alias-driven, with an explicit ambiguity guard. The failure this is built to avoid
 * is the one that quietly ruins a company timeline: "Meta" matching a sentence about
 * metadata, or "Next" matching an ordinary adverb, and the company page filling with
 * events that have nothing to do with the company.
 *
 * Ambiguous aliases therefore require corroboration — another alias of the same entity
 * nearby, or the entity's domain in the source — before they resolve.
 */

import { findOccurrences } from '@mios/domain';

export interface EntityCandidate {
  entityId: string;
  name: string;
  officialDomain: string;
  aliases: { normalized: string; requiresContext: boolean }[];
}

export interface EntityMention {
  entityId: string;
  /** subject when it appears in the title, otherwise mentioned. */
  role: 'subject' | 'mentioned';
  confidence: number;
  matchedAlias: string;
  occurrences: number;
}

/** Same normalisation as `entity_aliases.normalized`, so lookups agree. */
export function normalizeAlias(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,'’`"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolveOptions {
  title: string;
  body: string;
  /** Domain of the publishing source — resolves first-party mentions decisively. */
  sourceDomain?: string;
  /** The entity a first-party source speaks for, if known. */
  sourceSubjectEntityId?: string | null;
}

export function resolveEntities(
  candidates: EntityCandidate[],
  options: ResolveOptions,
): EntityMention[] {
  const titleNorm = normalizeAlias(options.title);
  const bodyNorm = normalizeAlias(options.body);
  const haystack = `${titleNorm} \n ${bodyNorm}`;
  const results = new Map<string, EntityMention>();

  for (const candidate of candidates) {
    let best: { alias: string; occurrences: number; inTitle: boolean; ambiguous: boolean } | null = null;
    let unambiguousHit = false;

    for (const alias of candidate.aliases) {
      if (alias.normalized.length < 2) continue;
      const inTitle = findOccurrences(titleNorm, alias.normalized).length > 0;
      const occurrences = findOccurrences(haystack, alias.normalized).length;
      if (occurrences === 0) continue;

      if (!alias.requiresContext) unambiguousHit = true;
      if (!best || occurrences > best.occurrences || (inTitle && !best.inTitle)) {
        best = { alias: alias.normalized, occurrences, inTitle, ambiguous: alias.requiresContext };
      }
    }

    if (!best) continue;

    // An ambiguous-only match needs corroboration before we accept it.
    const fromSourceDomain =
      Boolean(candidate.officialDomain) && options.sourceDomain === candidate.officialDomain;
    const isSourceSubject = options.sourceSubjectEntityId === candidate.entityId;

    if (best.ambiguous && !unambiguousHit && !fromSourceDomain && !isSourceSubject) {
      continue;
    }

    let confidence = 0.5;
    if (best.inTitle) confidence += 0.25;
    if (best.occurrences >= 3) confidence += 0.1;
    if (unambiguousHit) confidence += 0.1;
    if (fromSourceDomain || isSourceSubject) confidence = Math.max(confidence, 0.95);

    results.set(candidate.entityId, {
      entityId: candidate.entityId,
      role: best.inTitle || isSourceSubject ? 'subject' : 'mentioned',
      confidence: Math.min(0.99, confidence),
      matchedAlias: best.alias,
      occurrences: best.occurrences,
    });
  }

  // A first-party source is always about its own subject, even when the newsroom
  // article never spells the company name out in the body.
  if (options.sourceSubjectEntityId && !results.has(options.sourceSubjectEntityId)) {
    results.set(options.sourceSubjectEntityId, {
      entityId: options.sourceSubjectEntityId,
      role: 'subject',
      confidence: 0.9,
      matchedAlias: '(source subject)',
      occurrences: 1,
    });
  }

  return [...results.values()].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Aliases that should never match on their own because they are ordinary words or
 * substrings of common terms. Seeded into `entity_aliases.requires_context`.
 */
export const AMBIGUOUS_ALIAS_PATTERNS = [
  /^(next|gap|boss|apple|meta|shein|nike|target|amazon|orange|shell|square|stripe|arm|coach|guess|mango|zara)$/i,
  /^.{1,3}$/, // very short aliases: HM, C&A, EY, PwC without context
];

export function aliasNeedsContext(alias: string): boolean {
  return AMBIGUOUS_ALIAS_PATTERNS.some((p) => p.test(alias.trim()));
}
