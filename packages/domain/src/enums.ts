/**
 * Controlled vocabularies.
 *
 * These are the load-bearing part of the trust model: the difference between
 * "announced" and "independently validated", or between a FACT and a HYPOTHESIS, is
 * only meaningful if it is a typed value that the database, the ranking model, the UI
 * and the evaluation suite all agree on. Never widen one of these to `string`.
 *
 * Every array is the single source of truth: the Postgres enum, the Zod schema and the
 * TypeScript union are all derived from it.
 */

const asEnum = <const T extends readonly [string, ...string[]]>(values: T) => values;

// ── Sources ──────────────────────────────────────────────────────────────────

/**
 * Who is speaking. A company's own newsroom is a legitimate and valuable source, but
 * it is not a neutral one, and the UI must always be able to say which kind it was.
 */
export const SOURCE_PERSPECTIVES = asEnum([
  'FIRST_PARTY_COMPANY',
  'FIRST_PARTY_TECH_PROVIDER',
  'FIRST_PARTY_CONSULTING_FIRM',
  'FIRST_PARTY_CLIENT',
  'INDEPENDENT_BUSINESS_MEDIA',
  'INDUSTRY_MEDIA',
  'REGULATOR',
  'PUBLIC_INSTITUTION',
  'RESEARCH_INSTITUTION',
  'ACADEMIC_SOURCE',
  'LICENSED_PREMIUM',
  'AUTHORIZED_INTERNAL',
  'USER_PROVIDED',
]);
export type SourcePerspective = (typeof SOURCE_PERSPECTIVES)[number];

/** Perspectives that are the subject speaking about itself. */
export const FIRST_PARTY_PERSPECTIVES: readonly SourcePerspective[] = [
  'FIRST_PARTY_COMPANY',
  'FIRST_PARTY_TECH_PROVIDER',
  'FIRST_PARTY_CONSULTING_FIRM',
  'FIRST_PARTY_CLIENT',
];

export const isFirstParty = (p: SourcePerspective): boolean => FIRST_PARTY_PERSPECTIVES.includes(p);

/**
 * Perspectives that can corroborate somebody else's claim.
 *
 * Deliberately an allow-list rather than "not first party". A user-submitted page and
 * an internal document are not independent verification, and treating them as such is
 * how a self-reported number gets promoted to "independently validated" — the exact
 * failure this product exists to prevent.
 */
export const INDEPENDENT_PERSPECTIVES: readonly SourcePerspective[] = [
  'INDEPENDENT_BUSINESS_MEDIA',
  'INDUSTRY_MEDIA',
  'REGULATOR',
  'PUBLIC_INSTITUTION',
  'RESEARCH_INSTITUTION',
  'ACADEMIC_SOURCE',
  'LICENSED_PREMIUM',
];

export const isIndependent = (p: SourcePerspective): boolean =>
  INDEPENDENT_PERSPECTIVES.includes(p);

/** Coarse grouping used for the visible "Perspective" filter. */
export const PERSPECTIVE_FILTER_GROUPS = asEnum([
  'ALL',
  'OFFICIAL_COMPANY',
  'INDEPENDENT_BUSINESS_MEDIA',
  'INDUSTRY_PUBLICATIONS',
  'REGULATORS_AND_PUBLIC_INSTITUTIONS',
  'RESEARCH_AND_ACADEMIA',
  'TECHNOLOGY_PROVIDERS',
  'CONSULTING_AND_PROFESSIONAL_SERVICES',
  'LICENSED_PREMIUM',
  'AUTHORIZED_INTERNAL',
]);
export type PerspectiveFilterGroup = (typeof PERSPECTIVE_FILTER_GROUPS)[number];

export const PERSPECTIVE_GROUP_MEMBERS: Record<
  Exclude<PerspectiveFilterGroup, 'ALL'>,
  readonly SourcePerspective[]
> = {
  OFFICIAL_COMPANY: ['FIRST_PARTY_COMPANY', 'FIRST_PARTY_CLIENT'],
  INDEPENDENT_BUSINESS_MEDIA: ['INDEPENDENT_BUSINESS_MEDIA'],
  INDUSTRY_PUBLICATIONS: ['INDUSTRY_MEDIA'],
  REGULATORS_AND_PUBLIC_INSTITUTIONS: ['REGULATOR', 'PUBLIC_INSTITUTION'],
  RESEARCH_AND_ACADEMIA: ['RESEARCH_INSTITUTION', 'ACADEMIC_SOURCE'],
  TECHNOLOGY_PROVIDERS: ['FIRST_PARTY_TECH_PROVIDER'],
  CONSULTING_AND_PROFESSIONAL_SERVICES: ['FIRST_PARTY_CONSULTING_FIRM'],
  LICENSED_PREMIUM: ['LICENSED_PREMIUM'],
  AUTHORIZED_INTERNAL: ['AUTHORIZED_INTERNAL'],
};

