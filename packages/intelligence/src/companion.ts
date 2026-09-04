/**
 * The Companion answering engine.
 *
 * Every mode produces the same `CompanionResponse` object, and both the text renderer
 * and the speech renderer read from it. That is what makes "voice and text use the
 * same evidence model" a property of the code rather than a promise in a document.
 *
 * Retrieval is claim-level, not document-level: an answer cites the sentence that
 * supports it, with the evidence span it came from. When retrieval returns nothing
 * usable the engine sets `insufficientEvidence` and says so — it never falls back to
 * general knowledge, because an answer the user cannot check is worse than no answer.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  type Citation,
  type CompanionMode,
  type CompanionRequest,
  type CompanionResponse,
  type DepthLevel,
  type ResponseLength,
  type VerifiedStatement,
  RESPONSE_LENGTH_BUDGET,
  assertEvidenceIntegrity,
  estimateSpeakingSeconds,
  formatAbsolute,
  isFirstParty,
  toIso,
  truncate,
} from '@mios/domain';
import { db, schema } from '@mios/database';

const {
  claimEvidence, claims, conversationApplications, documentVersions, entities, entityAliases,
  eventClaims, eventEntities, events, evidenceSpans, industries, insights, learningUnits,
  rawDocuments, sources,
} = schema;

export interface CompanionContext {
  workspaceId: string;
  userId: string;
  /** Where in the product the question was asked from. */
  request: CompanionRequest;
  now?: Date;
}

export interface RetrievedClaim {
  claimId: string;
  text: string;
  claimType: string;
  quantified: boolean;
  evidenceStrength: string;
  verificationStatus: string;
  spanId: string | null;
  quote: string | null;
  documentTitle: string;
  documentUrl: string;
  sourceName: string;
  perspective: string;
  publishedAt: Date | null;
  eventAt: Date | null;
  eventId: string | null;
  rank: number;
}

/**
 * Words that carry no retrieval signal but dominate a naive tsquery.
 *
 * Three groups, and all three matter:
 *
 *  - **Ordinary stopwords** — articles, prepositions, auxiliaries.
 *  - **Words addressed to the assistant** — "challenge", "explain", "brief me",
 *    "teach". These describe what the user wants *done*, not what they want it done
 *    about, and counting them as content drags query coverage down until an answerable
 *    question gets refused.
 *  - **Filler verbs and nouns of enquiry** — "happening", "going on", "latest",
 *    "update", "news". "What is happening with AI in retail?" was refused because
 *    *happening* appears in no source, which is both true and completely beside the
 *    point.
 */
const QUESTION_NOISE = new RegExp(
  '\\b(' +
    [
      // articles, prepositions, auxiliaries, pronouns
      'a', 'an', 'the', 'of', 'in', 'on', 'at', 'by', 'as', 'for', 'to', 'from', 'into',
      'over', 'under', 'with', 'without', 'and', 'but', 'or', 'if', 'so', 'than', 'then',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'done',
      'has', 'have', 'had', 'can', 'could', 'would', 'should', 'will', 'shall', 'may',
      'might', 'must', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here',
      'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'me', 'my', 'i',
      // question words
      'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
      // addressed to the assistant, not to the corpus
      'tell', 'explain', 'brief', 'teach', 'prepare', 'challenge', 'claim', 'claims',
      'show', 'give', 'find', 'help', 'please', 'summarise', 'summarize', 'describe',
      // filler verbs and nouns of enquiry
      'happening', 'happened', 'happen', 'going', 'doing', 'saying', 'looking',
      'know', 'knows', 'think', 'thinks', 'need', 'needs', 'want', 'wants',
      'latest', 'recent', 'recently', 'current', 'currently', 'news', 'update',
      'updates', 'anything', 'something', 'everything', 'more', 'most', 'less',
      'any', 'all', 'some', 'new', 'now', 'today', 'next', 'about', 'around',
      'beyond', 'across', 'within', 'between', 'against', 'towards', 'toward',
    ].join('|') +
    ')\\b',
  'gi',
);

