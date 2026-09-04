import { describe, expect, it } from 'vitest';
import { isWorthAnswering } from '../../apps/web/src/lib/prompt-builder';
import {
  CASE_MATURITY_ORDER,
  formatAbsolute,
  formatRelative,
  assertEvidenceIntegrity,
  containsQuantifiedOutcome,
  contentFingerprint,
  effectiveDate,
  estimateReadingMinutes,
  freshness,
  htmlToText,
  isFirstParty,
  isIndependent,
  jaccard,
  mayPresentAsFact,
  normalizeText,
  splitSentences,
  type CompanionResponse,
} from '@mios/domain';

describe('source perspective', () => {
  it('treats every first-party perspective as non-independent', () => {
    expect(isFirstParty('FIRST_PARTY_COMPANY')).toBe(true);
    expect(isFirstParty('FIRST_PARTY_CONSULTING_FIRM')).toBe(true);
    expect(isIndependent('FIRST_PARTY_COMPANY')).toBe(false);
  });

  it('does not treat user-provided or internal sources as independent', () => {
    // The bug this guards against: USER_PROVIDED counting as corroboration, which
    // promoted a self-reported figure to "independently validated".
    expect(isIndependent('USER_PROVIDED')).toBe(false);
    expect(isIndependent('AUTHORIZED_INTERNAL')).toBe(false);
    expect(isFirstParty('USER_PROVIDED')).toBe(false);
  });

  it('treats media, regulators and academia as independent', () => {
    expect(isIndependent('INDEPENDENT_BUSINESS_MEDIA')).toBe(true);
    expect(isIndependent('REGULATOR')).toBe(true);
    expect(isIndependent('ACADEMIC_SOURCE')).toBe(true);
  });
});

