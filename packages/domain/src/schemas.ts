/**
 * Zod schemas for every boundary: model output, connector payloads, HTTP request
 * bodies.
 *
 * The rule that makes the trust model real is in `CompanionResponseSchema` and
 * `ExtractedClaimSchema`: a factual statement carries `evidenceSpanIds`, and
 * `assertEvidenceIntegrity` refuses to let a FACT through with an empty list. A model
 * that returns fluent prose with no evidence references fails validation and is
 * discarded rather than displayed.
 */

import { z } from 'zod';
import {
  BUSINESS_VALUE_LEVERS,
  CASE_MATURITIES,
  CLAIM_TYPES,
  CLASSIFICATION_ORIGINS,
  COMPANION_MODES,
  CONVERSATION_APPLICATION_KINDS,
  DEPTH_LEVELS,
  EVENT_TYPES,
  EVIDENCE_STRENGTHS,
  EXECUTIVE_OWNERS,
  GENERATORS,
  KNOWLEDGE_STATES,
  LEARNING_CONNECTION_KINDS,
  NOVELTY_KINDS,
  OPERATING_MODEL_DIMENSIONS,
  RESPONSE_LENGTHS,
  SOURCE_PERSPECTIVES,
  STRATEGIC_IMPACTS,
  VERIFICATION_STATUSES,
} from './enums';

export const uuid = z.string().uuid();
export const isoDate = z.string().datetime({ offset: true });

// ── Ingestion boundary ───────────────────────────────────────────────────────

/** What a connector hands to the pipeline. Deliberately minimal and source-neutral. */
export const FetchedDocumentSchema = z.object({
  sourceId: uuid,
  /** Canonical URL of the document as published. */
  url: z.string().url(),
  /** Stable id within the source (feed guid, filing accession number, …). */
  externalId: z.string().min(1).max(512).nullable(),
  title: z.string().min(1).max(1000),
  /**
   * Body text. May be empty when the source policy only permits metadata. Never
   * populated by circumventing a paywall or an access control.
   */
  body: z.string().default(''),
  /** Short quotable extract, used when full text may not be retained. */
  excerpt: z.string().max(4000).default(''),
  author: z.string().max(300).nullable().default(null),
  language: z.string().length(2).nullable().default(null),
  publishedAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
  /** Everything the connector saw but the model does not model explicitly. */
  raw: z.record(z.string(), z.unknown()).default({}),
});
export type FetchedDocument = z.infer<typeof FetchedDocumentSchema>;

export const ConnectorResultSchema = z.object({
  documents: z.array(FetchedDocumentSchema),
  /** Opaque resume token (feed etag, last filing date, page cursor). */
  cursor: z.string().nullable().default(null),
  /** Non-fatal problems worth showing in the admin surface. */
  warnings: z.array(z.string()).default([]),
});
export type ConnectorResult = z.infer<typeof ConnectorResultSchema>;

// ── Intelligence extraction ──────────────────────────────────────────────────

/**
 * A character range in a specific document version. Offsets are into the normalised
 * text, so they stay valid as long as that version exists — versions are immutable.
 */
export const EvidenceSpanRefSchema = z.object({
  documentVersionId: uuid,
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  quote: z.string().min(1).max(4000),
});
export type EvidenceSpanRef = z.infer<typeof EvidenceSpanRefSchema>;

export const ExtractedClaimSchema = z
  .object({
    text: z.string().min(10).max(1200),
    claimType: z.enum(CLAIM_TYPES),
    /**
     * Spans that support this exact statement. Non-empty for FACT — enforced by
     * `assertEvidenceIntegrity`, not merely documented.
     */
    evidence: z.array(EvidenceSpanRefSchema),
    /** Model/rule confidence in the extraction itself, not in the world. */
    confidence: z.number().min(0).max(1),
    /** Present only when the claim states a measurable outcome. */
    quantified: z.boolean().default(false),
    subjectEntityNames: z.array(z.string().min(1).max(200)).default([]),
  })
  .refine((c) => c.claimType !== 'FACT' || c.evidence.length > 0, {
    message: 'A FACT claim requires at least one evidence span',
    path: ['evidence'],
  });
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const ExtractedEventSchema = z.object({
  title: z.string().min(5).max(300),
  summary: z.string().min(10).max(2000),
  eventType: z.enum(EVENT_TYPES),
  /** When the thing happened, if the text says so — not when it was published. */
  eventAt: z.date().nullable(),
  entityNames: z.array(z.string().min(1).max(200)).default([]),
  claimIndexes: z.array(z.number().int().min(0)).default([]),
});
export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