/**
 * Terms shorter than the usual floor that are worth keeping.
 *
 * The length filter exists to drop noise, but it also silently removed "AI" — the single
 * most frequent meaningful term in this corpus — so a question about AI retrieved on its
 * other words only. Two-letter acronyms are content, not noise.
 */
const SHORT_TERMS_WORTH_KEEPING = new Set([
  'ai', 'ml', 'ar', 'vr', 'xr', 'hr', 'eu', 'uk', 'ev', 'iot',
  '5g', '6g', 'bi', 'ux', 'ui', 'kpi', 'roi', 'esg', 'llm', 'nlp', 'api', 'sku',
]);
// "IT" and "US" are deliberately absent: the noise filter strips them as pronouns before
// they get here, and the pronoun reading is far commoner than the acronym one. Losing
// "US" from "US retailers" costs less than admitting every "us" in every question.

/**
 * Turns a question into a tsquery input.
 *
 * The terms are joined with OR, not left space-separated. `websearch_to_tsquery`
 * treats spaces as AND, so a seven-word question requires all seven stems to appear in
 * one claim and matches essentially nothing — which the engine then reports, correctly
 * but uselessly, as "insufficient evidence". OR retrieves candidates and `ts_rank`
 * sorts them, so claims matching more terms still come first.
 */
export function queryTerms(question: string): string[] {
  return question
    .replace(QUESTION_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => {
      const lower = w.toLowerCase();
      // Drop the tsquery operator keywords, which would be parsed as syntax.
      if (['and', 'not', 'or'].includes(lower)) return false;
      return w.length > 2 || SHORT_TERMS_WORTH_KEEPING.has(lower);
    })
    .slice(0, 12);
}

function toSearchQuery(question: string): string {
  return queryTerms(question).join(' or ');
}

/**
 * Whether the retrieved set collectively addresses the question.
 *
 * OR retrieval is necessary to find anything at all, but on its own it is dangerous: a
 * question about an unlisted Uzbek textile mill matches an NVIDIA earnings release on
 * "revenue" and "quarterly", and the answer then presents four irrelevant statements as
 * "evidence bearing on this".
 *
 * Three gates were measured against fifteen cases before this one was kept:
 *
 *  - **Per-claim term overlap** (require N of the query's terms in one sentence).
 *    Rejected. Every genuinely relevant claim scores 1 — "markdown rate" and
 *    "allocation proposals" each match a single term — so a floor of 2 threw away
 *    exactly the right evidence.
 *  - **`ts_rank` threshold.** Rejected. Rank is only comparable within one query:
 *    "population of Ulaanbaatar" scored 0.0304 against a retail question's 0.019, so
 *    any threshold either admitted nonsense or refused answerable questions.
 *  - **Query coverage** — the share of the question's own terms that appear anywhere
 *    in the retrieved set. Kept. It separates cleanly on this corpus: answerable
 *    questions score 100%, unanswerable ones 25–60%.
 *
 * The threshold is 0.7 and the refusal names the specific words it could not find,
 * which is far more useful than "insufficient evidence" on its own.
 */
const COVERAGE_THRESHOLD = 0.7;

export interface CoverageAssessment {
  covered: string[];
  missing: string[];
  ratio: number;
  sufficient: boolean;
}

/**
 * Reduces a word to a form that matches its own inflections.
 *
 * The previous rule sliced a fixed number of characters off the end, which fails on
 * ordinary English morphology: "scaling" became "scali" and so matched neither "scale"
 * nor "scaled", and "companies" became "compani" and so missed "company". Questions were
 * then refused for lacking evidence that was sitting right there.
 *
 * Stripping the suffix instead gives a stem that is a genuine prefix of every inflection:
 * scaling/scaled/scales/scale all reduce to "scal", companies/company to "compan".
 * Deliberately not a full Porter stemmer — these five rules cover what questions and
 * headlines actually differ by, and each additional rule is another way to be wrong.
 */
export function stemForMatch(word: string): string {
  const lower = word.toLowerCase();
  const strip = (suffix: string, min = 4): string | null => {
    if (!lower.endsWith(suffix)) return null;
    const stem = lower.slice(0, -suffix.length);
    return stem.length >= min ? stem : null;
  };
  return strip('ies') ?? strip('ing') ?? strip('ed') ?? strip('es') ?? strip('s') ?? lower;
}

