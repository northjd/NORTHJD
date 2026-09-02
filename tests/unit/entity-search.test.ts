import { describe, expect, it } from 'vitest';
import { matchPattern } from '../../apps/web/src/lib/entity-search';

/**
 * Regression: short queries must not match mid-word.
 *
 * The first implementation used `%term%` everywhere, which made "PMI" match "DeepMind"
 * — the substring really is there — so searching a client's short name returned Google.
 * An intermediate fix anchored both ends of the term, which then broke "amaz" → Amazon.
 * Anchoring only the start of the word satisfies both.
 */
describe('entity name matching', () => {
  /** Mirrors what PostgreSQL does with the generated operator and pattern. */
  const matches = (candidate: string, term: string): boolean => {
    const { operator, pattern } = matchPattern(term);
    if (operator === 'ilike') {
      return candidate.toLowerCase().includes(pattern.replace(/%/g, '').toLowerCase());
    }
    // `\y` is PostgreSQL's word boundary; `\b` is the JavaScript equivalent here.
    return new RegExp(pattern.replace(/\\y/g, '\\b'), 'i').test(candidate);
  };

  it('anchors short terms to the start of a word', () => {
    expect(matchPattern('PMI').anchored).toBe(true);
    expect(matchPattern('AWS').anchored).toBe(true);
    expect(matchPattern('amaz').anchored).toBe(true);
    expect(matchPattern('inditex').anchored).toBe(false);
  });

  it('no longer returns Google when the user searches PMI', () => {
    expect(matches('DeepMind', 'PMI')).toBe(false);
    expect(matches('Google', 'PMI')).toBe(false);
  });

  it('still finds companies by prefix and by alias', () => {
    expect(matches('Amazon', 'amaz')).toBe(true);
    expect(matches('Microsoft', 'Mi')).toBe(true);
    expect(matches('AWS', 'AWS')).toBe(true);
    expect(matches('Zara', 'Zara')).toBe(true);
  });

  it('matches longer terms anywhere in the name', () => {
    expect(matches('Philip Morris International', 'morris')).toBe(true);
    expect(matches('Inditex', 'inditex')).toBe(true);
  });

  it('escapes regex metacharacters rather than letting them be parsed', () => {
    // "H&M" and inputs like "a[b" must not produce an invalid regular expression.
    for (const term of ['H&M', 'a[b', 'x(y', 'p.q', 'a-b', '*']) {
      expect(() => matches('H&M Group', term)).not.toThrow();
    }
    expect(matches('H&M Group', 'H&M')).toBe(true);
  });
});
