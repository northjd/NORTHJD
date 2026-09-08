import { assetPath } from '@/lib/asset-path';
import { queryTerms, assessCoverage, termMatchesStems, textStems } from '@mios/domain';
import { buildPrompt, isWorthAnswering, type BuiltPrompt } from '@/lib/prompt-builder';
import type { RetrievedClaim } from '@mios/intelligence';

/**
 * Retrieval in the browser, over the corpus shipped with the static build.
 *
 * The server does this in PostgreSQL with a full-text index. There is no server here, so
 * the same job is done over `evidence.json` — and at 471 claims that is genuinely faster
 * than a round trip would be, not a compromise.
 *
 * The scoring is deliberately the poorer relative of `ts_rank`: term overlap, weighted so
 * that a rarer word counts for more than a common one. What it must not differ on is
 * *which words matter* and *whether the set covers the question* — those come from
 * `@mios/domain`, shared with the server, because two answers to "is this answerable"
 * would be a way to mislead people quietly.
 */

export interface BrowserClaim {
  id: string;
  text: string;
  claimType: string;
  evidenceStrength: string;
  quantified: boolean;
  sourceName: string;
  perspective: string;
  documentTitle: string;
  documentUrl: string;
  publishedAt: string | null;
}

let cache: BrowserClaim[] | null = null;
let stemCache: { for: BrowserClaim[]; stems: Set<string>[] } | null = null;

/** Stems per claim, computed once for the corpus and reused across questions. */
function stemsOf(claims: BrowserClaim[]): Set<string>[] {
  if (stemCache && stemCache.for === claims) return stemCache.stems;
  const stems = claims.map((c) => textStems(c.text));
  stemCache = { for: claims, stems };
  return stems;
}

export async function loadEvidence(): Promise<BrowserClaim[]> {
  if (cache) return cache;
  const res = await fetch(assetPath('/evidence.json'));
  if (!res.ok) throw new Error('Could not load the evidence corpus.');
  const data = (await res.json()) as { claims: BrowserClaim[] };
  cache = data.claims ?? [];
  return cache;
}

/** How informative a term is here: a word in every claim tells you nothing. */
function inverseFrequency(term: string, stemmed: Set<string>[]): number {
  const hits = stemmed.reduce((n, stems) => (termMatchesStems(term, stems) ? n + 1 : n), 0);
  if (hits === 0) return 0;
  return Math.log(stemmed.length / hits) + 1;
}

export interface BrowserRetrieval {
  claims: BrowserClaim[];
  coverage: { ratio: number; missing: string[]; sufficient: boolean };
  prompt: BuiltPrompt;
}

export async function retrieveInBrowser(
  question: string,
  mode: Parameters<typeof buildPrompt>[2] = 'explore',
  limit = 12,
): Promise<BrowserRetrieval> {
  const all = await loadEvidence();
  const terms = queryTerms(question);

  /*
   * Stem each claim once, not once per term.
   *
   * Scoring used to run `haystack.includes(stem)` for every term against every claim,
   * which is both slower and wrong: *Peru* matched "peruse" and *Mount* matched
   * "amount". Words are compared with words now, and the stem sets are built here so
   * the inverse-frequency pass and the scoring pass share them.
   */
  const stemmed = stemsOf(all);
  const weights = new Map(terms.map((t) => [t, inverseFrequency(t, stemmed)]));

  const scored = all
    .map((claim, i) => {
      let score = 0;
      for (const term of terms) {
        if (termMatchesStems(term, stemmed[i]!)) score += weights.get(term) ?? 1;
      }
      // A fact you can weigh beats a forecast you cannot, all else equal.
      if (claim.claimType === 'FACT') score *= 1.15;
      return { claim, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.claim);

  const coverage = assessCoverage(
    terms,
    scored.map((c) => c.text),
  );

  // buildPrompt is shared with the server, so the prompt a colleague copies is identical
  // whichever build they are looking at.
  const asRetrieved = scored.map((c) => ({
    claimId: c.id,
    text: c.text,
    claimType: c.claimType,
    quantified: c.quantified,
    evidenceStrength: c.evidenceStrength,
    verificationStatus: 'SINGLE_SOURCE',
    spanId: c.id,
    quote: null,
    documentTitle: c.documentTitle,
    documentUrl: c.documentUrl,
    sourceName: c.sourceName,
    perspective: c.perspective,
    publishedAt: c.publishedAt ? new Date(c.publishedAt) : null,
    eventAt: null,
    eventId: null,
    rank: 0,
  })) as unknown as RetrievedClaim[];

  const worthAnswering = isWorthAnswering(scored.length, coverage.ratio);
  const prompt = worthAnswering
    ? buildPrompt(question, asRetrieved, mode)
    : { question, evidence: [], text: '', empty: true };

  return {
    claims: worthAnswering ? scored : [],
    coverage: {
      ratio: coverage.ratio,
      missing: coverage.missing,
      sufficient: coverage.sufficient,
    },
    prompt,
  };
}
