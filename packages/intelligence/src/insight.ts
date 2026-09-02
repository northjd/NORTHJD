/**
 * Insight assembly.
 *
 * An insight connects the three obligatory dimensions for one event: what happened
 * (Recency), where it sits in the market model (Depth), and what to ask about it
 * (Applicability).
 *
 * Everything here is *assembled*, not written: factual sections reuse claim sentences
 * verbatim, structural sections are composed from the taxonomy, and the applicability
 * sections come from parameterised templates. The result is less elegant than model
 * prose and considerably harder to make untrue — and when a model is configured, the
 * same structure is filled by it and then checked against this evidence.
 */

import {
  type BusinessValueLever,
  type CaseMaturity,
  type EventType,
  type NoveltyKind,
  type OperatingModelDimension,
  formatAbsolute,
  estimateReadingMinutes,
  truncate,
} from '@mios/domain';

export interface InsightClaim {
  id: string;
  text: string;
  claimType: string;
  quantified: boolean;
  evidenceStrength: string;
  isFirstParty: boolean;
  sourceName: string;
}

export interface MarketModelContext {
  industryName: string | null;
  industrySlug: string | null;
  valueChainStageNames: string[];
  kpiNames: string[];
  capabilityNames: string[];
  technologyNames: string[];
}

export interface InsightInput {
  eventTitle: string;
  eventType: EventType;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  maturity: CaseMaturity;
  maturityRationale: string;
  claims: InsightClaim[];
  entityNames: string[];
  primaryEntityName: string | null;
  valueLevers: BusinessValueLever[];
  operatingModelDimensions: OperatingModelDimension[];
  market: MarketModelContext;
  sourceCount: number;
  independentSourceCount: number;
  firstPartyOnly: boolean;
  /** Earlier related events for the same entity, newest first. */
  priorEvents: { title: string; at: Date | null; maturity: CaseMaturity }[];
  contradictions: string[];
  novelty: NoveltyKind;
  /** Monitored-source context for the coverage caveat. */
  coverage: { monitoredSources: number; industriesCovered: number };
}

export interface AssembledInsight {
  headline: string;
  takeaway: string;
  whatHappened: string;
  whatChanged: string;
  whyItMatters: string;
  whatIsGenuinelyNew: string;
  marketContext: string;
  consultantPerspective: string;
  clientImplications: string[];
  knownUnknowns: string[];
  counterSignals: string[];
  conversationStarters: string[];
  hypotheses: string[];
  contrarianAngle: string[];
  estimatedReadingMinutes: number;
}

const LEVER_LABEL: Record<BusinessValueLever, string> = {
  revenue_growth: 'revenue growth',
  margin_improvement: 'margin improvement',
  productivity: 'productivity',
  cost_reduction: 'cost reduction',
  working_capital: 'working capital',
  inventory_reduction: 'inventory productivity',
  customer_retention: 'customer retention',
  speed_to_market: 'speed to market',
  risk_reduction: 'risk reduction',
  compliance: 'compliance',
  employee_productivity: 'employee productivity',
  resilience: 'resilience',
  innovation: 'innovation',
  sustainability: 'sustainability',
};

const OM_LABEL: Record<OperatingModelDimension, string> = {
  governance: 'governance',
  decision_rights: 'decision rights',
  organization: 'organisation design',
  process: 'process',
  data: 'data foundations',
  technology: 'technology',
  talent: 'talent',
  incentives: 'incentives',
  performance_management: 'performance management',
  funding: 'funding',
  change_adoption: 'adoption',
};

const MATURITY_PLAIN: Record<CaseMaturity, string> = {
  ANNOUNCED: 'announced, with no implementation scope stated',
  CONCEPT: 'at concept stage',
  PILOT: 'a pilot',
  LIMITED_DEPLOYMENT: 'deployed in a limited scope',
  SCALED_DEPLOYMENT: 'described as scaled',
  QUANTIFIED_BUSINESS_IMPACT: 'reported with a quantified outcome',
  INDEPENDENTLY_VALIDATED_IMPACT: 'reported with an independently corroborated outcome',
  DISCONTINUED_OR_REVERSED: 'discontinued or reversed',
};

/**
 * Last-resort subject name when no entity resolved.
 *
 * Takes the leading capitalised phrase from the headline — news headlines put the
 * actor first. Falls back to a lower-case generic that reads correctly mid-sentence,
 * because "The company announced" as a sentence fragment looks like a bug.
 */
function subjectFromTitle(title: string): string {
  const match = /^((?:[A-Z][\w&.'-]*)(?:\s+(?:[A-Z][\w&.'-]*|of|and|the|&)){0,3})/.exec(title.trim());
  const candidate = match?.[1]?.trim();
  if (candidate && candidate.split(/\s+/).length <= 4 && candidate.length >= 3) return candidate;
  return 'the organisation involved';
}

