import { describe, expect, it } from 'vitest';
import {
  classifyCaseMaturity,
  queryTerms,
  stemForMatch,
  assessCoverage,
  classifyEventType,
  classifyValueLevers,
  deriveEvidenceStrength,
  describesSameEvent,
  detectContradiction,
  detectMaterialChange,
  extractClaims,
  matchTaxonomy,
  neutralizeMarketingHeadline,
  resolveEntities,
  scoreStrategicImpact,
  type ClusterableDocument,
} from '@mios/intelligence';

const doc = (over: Partial<ClusterableDocument>): ClusterableDocument => ({
  documentId: 'd',
  title: 't',
  summary: 's',
  publishedAt: new Date('2026-08-29T09:00:00Z'),
  eventAt: null,
  entityIds: [],
  fingerprint: 'f',
  sourceId: 's1',
  isFirstParty: false,
  isIndependent: true,
  ...over,
});

describe('claim extraction', () => {
  it('classifies a completed action as FACT and a commitment as FORECAST', () => {
    const claims = extractClaims({
      normalizedText:
        'The group announced that it will open fifty new stores by 2030. The company opened twelve stores in the first half of the year.',
      title: 'Expansion',
      perspective: 'FIRST_PARTY_COMPANY',
      sourceType: 'official_newsroom',
    });
    expect(claims.find((c) => c.text.includes('2030'))?.claimType).toBe('FORECAST');
    expect(claims.find((c) => c.text.includes('first half'))?.claimType).toBe('FACT');
  });

  it('marks hedged language as interpretation, not fact', () => {
    const claims = extractClaims({
      normalizedText:
        'Analysts suggest the initiative could improve availability across the estate.',
      title: 'Analysis',
      perspective: 'INDEPENDENT_BUSINESS_MEDIA',
      sourceType: 'independent_news',
    });
    expect(claims[0]?.claimType).toBe('INTERPRETATION');
  });

  it('produces offsets that select the claim text exactly', () => {
    const text =
      'H&M announced a partnership with a technology provider today. It covers twelve markets.';
    const claims = extractClaims({
      normalizedText: text,
      title: 'x',
      perspective: 'FIRST_PARTY_COMPANY',
      sourceType: 'official_newsroom',
    });
    for (const claim of claims) {
      expect(text.slice(claim.startOffset, claim.endOffset)).toBe(claim.text);
    }
  });

  it('skips feed syndication footers', () => {
    const claims = extractClaims({
      normalizedText:
        'The post Meet the winners appeared first on H&M Group. The programme selected five winners this year.',
      title: 'x',
      perspective: 'FIRST_PARTY_COMPANY',
      sourceType: 'official_newsroom',
    });
    expect(claims.some((c) => c.text.includes('appeared first on'))).toBe(false);
    expect(claims.some((c) => c.text.includes('selected five winners'))).toBe(true);
  });
});

describe('evidence strength', () => {
  it('keeps a precise first-party figure as self-reporting', () => {
    expect(deriveEvidenceStrength('FIRST_PARTY_COMPANY', 'official_newsroom', true)).toBe(
      'COMPANY_SELF_REPORTING',
    );
  });

  it('treats an attested filing as primary evidence', () => {
    expect(deriveEvidenceStrength('FIRST_PARTY_COMPANY', 'regulatory_filing', true)).toBe(
      'QUANTIFIED_PRIMARY_EVIDENCE',
    );
  });

  it('treats a regulator as primary evidence', () => {
    expect(deriveEvidenceStrength('REGULATOR', 'regulator', false)).toBe(
      'UNQUANTIFIED_PRIMARY_EVIDENCE',
    );
  });
});

describe('case maturity — the hype filter', () => {
  it('does not promote a self-reported outcome to validated', () => {
    expect(
      classifyCaseMaturity('The company reported an 18% reduction in markdown rate.', false)
        .maturity,
    ).toBe('QUANTIFIED_BUSINESS_IMPACT');
  });

  it('promotes it only with independent corroboration', () => {
    expect(
      classifyCaseMaturity('The company reported an 18% reduction in markdown rate.', true)
        .maturity,
    ).toBe('INDEPENDENTLY_VALIDATED_IMPACT');
  });

  it('reads the stated scope rather than the adjectives', () => {
    expect(
      classifyCaseMaturity(
        'A revolutionary, best-in-class partnership. An initial proof of concept will run in 40 stores.',
        false,
      ).maturity,
    ).toBe('PILOT');
  });

  it('detects a reversal', () => {
    expect(
      classifyCaseMaturity('The company has discontinued the programme.', false).maturity,
    ).toBe('DISCONTINUED_OR_REVERSED');
  });

  it('defaults to announced when no scope is stated', () => {
    expect(classifyCaseMaturity('The company announced a new initiative.', false).maturity).toBe(
      'ANNOUNCED',
    );
  });

  it('always explains itself', () => {
    expect(classifyCaseMaturity('A pilot is under way.', false).rationale.length).toBeGreaterThan(
      10,
    );
  });
});