export const SOURCE_TYPES = asEnum([
  'official_newsroom',
  'official_blog',
  'investor_relations',
  'regulatory_filing',
  'annual_report',
  'earnings_release',
  'earnings_transcript',
  'research_report',
  'public_institution',
  'regulator',
  'independent_news',
  'industry_publication',
  'academic_publication',
  'podcast',
  'video',
  'conference_content',
  'licensed_data_provider',
  'user_upload',
  'authorized_internal',
]);
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CONNECTOR_TYPES = asEnum([
  'rss',
  'atom',
  'rest_api',
  'graphql_api',
  'webhook',
  'filing_api',
  'licensed_feed',
  'sitemap_discovery',
  'structured_page',
  'manual_url',
  'uploaded_document',
  'mcp',
  'demo',
]);
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

/**
 * Rights review outcome. `INGEST_REQUIRE_RIGHTS_REVIEW` makes anything other than
 * `approved` or `metadata_only` un-fetchable — being publicly reachable is not
 * permission.
 */
export const RIGHTS_STATUSES = asEnum([
  'approved',
  'metadata_only',
  'pending_review',
  'restricted',
  'denied',
]);
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

/** How much of a document we are permitted to retain. */
export const STORAGE_SCOPES = asEnum(['metadata', 'excerpt', 'full_text']);
export type StorageScope = (typeof STORAGE_SCOPES)[number];

export const CONNECTOR_HEALTH = asEnum(['healthy', 'degraded', 'failing', 'stale', 'disabled']);
export type ConnectorHealth = (typeof CONNECTOR_HEALTH)[number];

// ── Trust and evidence ───────────────────────────────────────────────────────

export const CLAIM_TYPES = asEnum([
  'FACT',
  'INTERPRETATION',
  'HYPOTHESIS',
  'FORECAST',
  'UNVERIFIED_SIGNAL',
]);
export type ClaimType = (typeof CLAIM_TYPES)[number];

/** Only FACT claims may be presented as "verified facts" anywhere in the product. */
export const isFactual = (t: ClaimType): boolean => t === 'FACT';

export const VERIFICATION_STATUSES = asEnum([
  'SINGLE_SOURCE',
  'CORROBORATED',
  'PRIMARY_SOURCE_CONFIRMED',
  'DISPUTED',
  'CORRECTED',
  'RETRACTED',
]);
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EVIDENCE_STRENGTHS = asEnum([
  'QUANTIFIED_PRIMARY_EVIDENCE',
  'UNQUANTIFIED_PRIMARY_EVIDENCE',
  'MULTIPLE_CREDIBLE_SECONDARY_SOURCES',
  'SINGLE_CREDIBLE_SECONDARY_SOURCE',
  'COMPANY_SELF_REPORTING',
  'WEAK_OR_UNVERIFIED_SIGNAL',
]);
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

/** Descending order of strength — index 0 is strongest. Used for sorting and ranking. */
export const EVIDENCE_STRENGTH_RANK: Record<EvidenceStrength, number> = {
  QUANTIFIED_PRIMARY_EVIDENCE: 0,
  UNQUANTIFIED_PRIMARY_EVIDENCE: 1,
  MULTIPLE_CREDIBLE_SECONDARY_SOURCES: 2,
  SINGLE_CREDIBLE_SECONDARY_SOURCE: 3,
  COMPANY_SELF_REPORTING: 4,
  WEAK_OR_UNVERIFIED_SIGNAL: 5,
};

/**
 * Implementation maturity. The hype filter: nothing in the pipeline may promote a case
 * above PILOT without evidence that names deployment scope, and nothing reaches
 * QUANTIFIED_BUSINESS_IMPACT without a quantified outcome in an evidence span.
 */
export const CASE_MATURITIES = asEnum([
  'ANNOUNCED',
  'CONCEPT',
  'PILOT',
  'LIMITED_DEPLOYMENT',
  'SCALED_DEPLOYMENT',
  'QUANTIFIED_BUSINESS_IMPACT',
  'INDEPENDENTLY_VALIDATED_IMPACT',
  'DISCONTINUED_OR_REVERSED',
]);
export type CaseMaturity = (typeof CASE_MATURITIES)[number];