const list = (items: string[], conjunction = 'and'): string => {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0]!;
  return `${clean.slice(0, -1).join(', ')} ${conjunction} ${clean.at(-1)}`;
};

export function assembleInsight(input: InsightInput): AssembledInsight {
  const facts = input.claims.filter((c) => c.claimType === 'FACT');
  const subject = input.primaryEntityName ?? input.entityNames[0] ?? subjectFromTitle(input.eventTitle);
  const dateLabel = formatAbsolute(input.eventAt ?? input.firstReportedAt);
  const levers = input.valueLevers.map((l) => LEVER_LABEL[l]);
  const dimensions = input.operatingModelDimensions.map((d) => OM_LABEL[d]);

  // ── Recency ────────────────────────────────────────────────────────────────

  const takeaway = facts[0]?.text ?? input.eventTitle;

  const whatHappened =
    facts.length > 0
      ? facts.slice(0, 3).map((c) => c.text).join(' ')
      : (input.claims[0]?.text ?? input.eventTitle);

  const whatChanged = buildWhatChanged(input, subject, dateLabel);
  const whatIsGenuinelyNew = buildGenuinelyNew(input, subject);

  // ── Depth ──────────────────────────────────────────────────────────────────

  const marketContext = buildMarketContext(input);
  const whyItMatters = buildWhyItMatters(input, levers, dimensions);

  // ── Applicability ──────────────────────────────────────────────────────────

  const conversationStarters = buildConversationStarters(input, subject, levers, dimensions);
  const clientImplications = buildClientImplications(input, subject, levers);
  const hypotheses = buildHypotheses(input, subject, levers);
  const contrarianAngle = buildContrarianAngle(input, subject);

  // ── Trust ──────────────────────────────────────────────────────────────────

  const knownUnknowns = buildKnownUnknowns(input);
  const counterSignals = buildCounterSignals(input);

  const consultantPerspective = [
    `Read as a ${input.eventType.replace(/_/g, ' ')} that is ${MATURITY_PLAIN[input.maturity]}.`,
    input.maturityRationale,
    levers.length > 0 ? `The value levers this would move, if it works, are ${list(levers)}.` : '',
    'This paragraph is our interpretation, not a statement from the source.',
  ]
    .filter(Boolean)
    .join(' ');

  const body = [whatHappened, whatChanged, whyItMatters, marketContext, consultantPerspective].join(' ');

  return {
    headline: truncate(input.eventTitle, 190),
    takeaway: truncate(takeaway, 380),
    whatHappened,
    whatChanged,
    whyItMatters,
    whatIsGenuinelyNew,
    marketContext,
    consultantPerspective,
    clientImplications,
    knownUnknowns,
    counterSignals,
    conversationStarters,
    hypotheses,
    contrarianAngle,
    estimatedReadingMinutes: estimateReadingMinutes(body),
  };
}

function buildWhatChanged(input: InsightInput, subject: string, dateLabel: string): string {
  if (input.priorEvents.length === 0) {
    return `This is the first development on this topic for ${subject} in the monitored sources. Reported ${dateLabel}.`;
  }

  const prior = input.priorEvents[0]!;
  const priorDate = formatAbsolute(prior.at);
  const moved = prior.maturity !== input.maturity;

  return moved
    ? `Previously ${MATURITY_PLAIN[prior.maturity]} (${priorDate}: "${truncate(prior.title, 110)}"). It is now ${MATURITY_PLAIN[input.maturity]}. The change is in stated implementation status, not necessarily in verified outcome.`
    : `Follows "${truncate(prior.title, 110)}" (${priorDate}). Implementation status is unchanged — still ${MATURITY_PLAIN[input.maturity]}.`;
}

function buildGenuinelyNew(input: InsightInput, subject: string): string {
  if (input.novelty === 'repeated_announcement') {
    return `Little. This restates a position ${subject} has already communicated; the monitored sources show no new commitment, scope or outcome.`;
  }
  if (input.novelty === 'updated_event') {
    return 'An existing development has been updated. The change, rather than the original announcement, is what is new.';
  }
  if (input.maturity === 'ANNOUNCED') {
    return 'The announcement itself. No deployment scope or measured outcome is stated, so what is new is the intent, not the result.';
  }
  if (input.maturity === 'QUANTIFIED_BUSINESS_IMPACT' || input.maturity === 'INDEPENDENTLY_VALIDATED_IMPACT') {
    return 'A quantified outcome — which is rarer than an announcement and is the part worth examining.';
  }
  return `A stated move from intent towards implementation: the source describes it as ${MATURITY_PLAIN[input.maturity]}.`;
}

