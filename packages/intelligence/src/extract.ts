/**
 * Claim extraction — rule-based and extractive.
 *
 * A claim's text is a sentence copied verbatim from the stored document version, and
 * its evidence span is that sentence's exact character range. Nothing is paraphrased,
 * so the citation cannot drift from the source. When a language model is configured it
 * enriches classification, but it never replaces this: the sentence and its offsets
 * always come from the document.
 *
 * The classifier is a lexicon, not a model, and it is deliberately cautious — an
 * unrecognised sentence becomes UNVERIFIED_SIGNAL rather than FACT, because
 * over-claiming is the failure mode that matters here.
 */

import {
  type ClaimType,
  type EvidenceStrength,
  type SourcePerspective,
  containsQuantifiedOutcome,
  isFirstParty,
  splitSentences,
  type Sentence,
} from '@mios/domain';

export interface ExtractionInput {
  normalizedText: string;
  title: string;
  perspective: SourcePerspective;
  /** Regulatory filings and earnings releases are first-party but legally attested. */
  sourceType: string;
}

export interface ExtractedClaimRow {
  text: string;
  claimType: ClaimType;
  evidenceStrength: EvidenceStrength;
  confidence: number;
  quantified: boolean;
  startOffset: number;
  endOffset: number;
}

/** Past-tense reporting verbs: the strongest signal that a sentence states an event. */
const FACT_VERBS = [
  'announced',
  'launched',
  'introduced',
  'unveiled',
  'acquired',
  'purchased',
  'sold',
  'signed',
  'agreed',
  'completed',
  'closed',
  'opened',
  'appointed',
  'named',
  'hired',
  'reported',
  'posted',
  'published',
  'released',
  'filed',
  'partnered',
  'invested',
  'raised',
  'secured',
  'awarded',
  'selected',
  'deployed',
  'rolled out',
  'implemented',
  'expanded',
  'entered',
  'exited',
  'discontinued',
  'shut',
  'cut',
  'added',
  'began',
  'started',
  'joined',
  'confirmed',
  'stated',
  'said',
  'told',
  'disclosed',
  'approved',
];

const FORECAST_MARKERS = [
  'will ',
  'plans to',
  'aims to',
  'intends to',
  'expects to',
  'expects that',
  'targets',
  'is targeting',
  'forecast',
  'outlook',
  'guidance',
  'projected',
  'by 2027',
  'by 2028',
  'by 2029',
  'by 2030',
  'in the coming',
  'over the next',
  'is set to',
  'due to launch',
  'scheduled to',
];

const INTERPRETATION_MARKERS = [
  'could ',
  'may ',
  'might ',
  'suggests',
  'indicates',
  'appears to',
  'seems to',
  'believes',
  'is seen as',
  'analysts',
  'potentially',
  'likely to',
  'observers',
  'is expected to be',
  'arguably',
  'reportedly',
  'rumoured',
  'rumored',
];

/** Feed and page furniture that is not editorial content. */
const BOILERPLATE = [
  'cookie',
  'privacy policy',
  'terms of use',
  'all rights reserved',
  'read more',
  'subscribe',
  'newsletter',
  'follow us',
  'share this',
  'click here',
  'sign up',
  'javascript',
  'enable your browser',
  'advertisement',
  'related articles',
  'copyright ',
  'contact us',
  'log in',
  'accept all',
  // Feed-specific furniture. WordPress-style feeds append a syndication footer to
  // every item; extracting it produces claims like "The post X appeared first on Y",
  // which are true of the feed and say nothing about the world.
  'appeared first on',
  'the post ',
  'continue reading',
  'view the full',
  'this post was',
  'originally published',
  'image credit',
  'photo:',
];

const SUPERLATIVES = [
  'world-leading',
  'world leading',
  'best-in-class',
  'best in class',
  'revolutionary',
  'game-changing',
  'game changing',
  'unparalleled',
  'cutting-edge',
  'seamlessly',
  'industry-leading',
  'industry leading',
  'transformative',
  'unmatched',
  'first-ever',
];

const lower = (s: string) => s.toLowerCase();

function isBoilerplate(sentence: string): boolean {
  const s = lower(sentence);
  return BOILERPLATE.some((b) => s.includes(b));
}

/** Marketing language is a signal about the source, not about the world. */
export function marketingDensity(text: string): number {
  const s = lower(text);
  const hits = SUPERLATIVES.filter((w) => s.includes(w)).length;
  return Math.min(1, hits / 3);
}