export function assessCoverage(terms: string[], texts: string[]): CoverageAssessment {
  if (terms.length === 0) {
    return { covered: [], missing: [], ratio: 1, sufficient: true };
  }
  const haystack = texts.join(' \n ').toLowerCase();
  const covered: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    (haystack.includes(stemForMatch(term)) ? covered : missing).push(term);
  }
  const ratio = covered.length / terms.length;
  return { covered, missing, ratio, sufficient: ratio >= COVERAGE_THRESHOLD };
}

/** How many distinct query terms appear in the text, matched on word prefix. */
function termOverlap(text: string, terms: string[]): number {
  const haystack = text.toLowerCase();
  return terms.filter((term) => {
    const stem = term.toLowerCase().slice(0, Math.max(4, term.length - 2));
    return haystack.includes(stem);
  }).length;
}

/**
 * Claim-level retrieval over PostgreSQL full-text search, narrowed by whatever page
 * context the user was looking at.
 */
export async function retrieveClaims(
  question: string,
  ctx: CompanionContext,
  limit = 12,
): Promise<RetrievedClaim[]> {
  const d = db();
  const query = toSearchQuery(question);
  const pageContext = ctx.request.pageContext;

  // Entity scoping: a question asked on a company page is about that company.
  let entityFilterIds: string[] = [];
  if (pageContext?.kind === 'company' && pageContext.id) {
    entityFilterIds = [pageContext.id];
  }
  if (ctx.request.selectedEntityIds.length > 0) {
    entityFilterIds = [...entityFilterIds, ...ctx.request.selectedEntityIds];
  }
  if (entityFilterIds.length === 0) {
    entityFilterIds = await entityIdsMentionedIn(question);
  }

  const hasQuery = query.length > 0;
  const conditions = [sql`1 = 1`];
  if (hasQuery) {
    conditions.push(sql`${claims.searchVector} @@ websearch_to_tsquery('english', ${query})`);
  }
  if (entityFilterIds.length > 0) {
    conditions.push(
      sql`exists (
        select 1 from ${eventClaims} ec
        join ${eventEntities} ee on ee.event_id = ec.event_id
        where ec.claim_id = ${claims.id} and ee.entity_id in (${sql.join(entityFilterIds.map((id) => sql`${id}`), sql`, `)})
      )`,
    );
  }

  const rows = await d
    .select({
      claimId: claims.id,
      text: claims.text,
      claimType: claims.claimType,
      quantified: claims.quantified,
      evidenceStrength: claims.evidenceStrength,
      verificationStatus: claims.verificationStatus,
      spanId: evidenceSpans.id,
      quote: evidenceSpans.quote,
      documentTitle: rawDocuments.title,
      documentUrl: rawDocuments.url,
      sourceName: sources.name,
      perspective: sources.perspective,
      publishedAt: rawDocuments.publishedAt,
      eventAt: claims.eventAt,
      rank: hasQuery
        ? sql<number>`ts_rank(${claims.searchVector}, websearch_to_tsquery('english', ${query}))`
        : sql<number>`0`,
    })
    .from(claims)
    .innerJoin(documentVersions, eq(documentVersions.id, claims.documentVersionId))
    .innerJoin(rawDocuments, eq(rawDocuments.id, documentVersions.documentId))
    .innerJoin(sources, eq(sources.id, claims.sourceId))
    .leftJoin(claimEvidence, eq(claimEvidence.claimId, claims.id))
    .leftJoin(evidenceSpans, eq(evidenceSpans.id, claimEvidence.evidenceSpanId))
    .where(and(...conditions))
    .orderBy(desc(rawDocuments.publishedAt))
    .limit(limit * 2);

  // Prefer FACT claims, then strongest evidence, then most recent.
  const priority: Record<string, number> = { FACT: 0, FORECAST: 1, INTERPRETATION: 2, UNVERIFIED_SIGNAL: 3, HYPOTHESIS: 4 };
  const seen = new Set<string>();
  // No per-claim floor: the relevant claims each match only one term, so filtering
  // claim-by-claim discards them. Relevance is judged on the set, in assessCoverage.
  return rows
    .filter((r) => (seen.has(r.claimId) ? false : (seen.add(r.claimId), true)))
    .sort(
      (a, b) =>
        (priority[a.claimType] ?? 9) - (priority[b.claimType] ?? 9) ||
        b.rank - a.rank ||
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    )
    .slice(0, limit)
    .map((r) => ({ ...r, eventId: null }));
}