export const CASE_MATURITY_ORDER: Record<CaseMaturity, number> = {
  ANNOUNCED: 1,
  CONCEPT: 2,
  PILOT: 3,
  LIMITED_DEPLOYMENT: 4,
  SCALED_DEPLOYMENT: 5,
  QUANTIFIED_BUSINESS_IMPACT: 6,
  INDEPENDENTLY_VALIDATED_IMPACT: 7,
  DISCONTINUED_OR_REVERSED: 0,
};

// ── Events and signals ───────────────────────────────────────────────────────

export const EVENT_TYPES = asEnum([
  'partnership',
  'product_launch',
  'investment',
  'acquisition',
  'divestiture',
  'leadership_change',
  'financial_result',
  'research_publication',
  'regulation',
  'market_entry',
  'restructuring',
  'technology_deployment',
  'legal_action',
  'sustainability',
  'thought_leadership',
  'other',
]);
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_RELATIONSHIPS = asEnum([
  'follows_up_on',
  'corrects',
  'contradicts',
  'corroborates',
  'duplicates',
  'supersedes',
  'related_to',
]);
export type EventRelationship = (typeof EVENT_RELATIONSHIPS)[number];

export const STRATEGIC_IMPACTS = asEnum(['low', 'moderate', 'high', 'very_high']);
export type StrategicImpact = (typeof STRATEGIC_IMPACTS)[number];

export const STRATEGIC_IMPACT_SCORE: Record<StrategicImpact, number> = {
  low: 0.25,
  moderate: 0.5,
  high: 0.75,
  very_high: 1,
};

/**
 * Why an item is worth the user's attention right now. `new_to_world` and
 * `new_to_user` are deliberately different axes — a 2023 concept the user has never
 * met is legitimately new to them, and a re-announced partnership is not new at all.
 */
export const NOVELTY_KINDS = asEnum([
  'new_to_world',
  'new_to_user',
  'updated_event',
  'repeated_announcement',
  'foundational',
]);
export type NoveltyKind = (typeof NOVELTY_KINDS)[number];

// ── Consulting intelligence dimensions ───────────────────────────────────────

export const BUSINESS_VALUE_LEVERS = asEnum([
  'revenue_growth',
  'margin_improvement',
  'productivity',
  'cost_reduction',
  'working_capital',
  'inventory_reduction',
  'customer_retention',
  'speed_to_market',
  'risk_reduction',
  'compliance',
  'employee_productivity',
  'resilience',
  'innovation',
  'sustainability',
]);
export type BusinessValueLever = (typeof BUSINESS_VALUE_LEVERS)[number];

export const OPERATING_MODEL_DIMENSIONS = asEnum([
  'governance',
  'decision_rights',
  'organization',
  'process',
  'data',
  'technology',
  'talent',
  'incentives',
  'performance_management',
  'funding',
  'change_adoption',
]);
export type OperatingModelDimension = (typeof OPERATING_MODEL_DIMENSIONS)[number];

export const EXECUTIVE_OWNERS = asEnum([
  'CEO',
  'CFO',
  'COO',
  'CIO',
  'CTO',
  'CDO',
  'CMO',
  'CHRO',
  'CSCO',
  'BUSINESS_UNIT_LEADER',
  'TRANSFORMATION_OFFICER',
]);
export type ExecutiveOwner = (typeof EXECUTIVE_OWNERS)[number];

/**
 * Whether a classification came from the text itself or from our interpretation of it.
 * Anything `inferred` must be labelled as interpretation wherever it is shown.
 */
export const CLASSIFICATION_ORIGINS = asEnum(['stated_in_source', 'inferred', 'human_curated']);
export type ClassificationOrigin = (typeof CLASSIFICATION_ORIGINS)[number];

// ── Learning ─────────────────────────────────────────────────────────────────

export const DEPTH_LEVELS = asEnum(['foundation', 'executive', 'expert']);
export type DepthLevel = (typeof DEPTH_LEVELS)[number];

/**
 * A cautious estimate, never an assertion about what a person knows. The user can see
 * and correct every value.
 */
export const KNOWLEDGE_STATES = asEnum([
  'unseen',
  'introduced',
  'explored',
  'understood',
  'applied',
  'needs_refresh',
]);
export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number];

export const KNOWLEDGE_STATE_ORDER: Record<KnowledgeState, number> = {
  unseen: 0,
  introduced: 1,
  explored: 2,
  understood: 3,
  applied: 4,
  needs_refresh: 2,
};

/** How a knowledge-state value was arrived at — shown to the user on request. */
export const KNOWLEDGE_EVIDENCE_KINDS = asEnum([
  'insight_read',
  'learning_unit_completed',
  'knowledge_check_passed',
  'knowledge_check_failed',
  'used_in_meeting_brief',
  'self_assessed',
  'content_saved',
  'repeatedly_skipped',
  'decay',
]);
export type KnowledgeEvidenceKind = (typeof KNOWLEDGE_EVIDENCE_KINDS)[number];