function classifyClaimType(sentence: string): { type: ClaimType; confidence: number } {
  const s = lower(sentence);

  // Order matters: a sentence about the future is a forecast even if it uses a
  // reporting verb ("announced it will open 50 stores by 2030" is a forecast about
  // the stores, and the extractor should not present it as an accomplished fact).
  if (FORECAST_MARKERS.some((m) => s.includes(m))) return { type: 'FORECAST', confidence: 0.7 };
  if (INTERPRETATION_MARKERS.some((m) => s.includes(m)))
    return { type: 'INTERPRETATION', confidence: 0.65 };

  const verbHit = FACT_VERBS.find((v) => s.includes(` ${v}`) || s.startsWith(v));
  if (verbHit) {
    const hasAnchor = /\b(19|20)\d{2}\b/.test(s) || /\d/.test(s) || /[A-Z][a-z]+/.test(sentence);
    return { type: 'FACT', confidence: hasAnchor ? 0.8 : 0.6 };
  }

  // A sentence with a concrete figure and a named subject is usually factual.
  if (/\d/.test(s) && /[A-Z][a-zA-Z]{2,}/.test(sentence)) {
    return { type: 'FACT', confidence: 0.55 };
  }

  return { type: 'UNVERIFIED_SIGNAL', confidence: 0.4 };
}

/**
 * Evidence strength from source perspective and quantification.
 *
 * A company describing its own initiative is COMPANY_SELF_REPORTING however precise
 * the numbers are — precision is not independence. Regulatory filings and earnings
 * releases are treated as primary evidence because they carry legal accountability.
 * Corroboration across sources is applied later, at event level.
 */
export function deriveEvidenceStrength(
  perspective: SourcePerspective,
  sourceType: string,
  quantified: boolean,
): EvidenceStrength {
  const attested = [
    'regulatory_filing',
    'annual_report',
    'earnings_release',
    'earnings_transcript',
  ];

  if (
    perspective === 'REGULATOR' ||
    perspective === 'PUBLIC_INSTITUTION' ||
    attested.includes(sourceType)
  ) {
    return quantified ? 'QUANTIFIED_PRIMARY_EVIDENCE' : 'UNQUANTIFIED_PRIMARY_EVIDENCE';
  }
  if (isFirstParty(perspective)) return 'COMPANY_SELF_REPORTING';
  if (perspective === 'RESEARCH_INSTITUTION' || perspective === 'ACADEMIC_SOURCE') {
    return quantified ? 'QUANTIFIED_PRIMARY_EVIDENCE' : 'UNQUANTIFIED_PRIMARY_EVIDENCE';
  }
  if (perspective === 'INDEPENDENT_BUSINESS_MEDIA' || perspective === 'INDUSTRY_MEDIA') {
    return 'SINGLE_CREDIBLE_SECONDARY_SOURCE';
  }
  return 'WEAK_OR_UNVERIFIED_SIGNAL';
}

const MIN_WORDS = 6;
const MAX_CHARS = 600;

/**
 * Extracts candidate claims from a document version.
 *
 * Returns at most `limit` claims, preferring FACT over the rest and earlier sentences
 * over later ones — news writing puts the substance first, and a feed summary is
 * usually only a few sentences anyway.
 */
export function extractClaims(input: ExtractionInput, limit = 12): ExtractedClaimRow[] {
  const sentences: Sentence[] = splitSentences(input.normalizedText);
  const rows: ExtractedClaimRow[] = [];

  for (const [index, sentence] of sentences.entries()) {
    const words = sentence.text.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) continue;
    if (sentence.text.length > MAX_CHARS) continue;
    if (isBoilerplate(sentence.text)) continue;

    const { type, confidence } = classifyClaimType(sentence.text);
    const quantified = containsQuantifiedOutcome(sentence.text);

    // Position prior: the lead paragraph carries the news.
    const positionBonus = index < 3 ? 0.1 : index < 6 ? 0.05 : 0;
    // Marketing language reduces our confidence in the extraction, not in the source.
    const marketingPenalty = marketingDensity(sentence.text) * 0.15;

    rows.push({
      text: sentence.text,
      claimType: type,
      evidenceStrength: deriveEvidenceStrength(input.perspective, input.sourceType, quantified),
      confidence: Math.max(0.1, Math.min(0.95, confidence + positionBonus - marketingPenalty)),
      quantified,
      startOffset: sentence.start,
      endOffset: sentence.end,
    });
  }

  const priority: Record<ClaimType, number> = {
    FACT: 0,
    FORECAST: 1,
    INTERPRETATION: 2,
    UNVERIFIED_SIGNAL: 3,
    HYPOTHESIS: 4,
  };

  return rows
    .sort((a, b) => priority[a.claimType] - priority[b.claimType] || b.confidence - a.confidence)
    .slice(0, limit)
    .sort((a, b) => a.startOffset - b.startOffset);
}

/**
 * Rewrites first-party marketing into neutral reporting language.
 *
 * "Company X transformed its global operations with AI" becomes "Company X announced
 * …", with the original left intact in the evidence span so the reader can see both.
 * Applied to headlines only — never to claim text, which must stay verbatim.
 */
export function neutralizeMarketingHeadline(headline: string, isFirstPartySource: boolean): string {
  if (!isFirstPartySource) return headline;

  let out = headline;
  for (const word of SUPERLATIVES) {
    out = out.replace(new RegExp(`\\b${word}\\b\\s*`, 'gi'), '');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}