describe('event type and levers', () => {
  it('reads the event type from the headline', () => {
    expect(classifyEventType('Acme to acquire Widget Co', '')).toBe('acquisition');
    expect(classifyEventType('Acme appoints new chief financial officer', '')).toBe(
      'leadership_change',
    );
    expect(classifyEventType('EU regulator issues new directive', '')).toBe('regulation');
  });

  it('maps inventory language to inventory productivity', () => {
    expect(classifyValueLevers('improving inventory and availability across stores')).toContain(
      'inventory_reduction',
    );
  });
});

describe('strategic impact', () => {
  it('ranks a validated outcome above an announcement', () => {
    const announced = scoreStrategicImpact({
      eventType: 'partnership',
      maturity: 'ANNOUNCED',
      quantified: false,
      entityCount: 1,
      independentSourceCount: 0,
    });
    const validated = scoreStrategicImpact({
      eventType: 'partnership',
      maturity: 'INDEPENDENTLY_VALIDATED_IMPACT',
      quantified: true,
      entityCount: 2,
      independentSourceCount: 2,
    });
    const order = { low: 0, moderate: 1, high: 2, very_high: 3 };
    expect(order[validated]).toBeGreaterThan(order[announced]);
  });
});

describe('entity resolution', () => {
  const meta = [
    {
      entityId: 'meta',
      name: 'Meta',
      officialDomain: 'about.fb.com',
      aliases: [
        { normalized: 'meta', requiresContext: true },
        { normalized: 'meta platforms', requiresContext: false },
      ],
    },
  ];

  it('refuses an ambiguous alias on its own', () => {
    expect(
      resolveEntities(meta, { title: 'Improving meta descriptions', body: 'the meta tag' }),
    ).toHaveLength(0);
  });

  it('accepts it when an unambiguous alias co-occurs', () => {
    const found = resolveEntities(meta, {
      title: 'Meta Platforms ships a model',
      body: 'Meta said so.',
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.role).toBe('subject');
  });

  it('always resolves the subject of a first-party source', () => {
    const found = resolveEntities(meta, {
      title: 'An update',
      body: 'No company name here.',
      sourceSubjectEntityId: 'meta',
    });
    expect(found[0]?.entityId).toBe('meta');
  });
});

describe('event clustering', () => {
  it('merges two reports of one deal', () => {
    const a = doc({
      documentId: 'a',
      entityIds: ['x', 'y'],
      fingerprint: 'a',
      title: 'Meridian and Halden AI announce partnership on demand forecasting',
      summary:
        'Meridian and Halden announced a partnership on demand forecasting with a proof of concept in 40 stores.',
    });
    const b = doc({
      documentId: 'b',
      entityIds: ['x', 'y'],
      fingerprint: 'b',
      sourceId: 's2',
      title: 'Halden AI signs Meridian as anchor customer',
      summary:
        'Halden signed Meridian as anchor customer for demand forecasting, starting with a proof of concept in 40 stores.',
    });
    expect(describesSameEvent(a, b)).toBe(true);
  });

  it('keeps different companies apart despite identical wording', () => {
    const a = doc({
      documentId: 'a',
      entityIds: ['x'],
      fingerprint: 'a',
      title: 'A announces partnership',
    });
    const b = doc({
      documentId: 'b',
      entityIds: ['y'],
      fingerprint: 'b',
      title: 'B announces partnership',
    });
    expect(describesSameEvent(a, b)).toBe(false);
  });

  it('keeps the same story apart when months separate the reports', () => {
    const a = doc({
      documentId: 'a',
      entityIds: ['x'],
      fingerprint: 'a',
      title: 'X announces platform rollout',
    });
    const b = doc({
      documentId: 'b',
      entityIds: ['x'],
      fingerprint: 'b',
      title: 'X announces platform rollout',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    });
    expect(describesSameEvent(a, b)).toBe(false);
  });
});

describe('corrections and contradictions', () => {
  it('ignores whitespace churn', () => {
    expect(detectMaterialChange('the same text here', 'the  same   text here').changed).toBe(false);
  });

  it('flags a rewrite as a likely correction', () => {
    const result = detectMaterialChange(
      'Revenue rose 12 percent in the quarter across all regions.',
      'Correction: revenue rose 2 percent in the quarter, not 12 percent, across all regions.',
    );
    expect(result.changed).toBe(true);
    expect(result.likelyCorrection).toBe(true);
  });

  it('surfaces conflicting figures instead of merging them', () => {
    const conflict = detectContradiction(
      'The company reported an 18% reduction in markdown rate.',
      'Analysts estimate the reduction at closer to 7% once normalised.',
    );
    expect(conflict?.kind).toBe('numeric_mismatch');
  });

  it('does not invent a conflict between unrelated statements', () => {
    expect(
      detectContradiction('H&M opened a store in Berlin.', 'NVIDIA released a new GPU.'),
    ).toBeNull();
  });
});

describe('taxonomy matching', () => {
  it('matches whole words only', () => {
    const terms = [
      { kind: 'topic' as const, slug: 'artificial-intelligence', name: 'AI', aliases: [] },
    ];
    expect(matchTaxonomy('the company said it would', terms)).toHaveLength(0);
    expect(matchTaxonomy('the AI platform', terms)).toHaveLength(1);
  });
});

describe('marketing neutralisation', () => {
  it('strips unsupported superlatives from first-party headlines', () => {
    expect(
      neutralizeMarketingHeadline('Revolutionary best-in-class AI platform launched', true),
    ).toBe('AI platform launched');
  });

  it('leaves independent reporting untouched', () => {
    const headline = 'Revolutionary platform launched, company says';
    expect(neutralizeMarketingHeadline(headline, false)).toBe(headline);
  });
});

/**
 * Regression: the retrieval query must keep content words and drop filler.
 *
 * "What is happening with AI in retail?" was refused because *happening* appears in no
 * source — true, and completely beside the point — while "AI", the single most frequent
 * meaningful term in the corpus, was dropped entirely by a length > 2 filter.
 */
describe('question term extraction', () => {
  it('keeps two-letter acronyms that carry meaning', () => {
    expect(queryTerms('What is happening with AI in retail?')).toEqual(['AI', 'retail']);
    expect(queryTerms('How is the EU regulating AI?')).toContain('EU');
    expect(queryTerms('What is the ROI on this?')).toContain('ROI');
  });

  it('drops filler verbs and nouns of enquiry', () => {
    for (const filler of ['happening', 'latest', 'news', 'update', 'current', 'recently']) {
      expect(queryTerms(`What is the ${filler} on markdown rates?`)).not.toContain(filler);
    }
  });

  it('drops words addressed to the assistant rather than to the corpus', () => {
    const terms = queryTerms('Challenge the claim that markdown rates are improving');
    expect(terms).not.toContain('Challenge');
    expect(terms).not.toContain('claim');
    expect(terms.map((t) => t.toLowerCase())).toContain('markdown');
  });

  it('never emits tsquery operator keywords', () => {
    const terms = queryTerms('pricing and promotions or markdown not discounts');
    for (const op of ['and', 'or', 'not']) {
      expect(terms.map((t) => t.toLowerCase())).not.toContain(op);
    }
  });

  it('keeps the substantive words of a real question', () => {
    expect(queryTerms('What is happening with markdown rates at Inditex?')).toEqual([
      'markdown',
      'rates',
      'Inditex',
    ]);
  });
});

/**
 * Regression: coverage matching must survive ordinary English morphology.
 *
 * "Which companies are scaling AI beyond pilots?" was refused although the corpus was
 * full of relevant claims, because the stemmer sliced characters off the end rather than
 * stripping suffixes: "scaling" became "scali" and matched neither "scale" nor "scaled".
 */
describe('stemForMatch', () => {
  it('reduces inflections to a shared stem', () => {
    expect(stemForMatch('scaling')).toBe('scal');
    expect(stemForMatch('scaled')).toBe('scal');
    // 'es' strips before 's', so this lands on the same stem as scaling/scaled.
    expect(stemForMatch('scales')).toBe('scal');
    expect(stemForMatch('companies')).toBe('compan');
    expect(stemForMatch('pilots')).toBe('pilot');
    expect(stemForMatch('matches')).toBe('match');
  });

  it('leaves short words and non-inflected words alone', () => {
    expect(stemForMatch('AI')).toBe('ai');
    expect(stemForMatch('retail')).toBe('retail');
    // Stripping would leave less than four characters, so it does not.
    expect(stemForMatch('bus')).toBe('bus');
  });

  it('matches a question term against the wording sources actually use', () => {
    const corpus =
      'The retailer scaled the deployment across every company store, past the pilot phase.';
    for (const term of ['scaling', 'companies', 'pilots']) {
      expect(corpus.toLowerCase().includes(stemForMatch(term))).toBe(true);
    }
  });
});

describe('assessCoverage', () => {
  const corpus = [
    'Inditex scaled its AI allocation deployment across every company in the group.',
    'The pilot moved into production after a measured reduction in markdown rate.',
  ];

  it('accepts a question the sources genuinely cover', () => {
    const terms = queryTerms('Which companies are scaling AI beyond pilots?');
    expect(assessCoverage(terms, corpus).sufficient).toBe(true);
  });

  it('still refuses a question the sources do not cover', () => {
    const terms = queryTerms('What is the population of Ulaanbaatar?');
    const result = assessCoverage(terms, corpus);
    expect(result.sufficient).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