export const LEARNING_CONNECTION_KINDS = asEnum([
  'industry_concept',
  'kpi',
  'capability',
  'business_model',
  'value_chain_stage',
  'technology',
  'trend',
  'operating_model_dimension',
]);
export type LearningConnectionKind = (typeof LEARNING_CONNECTION_KINDS)[number];

// ── Conversation application ─────────────────────────────────────────────────

export const CONVERSATION_APPLICATION_KINDS = asEnum([
  'hypothesis',
  'client_implication',
  'conversation_starter',
  'contrarian_angle',
  'follow_up_question',
]);
export type ConversationApplicationKind = (typeof CONVERSATION_APPLICATION_KINDS)[number];

// ── Companion ────────────────────────────────────────────────────────────────

export const COMPANION_MODES = asEnum([
  'brief_me',
  'explain_it',
  'explore_it',
  'prepare_me',
  'challenge_me',
  'teach_me',
  'capture_reflect',
]);
export type CompanionMode = (typeof COMPANION_MODES)[number];

export const RESPONSE_LENGTHS = asEnum([
  'one_sentence',
  'thirty_seconds',
  'sixty_second_brief',
  'executive_summary',
  'standard',
  'deep_dive',
]);
export type ResponseLength = (typeof RESPONSE_LENGTHS)[number];

/** Roughly how many words each length should produce, for both text and speech. */
export const RESPONSE_LENGTH_BUDGET: Record<ResponseLength, number> = {
  one_sentence: 30,
  thirty_seconds: 75,
  sixty_second_brief: 150,
  executive_summary: 220,
  standard: 400,
  deep_dive: 900,
};

/** Which engine produced a piece of generated text. Surfaced in the UI, always. */
export const GENERATORS = asEnum(['deterministic_extractive', 'llm', 'human_curated', 'seed_demo']);
export type Generator = (typeof GENERATORS)[number];

// ── User feedback and personalisation ────────────────────────────────────────

export const FEEDBACK_KINDS = asEnum([
  'already_knew',
  'new_to_me',
  'need_more_context',
  'changed_my_view',
  'used_in_conversation',
  'not_relevant',
  'save_for_later',
  'challenge_this',
]);
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const INFORMATION_GOALS = asEnum([
  'market_awareness',
  'industry_depth',
  'client_preparation',
  'company_monitoring',
  'competitor_monitoring',
  'technology_monitoring',
  'thought_leadership',
  'business_development',
  'continuous_learning',
]);
export type InformationGoal = (typeof INFORMATION_GOALS)[number];

export const ENTITY_KINDS = asEnum([
  'company',
  'consulting_firm',
  'person',
  'product',
  'offering',
  'technology',
  'institution',
]);
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const WATCHLIST_KINDS = asEnum([
  'company',
  'industry',
  'topic',
  'technology',
  'account',
  'prospect',
  'competitor',
]);
export type WatchlistKind = (typeof WATCHLIST_KINDS)[number];

export const NOTIFICATION_KINDS = asEnum([
  'daily_brief_ready',
  'high_impact_watchlist_event',
  'meeting_prep_ready',
  'important_correction',
  'weekly_learning_review',
  'monthly_state_of_play',
  'saved_search_match',
]);
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const MEMBERSHIP_ROLES = asEnum(['owner', 'admin', 'member', 'viewer']);
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

// ── Operations ───────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = asEnum([
  'rights_validation',
  'ingestion',
  'versioning',
  'normalization',
  'language_detection',
  'duplicate_detection',
  'entity_extraction',
  'entity_resolution',
  'classification',
  'claim_extraction',
  'evidence_linking',
  'event_extraction',
  'event_clustering',
  'contradiction_detection',
  'maturity_classification',
  'signal_generation',
  'insight_generation',
  'learning_connection',
  'conversation_application',
  'quality_evaluation',
]);
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const RUN_STATUSES = asEnum(['pending', 'running', 'succeeded', 'failed', 'skipped']);
export type RunStatus = (typeof RUN_STATUSES)[number];

/**
 * Honest capability reporting. Used by the admin surface and by every UI affordance
 * that depends on an optional integration.
 */
export const INTEGRATION_STATUSES = asEnum([
  'live',
  'fallback_active',
  'not_configured',
  'blocked_by_rights',
  'blocked_by_credentials',
  'disabled',
  'demo_only',
]);
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