/** Consulting-relevance classification. Origin is mandatory so the UI can label it. */
export const ClassificationSchema = z.object({
  industrySlugs: z.array(z.string()).default([]),
  topicSlugs: z.array(z.string()).default([]),
  technologySlugs: z.array(z.string()).default([]),
  capabilitySlugs: z.array(z.string()).default([]),
  valueChainStageSlugs: z.array(z.string()).default([]),
  valueLevers: z.array(z.enum(BUSINESS_VALUE_LEVERS)).default([]),
  operatingModelDimensions: z.array(z.enum(OPERATING_MODEL_DIMENSIONS)).default([]),
  likelyExecutiveOwners: z.array(z.enum(EXECUTIVE_OWNERS)).default([]),
  strategicImpact: z.enum(STRATEGIC_IMPACTS),
  caseMaturity: z.enum(CASE_MATURITIES),
  origin: z.enum(CLASSIFICATION_ORIGINS),
  rationale: z.string().max(1000).default(''),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const GeneratedInsightSchema = z.object({
  headline: z.string().min(10).max(200),
  takeaway: z.string().min(10).max(400),
  whatHappened: z.string().min(10).max(3000),
  whatChanged: z.string().max(2000).default(''),
  whyItMatters: z.string().max(3000).default(''),
  whatIsGenuinelyNew: z.string().max(1500).default(''),
  marketContext: z.string().max(3000).default(''),
  /** Explicitly our reading, never presented as fact. */
  consultantPerspective: z.string().max(3000).default(''),
  clientImplications: z.array(z.string().min(10).max(600)).default([]),
  conversationStarters: z.array(z.string().min(10).max(600)).default([]),
  knownUnknowns: z.array(z.string().min(5).max(600)).default([]),
  counterSignals: z.array(z.string().min(5).max(600)).default([]),
  novelty: z.enum(NOVELTY_KINDS),
  generator: z.enum(GENERATORS),
});
export type GeneratedInsight = z.infer<typeof GeneratedInsightSchema>;

// ── Companion ────────────────────────────────────────────────────────────────

/**
 * A citation always points at a claim, and through it at an evidence span — never at a
 * bare source. "The Financial Times reported it" is not a citation; a quoted range in
 * a stored document version is.
 */
export const CitationSchema = z.object({
  claimId: uuid,
  evidenceSpanId: uuid.nullable(),
  documentTitle: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().url().nullable(),
  perspective: z.enum(SOURCE_PERSPECTIVES),
  evidenceStrength: z.enum(EVIDENCE_STRENGTHS),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  publishedAt: isoDate.nullable(),
  eventAt: isoDate.nullable(),
  quote: z.string().max(4000).nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const VerifiedStatementSchema = z.object({
  text: z.string().min(1),
  /** Indexes into `CompanionResponse.citations`. */
  citationIndexes: z.array(z.number().int().min(0)).min(1),
});
export type VerifiedStatement = z.infer<typeof VerifiedStatementSchema>;

/**
 * The single structured object every Companion answer is built from. Text rendering
 * and speech rendering both read this — that is what makes "voice and text share one
 * evidence model" true in code rather than in a document.
 */
export const CompanionResponseSchema = z
  .object({
    mode: z.enum(COMPANION_MODES),
    depth: z.enum(DEPTH_LEVELS),
    length: z.enum(RESPONSE_LENGTHS),
    generator: z.enum(GENERATORS),

    /** Plain-language answer. Must not contain claims absent from `verifiedFacts`. */
    directAnswer: z.string().min(1),

    verifiedFacts: z.array(VerifiedStatementSchema).default([]),
    /** Our reading of the facts. Rendered under an "Interpretation" label. */
    interpretations: z.array(z.string()).default([]),
    /** Testable propositions. Rendered under a "Hypothesis" label. */
    hypotheses: z.array(z.string()).default([]),
    counterEvidence: z.array(VerifiedStatementSchema).default([]),
    /** What the monitored sources cannot answer. */
    unknowns: z.array(z.string()).default([]),
    coverageLimitations: z.array(z.string()).default([]),

    suggestedFollowUps: z.array(z.string()).default([]),
    learningConnections: z
      .array(
        z.object({
          kind: z.enum(LEARNING_CONNECTION_KINDS),
          label: z.string(),
          slug: z.string(),
          href: z.string().nullable().default(null),
        }),
      )
      .default([]),
    conversationStarters: z.array(z.string()).default([]),

    citations: z.array(CitationSchema).default([]),

    /** The freshness contract: what date this answer is true as of. */
    asOf: isoDate,
    /** Window of source material considered. */
    coverageFrom: isoDate.nullable().default(null),
    coverageTo: isoDate.nullable().default(null),

    /** Context objects actually used, so the user can audit what the answer saw. */
    contextUsed: z
      .array(z.object({ kind: z.string(), id: z.string(), label: z.string() }))
      .default([]),

    /** Hints for the speech renderer; never change the substance of the answer. */
    voice: z
      .object({
        spokenSummary: z.string().default(''),
        estimatedSeconds: z.number().int().min(0).default(0),
        segments: z.array(z.object({ label: z.string(), text: z.string() })).default([]),
      })
      .default({ spokenSummary: '', estimatedSeconds: 0, segments: [] }),

    /** True when we declined to answer for lack of evidence. Not a failure state. */
    insufficientEvidence: z.boolean().default(false),
  })
  .superRefine((r, ctx) => {
    const n = r.citations.length;
    const check = (list: VerifiedStatement[], path: string) =>
      list.forEach((s, i) =>
        s.citationIndexes.forEach((ci) => {
          if (ci < 0 || ci >= n) {
            ctx.addIssue({
              code: 'custom',
              path: [path, i, 'citationIndexes'],
              message: `citation index ${ci} out of range (${n} citations)`,
            });
          }
        }),
      );
    check(r.verifiedFacts, 'verifiedFacts');
    check(r.counterEvidence, 'counterEvidence');
    if (r.insufficientEvidence && r.verifiedFacts.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['insufficientEvidence'],
        message: 'cannot claim insufficient evidence while asserting verified facts',
      });
    }
  });
export type CompanionResponse = z.infer<typeof CompanionResponseSchema>;

export const CompanionRequestSchema = z.object({
  question: z.string().min(1).max(4000),
  mode: z.enum(COMPANION_MODES).default('explore_it'),
  depth: z.enum(DEPTH_LEVELS).default('executive'),
  length: z.enum(RESPONSE_LENGTHS).default('standard'),
  conversationId: uuid.nullable().default(null),
  /** What the user is looking at. May add context; may never silently alter intent. */
  pageContext: z
    .object({
      kind: z.enum(['today', 'insight', 'company', 'industry', 'learning_unit', 'meeting', 'search', 'library', 'other']),
      id: z.string().nullable().default(null),
      label: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  selectedEntityIds: z.array(uuid).default([]),
});
export type CompanionRequest = z.infer<typeof CompanionRequestSchema>;

// ── Learning ─────────────────────────────────────────────────────────────────

export const KnowledgeCheckSchema = z.object({
  question: z.string().min(5),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  explanation: z.string().min(5),
});
export type KnowledgeCheck = z.infer<typeof KnowledgeCheckSchema>;

export const KnowledgeStateUpdateSchema = z.object({
  conceptSlug: z.string(),
  state: z.enum(KNOWLEDGE_STATES),
  /** Shown verbatim when the user asks why we think this. */
  reason: z.string(),
  /** True when the user set it themselves — user statements always win. */
  userAsserted: z.boolean().default(false),
});
export type KnowledgeStateUpdate = z.infer<typeof KnowledgeStateUpdateSchema>;

// ── Meeting preparation ──────────────────────────────────────────────────────

export const MeetingBriefRequestSchema = z.object({
  companyEntityId: uuid.nullable().default(null),
  companyName: z.string().min(1).max(200),
  objective: z.string().max(1000).default(''),
  meetingAt: z.string().nullable().default(null),
  attendees: z
    .array(z.object({ name: z.string().max(200), role: z.string().max(200).default('') }))
    .default([]),
  topics: z.array(z.string().max(200)).default([]),
  competitorNames: z.array(z.string().max(200)).default([]),
  technologyNames: z.array(z.string().max(200)).default([]),
  depth: z.enum(DEPTH_LEVELS).default('executive'),
  lookbackDays: z.number().int().min(1).max(730).default(90),
  personalNotes: z.string().max(4000).default(''),
});
export type MeetingBriefRequest = z.infer<typeof MeetingBriefRequestSchema>;

export const MeetingBriefContentSchema = z.object({
  sixtySecondBrief: z.string(),
  whatChanged: z.array(
    z.object({
      window: z.enum(['7d', '30d', '90d', '12m']),
      items: z.array(VerifiedStatementSchema),
    }),
  ),
  companyContext: z.array(VerifiedStatementSchema),
  executiveContext: z.array(VerifiedStatementSchema),
  whatThisCouldMean: z.array(z.string()),
  conversationStarters: z.array(z.string()),
  contrarianAngle: z.array(z.string()),
  knownUnknowns: z.array(z.string()),
  marketExamples: z.array(
    z.object({
      label: z.string(),
      maturity: z.enum(CASE_MATURITIES),
      evidenceStrength: z.enum(EVIDENCE_STRENGTHS),
      citationIndexes: z.array(z.number().int().min(0)).default([]),
    }),
  ),
  citations: z.array(CitationSchema),
  coverageLimitations: z.array(z.string()),
  generator: z.enum(GENERATORS),
  asOf: isoDate,
});
export type MeetingBriefContent = z.infer<typeof MeetingBriefContentSchema>;

// ── Conversation application ─────────────────────────────────────────────────

export const ConversationApplicationSchema = z.object({
  kind: z.enum(CONVERSATION_APPLICATION_KINDS),
  text: z.string().min(10).max(1000),
  /** Claims this was derived from. Empty is allowed only for contrarian_angle. */
  derivedFromClaimIds: z.array(uuid).default([]),
  generator: z.enum(GENERATORS),
});
export type ConversationApplication = z.infer<typeof ConversationApplicationSchema>;

// ── Guards ───────────────────────────────────────────────────────────────────

export class EvidenceIntegrityError extends Error {
  constructor(
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'EvidenceIntegrityError';
  }
}

/**
 * Last line of defence before anything reaches a user. Called on every Companion
 * response and every generated insight, regardless of which generator produced it.
 *
 * Rejects rather than repairs: a response that cannot prove its factual statements is
 * a defect, and silently stripping the citations would hide it.
 */
export function assertEvidenceIntegrity(response: CompanionResponse): void {
  for (const [i, fact] of response.verifiedFacts.entries()) {
    if (fact.citationIndexes.length === 0) {
      throw new EvidenceIntegrityError(`verifiedFacts[${i}] has no citation`, fact);
    }
    for (const ci of fact.citationIndexes) {
      const citation = response.citations[ci];
      if (!citation) {
        throw new EvidenceIntegrityError(`verifiedFacts[${i}] cites missing citation ${ci}`, fact);
      }
      if (!citation.evidenceSpanId) {
        throw new EvidenceIntegrityError(
          `verifiedFacts[${i}] cites claim ${citation.claimId} which has no evidence span`,
          citation,
        );
      }
    }
  }
}

/** True when a statement may be rendered under the "Verified facts" heading. */
export function mayPresentAsFact(
  claimType: (typeof CLAIM_TYPES)[number],
  evidenceSpanCount: number,
): boolean {
  return claimType === 'FACT' && evidenceSpanCount > 0;
}
