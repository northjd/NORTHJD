/**
 * Evaluation suite.
 *
 * These are invariants, not benchmarks. Each case asserts a property the product
 * claims to hold — evidence integrity, ranking neutrality, correct maturity
 * classification, honest refusal — and checks it against the live database and the
 * live code paths.
 *
 * A failure here means a claim the product makes about itself is currently untrue.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { classifyCaseMaturity, describesSameEvent, resolveEntities, extractClaims } from '@mios/intelligence';
import { scoreIsEntityNeutral, scoreItem, type RankableItem, type UserRankingContext } from '@mios/ranking';
import { evaluateRights } from '@mios/connectors';

export interface EvaluationCase {
  slug: string;
  suite: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface EvaluationRun {
  total: number;
  passed: number;
  cases: EvaluationCase[];
  ranAt: string;
}

type Check = () => Promise<{ passed: boolean; detail: string }>;

const CASES: { slug: string; suite: string; name: string; run: Check }[] = [
  // ── Evidence integrity ─────────────────────────────────────────────────────
  {
    slug: 'every-fact-has-evidence',
    suite: 'evidence_integrity',
    name: 'Every FACT claim has at least one evidence span',
    async run() {
      const [row] = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.claims)
        .where(
          and(
            eq(schema.claims.claimType, 'FACT'),
            sql`not exists (select 1 from claim_evidence ce where ce.claim_id = ${schema.claims.id})`,
          ),
        );
      const n = row?.n ?? 0;
      return {
        passed: n === 0,
        detail: n === 0 ? 'No unevidenced FACT claims.' : `${n} FACT claims have no evidence span.`,
      };
    },
  },
  {
    slug: 'evidence-quotes-match-source',
    suite: 'evidence_integrity',
    name: 'Evidence quotes match the stored document text at their offsets',
    async run() {
      const rows = await db()
        .select({
          quote: schema.evidenceSpans.quote,
          start: schema.evidenceSpans.startOffset,
          end: schema.evidenceSpans.endOffset,
          text: schema.documentVersions.normalizedText,
        })
        .from(schema.evidenceSpans)
        .innerJoin(
          schema.documentVersions,
          eq(schema.documentVersions.id, schema.evidenceSpans.documentVersionId),
        )
        .limit(300);

      const mismatched = rows.filter((r) => r.text.slice(r.start, r.end) !== r.quote);
      return {
        passed: mismatched.length === 0,
        detail:
          mismatched.length === 0
            ? `${rows.length} spans checked; every quote matches its offsets exactly.`
            : `${mismatched.length} of ${rows.length} spans do not match the text at their offsets.`,
      };
    },
  },
  {
    slug: 'insights-trace-to-claims',
    suite: 'evidence_integrity',
    name: 'Every insight traces back to at least one evidenced claim',
    async run() {
      const [row] = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.insights)
        .where(
          sql`not exists (
            select 1 from event_claims ec
            join claim_evidence ce on ce.claim_id = ec.claim_id
            where ec.event_id = ${schema.insights.eventId}
          )`,
        );
      const n = row?.n ?? 0;
      return {
        passed: n === 0,
        detail: n === 0 ? 'All insights are traceable to evidence.' : `${n} insights have no evidenced claim.`,
      };
    },
  },

  // ── Ranking neutrality ─────────────────────────────────────────────────────
  {
    slug: 'no-consulting-ranking-advantage',
    suite: 'ranking_neutrality',
    name: 'Identical items score identically regardless of which company they involve',
    async run() {
      const item: RankableItem = {
        insightId: '00000000-0000-4000-8000-000000000001',
        eventId: '00000000-0000-4000-8000-000000000002',
        headline: 'A partnership was announced',
        eventAt: new Date(),
        firstReportedAt: new Date(),
        strategicImpact: 'high',
        evidenceStrength: 'SINGLE_CREDIBLE_SECONDARY_SOURCE',
        caseMaturity: 'ANNOUNCED',
        novelty: 'new_to_world',
        sourceCount: 2,
        independentSourceCount: 1,
        firstPartyOnly: false,
        estimatedMinutes: 2,
        isDemo: false,
        industrySlugs: ['retail'],
        topicSlugs: ['artificial-intelligence'],
        technologySlugs: [],
        entityIds: ['accenture-id'],
        conceptSlugs: [],
        knowledgeGapConceptSlugs: [],
        alreadyShown: false,
        storyRepetitions: 0,
      };
      const ctx: UserRankingContext = {
        industrySlugs: ['retail'],
        topicSlugs: ['artificial-intelligence'],
        technologySlugs: [],
        watchedEntityIds: [],
        accountEntityIds: [],
        mission: null,
        lastVisitAt: null,
        readingBudgetMinutes: 12,
      };
      const neutral = scoreIsEntityNeutral(item, ctx, 'hm-group-id');
      const a = scoreItem(item, ctx).score;
      const b = scoreItem({ ...item, entityIds: ['hm-group-id'] }, ctx).score;
      return {
        passed: neutral && Math.abs(a - b) < 1e-9,
        detail: neutral
          ? `Consulting-firm item scores ${a.toFixed(3)}; identical retailer item scores ${b.toFixed(3)}.`
          : 'Scores differ when only the entity changes — an entity-specific ranking term has been introduced.',
      };
    },
  },
  {
    slug: 'no-reserved-brief-quota',
    suite: 'ranking_neutrality',
    name: 'No brief section is reserved for a company group',
    async run() {
      const rows = await db()
        .select({ section: schema.briefItems.section, n: sql<number>`count(*)::int` })
        .from(schema.briefItems)
        .groupBy(schema.briefItems.section);
      const reserved = rows.filter((r) =>
        ['accenture', 'consulting', 'competitor'].some((word) => r.section.includes(word)),
      );
      return {
        passed: reserved.length === 0,
        detail:
          reserved.length === 0
            ? `${rows.length} brief sections in use; none is company- or firm-specific.`
            : `Reserved sections found: ${reserved.map((r) => r.section).join(', ')}.`,
      };
    },
  },

  // ── Hype filter ────────────────────────────────────────────────────────────
  {
    slug: 'self-report-not-validated',
    suite: 'hype_filter',
    name: 'A self-reported quantified outcome is not classified as independently validated',
    async run() {
      const text =
        'The company reported an 18% reduction in markdown rate across its European store estate compared with the prior year.';
      const withoutIndependent = classifyCaseMaturity(text, false);
      const withIndependent = classifyCaseMaturity(text, true);
      const passed =
        withoutIndependent.maturity === 'QUANTIFIED_BUSINESS_IMPACT' &&
        withIndependent.maturity === 'INDEPENDENTLY_VALIDATED_IMPACT';
      return {
        passed,
        detail: passed
          ? 'Without an independent source the same text classifies as QUANTIFIED_BUSINESS_IMPACT, not validated.'
          : `Got ${withoutIndependent.maturity} without corroboration and ${withIndependent.maturity} with it.`,
      };
    },
  },
  {
    slug: 'marketing-language-is-not-scale',
    suite: 'hype_filter',
    name: 'Marketing language does not promote a pilot to scaled deployment',
    async run() {
      const text =
        'The partnership represents a revolutionary step for the industry and will deliver best-in-class availability. An initial proof of concept will run in 40 stores.';
      const result = classifyCaseMaturity(text, false);
      return {
        passed: result.maturity === 'PILOT',
        detail:
          result.maturity === 'PILOT'
            ? 'Classified as PILOT from the stated scope, not from the adjectives.'
            : `Classified as ${result.maturity}; superlatives appear to be influencing maturity.`,
      };
    },
  },
  {
    slug: 'reversal-detected',
    suite: 'hype_filter',
    name: 'A discontinued programme is classified as reversed',
    async run() {
      const result = classifyCaseMaturity(
        'Calder Stores has discontinued its automated replenishment programme after an eighteen-month deployment.',
        false,
      );
      return {
        passed: result.maturity === 'DISCONTINUED_OR_REVERSED',
        detail: `Classified as ${result.maturity}.`,
      };
    },
  },

  // ── Entity resolution ──────────────────────────────────────────────────────
  {
    slug: 'ambiguous-alias-needs-context',
    suite: 'entity_resolution',
    name: 'An ambiguous alias does not resolve on its own',
    async run() {
      const candidates = [
        {
          entityId: 'meta-id',
          name: 'Meta',
          officialDomain: 'about.fb.com',
          aliases: [
            { normalized: 'meta', requiresContext: true },
            { normalized: 'meta platforms', requiresContext: false },
          ],
        },
      ];
      const falsePositive = resolveEntities(candidates, {
        title: 'Improving meta descriptions for search',
        body: 'The meta tag guidance was updated.',
      });
      const truePositive = resolveEntities(candidates, {
        title: 'Meta Platforms announces a new model',
        body: 'Meta said the release is available today.',
      });
      const passed = falsePositive.length === 0 && truePositive.length === 1;
      return {
        passed,
        detail: passed
          ? 'The bare alias "meta" did not resolve; "Meta Platforms" did.'
          : `Ambiguity guard failed: ${falsePositive.length} false positives, ${truePositive.length} true positives.`,
      };
    },
  },

  // ── Deduplication ──────────────────────────────────────────────────────────
  {
    slug: 'same-event-two-sources-clusters',
    suite: 'deduplication',
    name: 'Two reports of one deal cluster into a single event',
    async run() {
      const base = {
        publishedAt: new Date('2026-08-29T09:00:00Z'),
        eventAt: null,
        entityIds: ['meridian', 'halden'],
        isFirstParty: false,
        isIndependent: true,
      };
      const a = {
        ...base,
        documentId: 'a',
        title: 'Meridian Retail Group and Halden AI announce strategic partnership on demand forecasting',
        summary: 'Meridian Retail Group and Halden AI today announced a strategic partnership on demand forecasting. A proof of concept will run in 40 stores.',
        fingerprint: 'aaa',
        sourceId: 's1',
      };
      const b = {
        ...base,
        documentId: 'b',
        title: 'Halden AI signs Meridian as anchor European retail customer',
        summary: 'Halden AI has signed Meridian Retail Group as its anchor European retail customer, covering demand forecasting with a proof of concept in around 40 stores.',
        fingerprint: 'bbb',
        sourceId: 's2',
      };
      const clustered = describesSameEvent(a, b);
      return {
        passed: clustered,
        detail: clustered
          ? 'Different wording, same two organisations, same day — treated as one event.'
          : 'Two reports of one deal were left as separate events.',
      };
    },
  },
  {
    slug: 'different-companies-do-not-cluster',
    suite: 'deduplication',
    name: 'Identically-worded releases from different companies stay separate',
    async run() {
      const base = {
        publishedAt: new Date('2026-08-29T09:00:00Z'),
        eventAt: null,
        isFirstParty: true,
        isIndependent: false,
        summary: 'The company announced a strategic partnership to transform demand forecasting.',
      };
      const a = { ...base, documentId: 'a', title: 'Company A announces partnership', entityIds: ['a'], fingerprint: 'x', sourceId: 's1' };
      const b = { ...base, documentId: 'b', title: 'Company B announces partnership', entityIds: ['b'], fingerprint: 'y', sourceId: 's2' };
      const clustered = describesSameEvent(a, b);
      return {
        passed: !clustered,
        detail: clustered
          ? 'Two different companies were merged into one event — clustering is over-eager.'
          : 'No shared entity, so no merge despite near-identical wording.',
      };
    },
  },

  // ── Source rights ──────────────────────────────────────────────────────────
  {
    slug: 'unreviewed-source-blocked',
    suite: 'source_rights',
    name: 'A source without a completed rights review is not fetched',
    async run() {
      const pending = evaluateRights({
        rightsStatus: 'pending_review',
        allowedToIngest: false,
        allowedToStoreMetadata: true,
        allowedToStoreExcerpts: false,
        allowedToStoreFullText: false,
        allowedForAiProcessing: false,
        storageScope: 'metadata',
        requiredAttribution: '',
        rateLimitPerHour: 10,
      });
      const missing = evaluateRights(null);
      const passed = !pending.allowed && !missing.allowed;
      return {
        passed,
        detail: passed
          ? 'Both an unreviewed source and one with no policy at all are refused.'
          : `pending allowed=${pending.allowed}, missing allowed=${missing.allowed}.`,
      };
    },
  },
  {
    slug: 'candidates-are-not-active',
    suite: 'source_rights',
    name: 'No source with a pending review has an active connector',
    async run() {
      const rows = await db()
        .select({ slug: schema.sources.slug })
        .from(schema.sourceConnectors)
        .innerJoin(schema.sources, eq(schema.sources.id, schema.sourceConnectors.sourceId))
        .innerJoin(schema.sourcePolicies, eq(schema.sourcePolicies.sourceId, schema.sources.id))
        .where(
          and(
            eq(schema.sourceConnectors.isActive, true),
            sql`${schema.sourcePolicies.rightsStatus} <> 'approved'`,
          ),
        );
      return {
        passed: rows.length === 0,
        detail:
          rows.length === 0
            ? 'Every active connector belongs to an approved source.'
            : `Active connectors on unapproved sources: ${rows.map((r) => r.slug).join(', ')}.`,
      };
    },
  },

  // ── Claim extraction ───────────────────────────────────────────────────────
  {
    slug: 'forecast-not-fact',
    suite: 'claim_extraction',
    name: 'A forward-looking statement is not extracted as a fact',
    async run() {
      const claims = extractClaims({
        normalizedText:
          'The group announced that it will open fifty new stores by 2030. The company opened twelve stores in the first half.',
        title: 'Store expansion',
        perspective: 'FIRST_PARTY_COMPANY',
        sourceType: 'official_newsroom',
      });
      const forecast = claims.find((c) => c.text.includes('by 2030'));
      const fact = claims.find((c) => c.text.includes('first half'));
      const passed = forecast?.claimType === 'FORECAST' && fact?.claimType === 'FACT';
      return {
        passed,
        detail: passed
          ? 'The 2030 commitment is a FORECAST; the completed openings are a FACT.'
          : `Got forecast=${forecast?.claimType ?? 'none'}, fact=${fact?.claimType ?? 'none'}.`,
      };
    },
  },
  {
    slug: 'first-party-is-self-reporting',
    suite: 'claim_extraction',
    name: 'First-party claims carry COMPANY_SELF_REPORTING regardless of precision',
    async run() {
      const claims = extractClaims({
        normalizedText: 'The company reported an 18% reduction in markdown rate this season.',
        title: 'Results',
        perspective: 'FIRST_PARTY_COMPANY',
        sourceType: 'official_newsroom',
      });
      const claim = claims[0];
      const passed = claim?.evidenceStrength === 'COMPANY_SELF_REPORTING';
      return {
        passed,
        detail: passed
          ? 'A precise self-reported figure is still self-reporting.'
          : `Got ${claim?.evidenceStrength ?? 'no claim'}.`,
      };
    },
  },
];

export async function runEvaluation(): Promise<EvaluationRun> {
  const cases: EvaluationCase[] = [];

  for (const testCase of CASES) {
    try {
      const result = await testCase.run();
      cases.push({
        slug: testCase.slug,
        suite: testCase.suite,
        name: testCase.name,
        passed: result.passed,
        detail: result.detail,
      });
    } catch (err) {
      cases.push({
        slug: testCase.slug,
        suite: testCase.suite,
        name: testCase.name,
        passed: false,
        detail: `Threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    total: cases.length,
    passed: cases.filter((c) => c.passed).length,
    cases,
    ranAt: new Date().toISOString(),
  };
}