describe('sentence splitting', () => {
  it('keeps exact offsets so evidence spans stay valid', () => {
    const text = 'H&M announced a partnership. The rollout covers 40 stores.';
    const sentences = splitSentences(text);
    expect(sentences).toHaveLength(2);
    for (const sentence of sentences) {
      expect(text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it('does not split inside abbreviations or decimals', () => {
    expect(splitSentences('Revenue rose 3.5% at Acme Inc. this year.')).toHaveLength(1);
    expect(splitSentences('The U.S. market grew.')).toHaveLength(1);
  });

  it('handles a single sentence without a terminator', () => {
    expect(splitSentences('No full stop here')).toHaveLength(1);
  });
});

describe('quantified outcome detection', () => {
  it('recognises percentages, currency and multiples', () => {
    expect(containsQuantifiedOutcome('markdown fell 18%')).toBe(true);
    expect(containsQuantifiedOutcome('saved €4 million')).toBe(true);
    expect(containsQuantifiedOutcome('a 3x improvement')).toBe(true);
  });

  it('does not fire on vague improvement language', () => {
    expect(containsQuantifiedOutcome('significantly improved availability')).toBe(false);
  });
});

describe('text normalisation', () => {
  it('strips markup without leaving tags behind', () => {
    const out = htmlToText('<p>Hello <b>world</b></p><script>evil()</script>');
    expect(out).toContain('Hello world');
    expect(out).not.toContain('evil');
    expect(out).not.toContain('<');
  });

  it('is idempotent, so offsets computed once stay valid', () => {
    const once = normalizeText('a  b\r\n\r\n\r\nc');
    expect(normalizeText(once)).toBe(once);
  });
});

describe('fingerprinting and similarity', () => {
  it('gives identical content the same fingerprint', () => {
    expect(contentFingerprint('Title', 'Body text here')).toBe(
      contentFingerprint('Title', 'Body text here'),
    );
  });

  it('separates different content', () => {
    expect(contentFingerprint('A', 'one')).not.toBe(contentFingerprint('B', 'two'));
  });

  it('scores overlapping text above unrelated text', () => {
    const related = jaccard(
      'H&M announces AI allocation rollout',
      'H&M announces AI allocation platform',
    );
    const unrelated = jaccard('H&M announces AI allocation', 'NVIDIA reports quarterly revenue');
    expect(related).toBeGreaterThan(unrelated);
  });
});

describe('timestamps', () => {
  it('prefers the event date over the publication date for ordering', () => {
    const eventAt = new Date('2026-08-01T00:00:00Z');
    const publishedAt = new Date('2026-08-20T00:00:00Z');
    expect(effectiveDate({ eventAt, publishedAt })).toBe(eventAt);
    expect(effectiveDate({ eventAt: null, publishedAt })).toBe(publishedAt);
    expect(effectiveDate({ eventAt: null, publishedAt: null })).toBeNull();
  });

  it('reports unknown freshness rather than guessing', () => {
    expect(freshness(null)).toBe('unknown');
    expect(freshness(new Date())).toBe('fresh');
    expect(freshness(new Date(Date.now() - 40 * 86_400_000))).toBe('stale');
  });

  it('estimates at least one minute of reading', () => {
    expect(estimateReadingMinutes('short')).toBe(1);
  });
});

describe('case maturity ordering', () => {
  it('ranks a validated outcome above a bare announcement', () => {
    expect(CASE_MATURITY_ORDER.INDEPENDENTLY_VALIDATED_IMPACT).toBeGreaterThan(
      CASE_MATURITY_ORDER.ANNOUNCED,
    );
  });

  it('places a reversal outside the progression', () => {
    expect(CASE_MATURITY_ORDER.DISCONTINUED_OR_REVERSED).toBe(0);
  });
});

describe('evidence integrity gate', () => {
  const base: CompanionResponse = {
    mode: 'explore_it',
    depth: 'executive',
    length: 'standard',
    generator: 'deterministic_extractive',
    directAnswer: 'x',
    verifiedFacts: [],
    interpretations: [],
    hypotheses: [],
    counterEvidence: [],
    unknowns: [],
    coverageLimitations: [],
    suggestedFollowUps: [],
    learningConnections: [],
    conversationStarters: [],
    citations: [],
    asOf: new Date().toISOString(),
    coverageFrom: null,
    coverageTo: null,
    contextUsed: [],
    voice: { spokenSummary: '', estimatedSeconds: 0, segments: [] },
    insufficientEvidence: false,
  };

  const citation = {
    claimId: '00000000-0000-4000-8000-000000000001',
    evidenceSpanId: '00000000-0000-4000-8000-000000000002',
    documentTitle: 'Doc',
    sourceName: 'Source',
    sourceUrl: 'https://example.com/a',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA' as const,
    evidenceStrength: 'SINGLE_CREDIBLE_SECONDARY_SOURCE' as const,
    verificationStatus: 'SINGLE_SOURCE' as const,
    publishedAt: null,
    eventAt: null,
    quote: 'quoted text',
  };

  it('accepts a fact backed by a citation with a span', () => {
    expect(() =>
      assertEvidenceIntegrity({
        ...base,
        verifiedFacts: [{ text: 'A fact', citationIndexes: [0] }],
        citations: [citation],
      }),
    ).not.toThrow();
  });

  it('rejects a fact citing a claim with no evidence span', () => {
    expect(() =>
      assertEvidenceIntegrity({
        ...base,
        verifiedFacts: [{ text: 'A fact', citationIndexes: [0] }],
        citations: [{ ...citation, evidenceSpanId: null }],
      }),
    ).toThrow(/no evidence span/);
  });

  it('rejects a fact with no citation at all', () => {
    expect(() =>
      assertEvidenceIntegrity({
        ...base,
        verifiedFacts: [{ text: 'A fact', citationIndexes: [] }],
        citations: [],
      }),
    ).toThrow(/no citation/);
  });

  it('only lets an evidenced FACT be presented as a fact', () => {
    expect(mayPresentAsFact('FACT', 1)).toBe(true);
    expect(mayPresentAsFact('FACT', 0)).toBe(false);
    expect(mayPresentAsFact('INTERPRETATION', 5)).toBe(false);
    expect(mayPresentAsFact('FORECAST', 5)).toBe(false);
  });
});

/**
 * Regression: a date formatter must never take down the page.
 *
 * The Watch page 500ed with `RangeError: Invalid time value` because a raw SQL
 * projection returned `max(coalesce(...))` as a *string*, and `Intl.format` throws on
 * anything that is not a valid Date. One unparseable date should degrade to an honest
 * label, not remove the whole surface.
 */
describe('date formatting never throws', () => {
  const badInputs: unknown[] = [
    null,
    undefined,
    '',
    'not a date',
    NaN,
    new Date('nonsense'),
    {},
    [],
  ];

  it('returns the honest fallback instead of throwing', () => {
    for (const input of badInputs) {
      expect(() => formatAbsolute(input as Date | null)).not.toThrow();
      expect(formatAbsolute(input as Date | null)).toBe('date not stated in source');
      expect(() => formatRelative(input as Date | null)).not.toThrow();
      expect(formatRelative(input as Date | null)).toBe('undated');
    }
  });

  it('accepts the ISO strings that raw SQL projections return', () => {
    expect(formatAbsolute('2026-08-30T00:00:00.000Z')).toBe('30 August 2026');
    expect(formatAbsolute(new Date('2026-08-30T00:00:00.000Z'))).toBe('30 August 2026');
  });
});

/**
 * Regression: a body of partly-matching evidence is a subject; one such claim is a
 * coincidence.
 *
 * Coverage alone cannot tell them apart. "Which retailers have moved AI beyond pilots?"
 * scores 50% and returns twelve relevant claims. "What is happening with IQOS in
 * Paraguay?" also scores 50%, because one unrelated claim happens to mention Paraguay —
 * and handing that to a model invites a confident answer built on a coincidence.
 */
describe('isWorthAnswering', () => {
  it('accepts a well-covered question however small the set', () => {
    expect(isWorthAnswering(1, 1.0)).toBe(true);
    expect(isWorthAnswering(2, 0.75)).toBe(true);
  });

  it('accepts partial coverage when there is a body of material behind it', () => {
    // The retail/AI case: 50% coverage, twelve claims.
    expect(isWorthAnswering(12, 0.5)).toBe(true);
    expect(isWorthAnswering(3, 0.5)).toBe(true);
  });

  it('refuses partial coverage resting on one or two claims', () => {
    // The IQOS/Paraguay case: 50% coverage, one incidental match.
    expect(isWorthAnswering(1, 0.5)).toBe(false);
    expect(isWorthAnswering(2, 0.34)).toBe(false);
  });

  it('always refuses an empty set', () => {
    expect(isWorthAnswering(0, 1.0)).toBe(false);
    expect(isWorthAnswering(0, 0)).toBe(false);
  });
});