function buildMarketContext(input: InsightInput): string {
  const { market } = input;
  if (!market.industryName) {
    return 'This event is not yet linked to an industry model in this workspace, so no market context is available for it.';
  }

  const parts = [`Industry: ${market.industryName}.`];
  if (market.valueChainStageNames.length > 0) {
    parts.push(`Value chain stage: ${list(market.valueChainStageNames)}.`);
  }
  if (market.kpiNames.length > 0) {
    parts.push(`The KPIs that move in this part of the model are ${list(market.kpiNames)}.`);
  }
  if (market.capabilityNames.length > 0) {
    parts.push(`Capabilities involved: ${list(market.capabilityNames)}.`);
  }
  if (market.technologyNames.length > 0) {
    parts.push(`Technologies referenced: ${list(market.technologyNames)}.`);
  }
  parts.push('These links are classifications we applied, not statements from the source.');
  return parts.join(' ');
}

function buildWhyItMatters(
  input: InsightInput,
  levers: string[],
  dimensions: string[],
): string {
  const parts: string[] = [];

  if (levers.length > 0) {
    parts.push(`If it works, this moves ${list(levers)}.`);
  } else {
    parts.push('The source does not indicate which value lever this is meant to move.');
  }

  if (input.market.kpiNames.length > 0) {
    parts.push(`The measurable expression would be ${list(input.market.kpiNames.slice(0, 3))}.`);
  }
  if (dimensions.length > 0) {
    parts.push(`Delivering it depends on ${list(dimensions)} — not only on the technology.`);
  }
  if (input.firstPartyOnly) {
    parts.push(
      'All reporting so far is first-party, so the strategic significance rests on the company’s own account of it.',
    );
  } else if (input.independentSourceCount >= 2) {
    parts.push(`${input.independentSourceCount} independent sources have reported it, which raises confidence that the event occurred as described — though not that it will deliver the stated benefit.`);
  }

  return parts.join(' ');
}

/**
 * Conversation starters.
 *
 * Specific by construction: every template is parameterised with the actual company,
 * maturity, levers, KPIs and operating-model dimensions from this event. Generic
 * questions ("What are your biggest challenges?") are exactly what this replaces.
 */
function buildConversationStarters(
  input: InsightInput,
  subject: string,
  levers: string[],
  dimensions: string[],
): string[] {
  const out: string[] = [];
  const kpi = input.market.kpiNames[0];
  const lever = levers[0];
  const twoDims = dimensions.length >= 2 ? dimensions.slice(0, 2) : ['decision rights', 'adoption'];
  const stage = input.market.valueChainStageNames[0];

  switch (input.eventType) {
    case 'partnership':
      out.push(
        `The announcement sets out intent rather than deployment. Between ${twoDims[0]} and ${twoDims[1]}, which is the binding constraint on getting from signed agreement to something running in production?`,
      );
      break;
    case 'acquisition':
      out.push(
        `Which capability does this acquisition buy that ${subject} judged it could not build in time — and where does it overlap with what is already running internally?`,
      );
      break;
    case 'technology_deployment':
      out.push(
        `The work is described as ${MATURITY_PLAIN[input.maturity]}. What would have to be true${kpi ? `, in ${kpi} terms,` : ''} to justify taking it to the next stage?`,
      );
      break;
    case 'financial_result':
      out.push(
        `${kpi ? `On ${kpi}: ` : ''}how much of the movement was price, how much mix, and how much genuine cost or productivity change?`,
      );
      break;
    case 'regulation':
      out.push(
        `Which parts of the operating model does this actually bind — reporting, ${twoDims[0]}, or how ${stage ?? 'the front line'} works day to day?`,
      );
      break;
    case 'leadership_change':
      out.push(
        `New leadership usually resets priorities within two quarters. Which of the current commitments do you expect to survive that review?`,
      );
      break;
    case 'product_launch':
      out.push(
        `What has to change on the buyer's side for this to be adopted${lever ? `, and which line of their ${lever} case does it actually improve` : ''}?`,
      );
      break;
    default:
      out.push(
        `What changed internally that made this the right moment for ${subject} to move on this?`,
      );
  }

  if (input.maturity === 'QUANTIFIED_BUSINESS_IMPACT' && input.firstPartyOnly) {
    out.push(
      'The reported figure is self-reported. How is the baseline defined, over what period, and what share is attributable to this initiative rather than to trading conditions?',
    );
  }
  if (input.maturity === 'PILOT' || input.maturity === 'CONCEPT') {
    out.push(
      `Most pilots stall at the same place — ${twoDims[0]}. What is the plan for that, and who owns it?`,
    );
  }
  if (lever && kpi) {
    out.push(`If this delivers on ${lever}, where does that show up first: ${kpi}, or somewhere else?`);
  }
  if (input.firstPartyOnly) {
    out.push(
      'Is there any external evidence of this working at comparable scale, or is the company account the only one so far?',
    );
  }
  if (stage) {
    out.push(`Does this change how ${stage} actually operates, or does it sit alongside the existing process?`);
  }

  return [...new Set(out)].slice(0, 5);
}