/** Resolves company names inside a free-text question to entity ids. */
async function entityIdsMentionedIn(question: string): Promise<string[]> {
  const normalized = question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const rows = await db()
    .select({ entityId: entityAliases.entityId, normalized: entityAliases.normalized, requiresContext: entityAliases.requiresContext })
    .from(entityAliases);

  const hits = new Set<string>();
  for (const row of rows) {
    if (row.normalized.length < 3 && row.requiresContext) continue;
    const pattern = new RegExp(`(^|\\s)${row.normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (pattern.test(normalized)) hits.add(row.entityId);
  }
  return [...hits].slice(0, 5);
}

function toCitation(claim: RetrievedClaim): Citation {
  return {
    claimId: claim.claimId,
    evidenceSpanId: claim.spanId,
    documentTitle: claim.documentTitle,
    sourceName: claim.sourceName,
    sourceUrl: claim.documentUrl,
    perspective: claim.perspective as Citation['perspective'],
    evidenceStrength: claim.evidenceStrength as Citation['evidenceStrength'],
    verificationStatus: claim.verificationStatus as Citation['verificationStatus'],
    publishedAt: toIso(claim.publishedAt),
    eventAt: toIso(claim.eventAt),
    quote: claim.quote,
  };
}

interface Assembled {
  directAnswer: string;
  verifiedFacts: VerifiedStatement[];
  interpretations: string[];
  hypotheses: string[];
  counterEvidence: VerifiedStatement[];
  unknowns: string[];
  followUps: string[];
  conversationStarters: string[];
  segments: { label: string; text: string }[];
}

/**
 * Answers a question against stored evidence.
 *
 * Never throws for lack of data: an empty retrieval produces a valid response with
 * `insufficientEvidence` set, which the UI renders as a clear statement that the
 * monitored sources cannot answer this.
 */
export async function answerQuestion(ctx: CompanionContext): Promise<CompanionResponse> {
  const now = ctx.now ?? new Date();
  const { question, mode, depth, length } = ctx.request;

  const retrieved = await retrieveClaims(question, ctx);
  const citations = retrieved.filter((r) => r.spanId !== null).map(toCitation);
  const cited = retrieved.filter((r) => r.spanId !== null);

  const contextUsed = buildContextUsed(ctx);

  const assembled = await assembleForMode(mode, depth, length, cited, ctx, now);

  // Insufficiency is judged per mode, on what the mode actually produced — not on
  // whether claim retrieval happened to return rows.
  //
  //   capture_reflect  stores the user's own thought and needs no evidence at all
  //   brief_me         reads recent insights, not claim hits
  //   explain_it       needs a learning unit *or* claims
  //   teach_me         same
  //   explore_it       genuinely needs claims — that is the whole mode
  //   prepare_me       same
  //   challenge_me     may legitimately answer "no contradicting evidence exists"
  const produced =
    assembled.verifiedFacts.length > 0 ||
    assembled.interpretations.length > 0 ||
    assembled.segments.length > 0 ||
    assembled.counterEvidence.length > 0;

  // Does the retrieved set actually address the words the user asked about? Retrieval
  // ORs its terms, so it always returns *something*; coverage is what distinguishes
  // "these claims are about your question" from "these claims share a common word".
  const questionTerms = queryTerms(question);
  const coverage = assessCoverage(
    questionTerms,
    retrieved.map((r) => r.text),
  );

  const insufficient = (() => {
    switch (mode) {
      case 'capture_reflect':
        return false;
      case 'challenge_me':
        // Stating that nothing contradicts the view *is* the answer, provided we
        // actually searched something.
        return cited.length === 0 && !produced;
      case 'brief_me':
      case 'explain_it':
      case 'teach_me':
        return !produced;
      case 'explore_it':
      case 'prepare_me':
        return cited.length === 0 || !coverage.sufficient;
    }
  })();

  if (insufficient) {
    return finalize(insufficientEvidenceAnswer(coverage), {
      ctx,
      citations: [],
      now,
      contextUsed,
      insufficient: true,
    });
  }

  return finalize(assembled, { ctx, citations, now, contextUsed, insufficient: false });
}

/**
 * The honest refusal.
 *
 * Returned instead of an answer assembled from general knowledge. Naming what is
 * missing is more useful than a fluent guess, and it points at the action that would
 * fix it.
 */
function insufficientEvidenceAnswer(coverage?: CoverageAssessment): Assembled {
  // Naming the specific words that appear nowhere in the corpus is far more actionable
  // than "insufficient evidence": it tells the user whether the gap is a missing source,
  // a company we do not track, or simply a term the sources phrase differently.
  const missing = coverage?.missing ?? [];
  const specifics =
    missing.length > 0
      ? [
          `No monitored source mentions: ${missing.join(', ')}.`,
          `Only ${Math.round((coverage?.ratio ?? 0) * 100)}% of this question's vocabulary appears anywhere in the monitored sources.`,
        ]
      : ['No stored claim or learning unit was relevant enough to this question.'];

  return {
    directAnswer:
      'I do not have sufficient verified evidence in the monitored sources to answer this reliably. Rather than answer from general knowledge, here is what is missing.',
    verifiedFacts: [],
    interpretations: [],
    hypotheses: [],
    counterEvidence: [],
    unknowns: [
      ...specifics,
      'The monitored source set may not cover this topic, company or period — see the coverage dashboard.',
      'Adding a source, or ingesting a specific URL, would let me answer it.',
    ],
    followUps: [
      'Which sources are currently monitored?',
      'Where are the coverage gaps for this industry?',
    ],
    conversationStarters: [],
    segments: [],
  };
}

function buildContextUsed(ctx: CompanionContext): { kind: string; id: string; label: string }[] {
  const out: { kind: string; id: string; label: string }[] = [];
  const page = ctx.request.pageContext;
  if (page) {
    out.push({ kind: page.kind, id: page.id ?? '', label: page.label ?? page.kind });
  }
  for (const id of ctx.request.selectedEntityIds) {
    out.push({ kind: 'entity', id, label: 'selected entity' });
  }
  return out;
}

async function assembleForMode(
  mode: CompanionMode,
  depth: DepthLevel,
  length: ResponseLength,
  cited: RetrievedClaim[],
  ctx: CompanionContext,
  now: Date,
): Promise<Assembled> {
  const facts = cited.filter((c) => c.claimType === 'FACT');
  const forecasts = cited.filter((c) => c.claimType === 'FORECAST');
  const interpretationClaims = cited.filter((c) => c.claimType === 'INTERPRETATION');
  const indexOf = (claim: RetrievedClaim) => cited.indexOf(claim);

  const factStatements: VerifiedStatement[] = facts
    .slice(0, budgetItems(length))
    .map((f) => ({ text: f.text, citationIndexes: [indexOf(f)] }));

  const firstPartyOnly = cited.every((c) => isFirstParty(c.perspective as never));
  const asOfLine = `As of ${formatAbsolute(now)}, based on ${cited.length} evidenced claim${cited.length === 1 ? '' : 's'} from ${new Set(cited.map((c) => c.sourceName)).size} source${new Set(cited.map((c) => c.sourceName)).size === 1 ? '' : 's'}.`;

  const baseUnknowns: string[] = [];
  if (firstPartyOnly) {
    baseUnknowns.push('Every source here is first-party. Nothing has been independently confirmed.');
  }
  if (!cited.some((c) => c.quantified)) {
    baseUnknowns.push('None of the retrieved claims states a quantified outcome.');
  }
  baseUnknowns.push('Only the monitored sources were searched; developments outside them are not visible.');

  switch (mode) {
    case 'brief_me': {
      const recent = await recentInsightsFor(ctx, now);
      const segments = recent.map((r) => ({ label: r.headline, text: r.takeaway }));
      // Brief Me reads insights, not claim hits, so the claim-count phrasing in
      // `asOfLine` would read as "0 evidenced claims" and imply the opposite of what
      // is true.
      return {
        directAnswer:
          recent.length > 0
            ? `${recent.length} development${recent.length === 1 ? '' : 's'} to know, as of ${formatAbsolute(now)}. Each links to its own evidence.`
            : `No new developments met the relevance bar in the monitored sources, as of ${formatAbsolute(now)}.`,
        verifiedFacts: factStatements,
        interpretations: recent.map((r) => r.whyItMatters).filter(Boolean).slice(0, 3),
        hypotheses: [],
        counterEvidence: [],
        unknowns: baseUnknowns,
        followUps: ['What changed on my watchlist this week?', 'Go deeper on the first item.'],
        conversationStarters: [],
        segments,
      };
    }

    case 'explain_it': {
      const units = await learningUnitsFor(ctx.request.question, depth);
      const explanation = units[0];
      return {
        directAnswer: explanation
          ? `${explanation.objective} ${truncate(explanation.explanation, RESPONSE_LENGTH_BUDGET[length] * 6)}`
          : `The monitored sources contain evidence on this, but no structured explainer exists for it yet. ${asOfLine}`,
        verifiedFacts: factStatements,
        interpretations: explanation
          ? explanation.structuredModel.flatMap((s) => s.points.map((p) => `${s.heading}: ${p}`)).slice(0, 6)
          : [],
        hypotheses: [],
        counterEvidence: [],
        unknowns: explanation
          ? [`Common misconception: ${explanation.commonMisconceptions[0] ?? 'none recorded'}`, ...baseUnknowns]
          : ['No structured learning unit covers this concept yet.', ...baseUnknowns],
        followUps: explanation?.practicalQuestions.slice(0, 3) ?? [],
        conversationStarters: [],
        segments: explanation
          ? explanation.structuredModel.map((s) => ({ label: s.heading, text: s.points.join(' ') }))
          : [],
      };
    }

    case 'explore_it': {
      return {
        directAnswer: `${facts.length} evidenced statement${facts.length === 1 ? '' : 's'} bear on this. ${asOfLine}`,
        verifiedFacts: factStatements,
        interpretations: interpretationClaims.slice(0, 3).map((c) => c.text),
        hypotheses: forecasts.slice(0, 3).map((c) => `Stated as a forward-looking claim by the source: ${c.text}`),
        counterEvidence: await counterEvidenceFor(cited, indexOf),
        unknowns: baseUnknowns,
        followUps: ['Which of these is independently confirmed?', 'Show me the strongest evidence only.'],
        conversationStarters: [],
        segments: facts.slice(0, 5).map((f) => ({ label: f.sourceName, text: f.text })),
      };
    }

    case 'prepare_me': {
      const starters = await starterQuestionsFor(cited);
      return {
        directAnswer: `Sixty-second brief. ${asOfLine}`,
        verifiedFacts: factStatements,
        interpretations: [
          firstPartyOnly
            ? 'Treat this as the company’s own account of itself; it describes intent and self-reported results.'
            : 'Independent sources are present, which raises confidence that events occurred as described — not that they delivered the stated benefit.',
        ],
        hypotheses: forecasts.slice(0, 2).map((c) => `Their stated intent: ${c.text}`),
        counterEvidence: await counterEvidenceFor(cited, indexOf),
        unknowns: baseUnknowns,
        followUps: ['What should I not raise in this meeting?', 'Give me one contrarian angle.'],
        conversationStarters: starters,
        segments: factStatements.map((f, i) => ({ label: `Fact ${i + 1}`, text: f.text })),
      };
    }

    case 'challenge_me': {
      const counter = await counterEvidenceFor(cited, indexOf);
      const assumptions = buildAssumptionChallenges(cited, firstPartyOnly);
      return {
        directAnswer:
          counter.length > 0
            ? `There is evidence that cuts against this. ${asOfLine}`
            : `No contradicting evidence exists in the monitored sources — which is not the same as confirmation. ${asOfLine}`,
        verifiedFacts: factStatements.slice(0, 3),
        interpretations: assumptions,
        hypotheses: [],
        counterEvidence: counter,
        unknowns: [
          ...baseUnknowns,
          'Absence of contradiction in a limited source set is weak evidence of correctness.',
        ],
        followUps: ['What would change my mind?', 'What is the weakest assumption here?'],
        conversationStarters: [],
        segments: assumptions.map((a, i) => ({ label: `Challenge ${i + 1}`, text: a })),
      };
    }

    case 'teach_me': {
      const units = await learningUnitsFor(ctx.request.question, depth);
      const unit = units[0];
      return {
        directAnswer: unit
          ? `Learning objective: ${unit.objective}`
          : `No learning unit covers this yet. ${asOfLine}`,
        verifiedFacts: factStatements.slice(0, 3),
        interpretations: unit ? unit.keyTerms.map((t) => `${t.term}: ${t.definition}`) : [],
        hypotheses: [],
        counterEvidence: [],
        unknowns: unit ? unit.commonMisconceptions : ['No structured content for this concept yet.'],
        followUps: unit?.practicalQuestions.slice(0, 3) ?? [],
        conversationStarters: [],
        segments: unit
          ? [
              { label: 'Explanation', text: unit.explanation },
              ...unit.structuredModel.map((s) => ({ label: s.heading, text: s.points.join(' ') })),
            ]
          : [],
      };
    }

    case 'capture_reflect': {
      return {
        directAnswer:
          'Captured. This is stored as your own note, kept separate from verified source material — it will never be cited as evidence.',
        verifiedFacts: [],
        interpretations: [ctx.request.question],
        hypotheses: [],
        counterEvidence: [],
        unknowns: [],
        followUps: ['What should I investigate next on this?', 'Summarise what I learned in this conversation.'],
        conversationStarters: [],
        segments: [],
      };
    }
  }
}

function budgetItems(length: ResponseLength): number {
  switch (length) {
    case 'one_sentence': return 1;
    case 'thirty_seconds': return 2;
    case 'sixty_second_brief': return 3;
    case 'executive_summary': return 4;
    case 'standard': return 6;
    case 'deep_dive': return 10;
  }
}

function buildAssumptionChallenges(cited: RetrievedClaim[], firstPartyOnly: boolean): string[] {
  const out: string[] = [];
  if (firstPartyOnly) {
    out.push('Assumption: the company’s own description is accurate and complete. Nothing here tests that.');
  }
  if (cited.some((c) => c.quantified)) {
    out.push('Assumption: the reported figures use a stable baseline. None of the sources states the baseline method.');
  }
  if (cited.some((c) => c.claimType === 'FORECAST')) {
    out.push('Assumption: stated intent becomes delivery. Announcements and outcomes are different claims.');
  }
  out.push('Alternative explanation: the observed change is driven by market conditions rather than by the initiative described.');
  return out.slice(0, 4);
}

async function counterEvidenceFor(
  cited: RetrievedClaim[],
  indexOf: (c: RetrievedClaim) => number,
): Promise<VerifiedStatement[]> {
  const claimIds = cited.map((c) => c.claimId);
  if (claimIds.length === 0) return [];

  const rows = await db()
    .select({ explanation: schema.contradictions.explanation, claimAId: schema.contradictions.claimAId })
    .from(schema.contradictions)
    .where(inArray(schema.contradictions.claimAId, claimIds))
    .limit(5);

  return rows
    .map((row) => {
      const source = cited.find((c) => c.claimId === row.claimAId);
      if (!source) return null;
      return { text: row.explanation, citationIndexes: [indexOf(source)] };
    })
    .filter((v): v is VerifiedStatement => v !== null);
}

async function starterQuestionsFor(cited: RetrievedClaim[]): Promise<string[]> {
  const eventIds = (
    await db()
      .select({ eventId: eventClaims.eventId })
      .from(eventClaims)
      .where(inArray(eventClaims.claimId, cited.map((c) => c.claimId)))
      .limit(20)
  ).map((r) => r.eventId);

  if (eventIds.length === 0) return [];

  const rows = await db()
    .select({ text: conversationApplications.text })
    .from(conversationApplications)
    .where(
      and(
        inArray(conversationApplications.eventId, eventIds),
        eq(conversationApplications.kind, 'conversation_starter'),
      ),
    )
    .limit(5);
  return rows.map((r) => r.text);
}

async function recentInsightsFor(
  ctx: CompanionContext,
  now: Date,
): Promise<{ headline: string; takeaway: string; whyItMatters: string }[]> {
  return db()
    .select({
      headline: insights.headline,
      takeaway: insights.takeaway,
      whyItMatters: insights.whyItMatters,
    })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(and(eq(insights.workspaceId, ctx.workspaceId), eq(events.isSuppressed, false)))
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(5);
}

async function learningUnitsFor(
  question: string,
  depth: DepthLevel,
): Promise<
  {
    objective: string;
    explanation: string;
    structuredModel: { heading: string; points: string[] }[];
    keyTerms: { term: string; definition: string }[];
    commonMisconceptions: string[];
    practicalQuestions: string[];
  }[]
> {
  const query = toSearchQuery(question);
  if (!query) return [];

  const rows = await db()
    .select({
      objective: learningUnits.objective,
      explanation: learningUnits.explanation,
      structuredModel: learningUnits.structuredModel,
      keyTerms: learningUnits.keyTerms,
      commonMisconceptions: learningUnits.commonMisconceptions,
      practicalQuestions: learningUnits.practicalQuestions,
      depth: learningUnits.depth,
      rank: sql<number>`ts_rank(${learningUnits.searchVector}, websearch_to_tsquery('english', ${query}))`.as('rank'),
    })
    .from(learningUnits)
    .where(sql`${learningUnits.searchVector} @@ websearch_to_tsquery('english', ${query})`)
    .orderBy(desc(sql`rank`))
    .limit(5);

  // Prefer the requested depth, but return something rather than nothing.
  const atDepth = rows.filter((r) => r.depth === depth);
  return (atDepth.length > 0 ? atDepth : rows).map(({ depth: _d, rank: _r, ...rest }) => rest);
}

function finalize(
  assembled: Assembled,
  opts: {
    ctx: CompanionContext;
    citations: Citation[];
    now: Date;
    contextUsed: { kind: string; id: string; label: string }[];
    insufficient: boolean;
  },
): CompanionResponse {
  const { ctx, citations, now, contextUsed, insufficient } = opts;
  const spoken = [assembled.directAnswer, ...assembled.verifiedFacts.map((f) => f.text)].join(' ');

  const response: CompanionResponse = {
    mode: ctx.request.mode,
    depth: ctx.request.depth,
    length: ctx.request.length,
    generator: 'deterministic_extractive',
    directAnswer: assembled.directAnswer,
    verifiedFacts: assembled.verifiedFacts,
    interpretations: assembled.interpretations,
    hypotheses: assembled.hypotheses,
    counterEvidence: assembled.counterEvidence,
    unknowns: assembled.unknowns,
    coverageLimitations: [
      'Only sources registered and approved in this workspace were searched.',
      'Feed-based sources provide the publisher’s own summary, not the full article.',
    ],
    suggestedFollowUps: assembled.followUps,
    learningConnections: [],
    conversationStarters: assembled.conversationStarters,
    citations,
    asOf: now.toISOString(),
    coverageFrom: null,
    coverageTo: null,
    contextUsed,
    voice: {
      spokenSummary: truncate(spoken, RESPONSE_LENGTH_BUDGET[ctx.request.length] * 7),
      estimatedSeconds: estimateSpeakingSeconds(spoken),
      segments: assembled.segments,
    },
    insufficientEvidence: insufficient,
  };

  // The gate. A response whose factual statements cannot be traced to an evidence span
  // is a defect, so it is rejected here rather than rendered.
  assertEvidenceIntegrity(response);
  return response;
}