function buildClientImplications(
  input: InsightInput,
  subject: string,
  levers: string[],
): string[] {
  const out: string[] = [];
  const lever = levers[0];
  const industry = input.market.industryName;

  if (industry) {
    out.push(
      `Competitors in ${industry} may be asked by their own boards why they are not doing the equivalent — the announcement itself creates internal pressure regardless of whether it works.`,
    );
  }
  if (lever) {
    out.push(`Anyone building a ${lever} case in this space now has a public reference point to be measured against.`);
  }
  if (input.maturity === 'ANNOUNCED' || input.maturity === 'CONCEPT') {
    out.push(
      'Treat this as a signal of direction, not of proven value. Basing a business case on it would mean borrowing an unverified assumption.',
    );
  }
  if (input.maturity === 'DISCONTINUED_OR_REVERSED') {
    out.push(
      'A reversal is unusually informative: the reasons given are worth more than the original announcement was.',
    );
  }
  out.push('These implications are inference, not reported fact.');
  return out.slice(0, 4);
}

function buildHypotheses(input: InsightInput, subject: string, levers: string[]): string[] {
  const out: string[] = [];
  const lever = levers[0];

  if (lever) {
    out.push(
      `Hypothesis: ${subject} is prioritising ${lever} over the alternatives available to it, which would imply pressure on that line specifically. Testable against the next results statement.`,
    );
  }
  if (input.maturity === 'PILOT' || input.maturity === 'ANNOUNCED') {
    out.push(
      `Hypothesis: this stays at its current stage for at least two more quarters. Testable — if no scope expansion is reported by then, the constraint is organisational rather than technical.`,
    );
  }
  if (input.priorEvents.length >= 2) {
    out.push(
      `Hypothesis: this is a sustained programme rather than a one-off, given ${input.priorEvents.length} related developments already on record.`,
    );
  }
  return out.slice(0, 3);
}

function buildContrarianAngle(input: InsightInput, subject: string): string[] {
  const out: string[] = [];

  if (input.firstPartyOnly) {
    out.push(
      `The sceptical reading: this is communications rather than operations. Nothing in the monitored sources independently confirms it, and ${subject} has an interest in the announcement itself.`,
    );
  }
  if (input.maturity === 'ANNOUNCED' || input.maturity === 'PILOT') {
    out.push(
      'The sceptical reading: the hard part is not the technology but the change in how decisions get made, and the announcement says nothing about that.',
    );
  }
  if (input.contradictions.length > 0) {
    out.push(`Sources disagree: ${input.contradictions[0]}`);
  }
  if (out.length === 0) {
    out.push(
      'No specific counter-position is supported by the monitored sources. Absence of contradiction is not confirmation.',
    );
  }
  return out.slice(0, 3);
}

/**
 * The honesty section. Every item is computed from what is actually missing, which is
 * why it is trustworthy — it cannot flatter the data.
 */
function buildKnownUnknowns(input: InsightInput): string[] {
  const out: string[] = [];

  if (input.firstPartyOnly) {
    out.push('No independent source in the monitored set has confirmed this.');
  }
  if (input.sourceCount === 1) {
    out.push('Reported by a single source.');
  }
  if (!input.claims.some((c) => c.quantified)) {
    out.push('No quantified outcome is stated — scope, baseline and measurement period are unknown.');
  }
  if (!input.eventAt) {
    out.push('The source does not state when this happened; only the publication date is known.');
  }
  if (input.maturity === 'ANNOUNCED' || input.maturity === 'CONCEPT') {
    out.push('Deployment scope, timeline and budget are not stated.');
  }
  if (input.market.industryName && input.market.kpiNames.length === 0) {
    out.push('No KPI in the industry model has been linked to this event yet.');
  }
  out.push(
    `Coverage: ${input.coverage.monitoredSources} monitored source${input.coverage.monitoredSources === 1 ? '' : 's'} across ${input.coverage.industriesCovered} industr${input.coverage.industriesCovered === 1 ? 'y' : 'ies'}. Developments outside that set are not visible here.`,
  );
  return out;
}

function buildCounterSignals(input: InsightInput): string[] {
  const out = [...input.contradictions];

  const selfReported = input.claims.filter((c) => c.isFirstParty && c.quantified);
  if (selfReported.length > 0 && input.independentSourceCount === 0) {
    out.push(
      `Quantified results here are self-reported by ${selfReported[0]?.sourceName ?? 'the company'} and carry no independent verification.`,
    );
  }
  const priorReversal = input.priorEvents.find((p) => p.maturity === 'DISCONTINUED_OR_REVERSED');
  if (priorReversal) {
    out.push(`An earlier related initiative was discontinued: "${truncate(priorReversal.title, 100)}".`);
  }
  return out;
}
