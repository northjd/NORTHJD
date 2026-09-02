/**
 * Classification: event type, case maturity, taxonomy links, value levers.
 *
 * All of it lexicon-driven and all of it labelled `inferred`, because none of it is
 * stated in the source. The UI renders inferred classifications under an
 * "Interpretation" affordance — a reader must always be able to tell what the source
 * said from what we concluded.
 *
 * Case maturity is the hype filter and the rules are asymmetric on purpose: promoting
 * a case requires explicit evidence of deployment or measured outcome, while
 * demotion needs only a hint of reversal.
 */

import {
  type BusinessValueLever,
  type CaseMaturity,
  type EventType,
  type ExecutiveOwner,
  type OperatingModelDimension,
  containsQuantifiedOutcome,
} from '@mios/domain';

const lower = (s: string) => s.toLowerCase();
const hasAny = (text: string, terms: readonly string[]) => terms.some((t) => text.includes(t));

// ── Event type ───────────────────────────────────────────────────────────────

const EVENT_TYPE_RULES: { type: EventType; terms: readonly string[] }[] = [
  { type: 'acquisition', terms: ['acquire', 'acquisition', 'takeover', 'buyout', 'to buy', 'merger'] },
  { type: 'divestiture', terms: ['divest', 'sell its', 'spin-off', 'spin off', 'carve-out'] },
  { type: 'partnership', terms: ['partner', 'partnership', 'alliance', 'collaborat', 'joint venture', 'teams up', 'works with'] },
  { type: 'investment', terms: ['invest', 'funding round', 'series a', 'series b', 'series c', 'raises', 'raised', 'capital injection', 'stake in'] },
  { type: 'product_launch', terms: ['launch', 'unveil', 'introduce', 'new product', 'general availability', 'now available', 'releases'] },
  { type: 'leadership_change', terms: ['appoint', 'named chief', 'steps down', 'resign', 'new ceo', 'new cfo', 'succeed', 'joins as'] },
  { type: 'financial_result', terms: ['quarterly results', 'full-year results', 'earnings', 'revenue rose', 'revenue fell', 'operating profit', 'q1 ', 'q2 ', 'q3 ', 'q4 ', 'half-year'] },
  { type: 'regulation', terms: ['regulator', 'regulation', 'directive', 'legislation', 'compliance deadline', 'fined', 'antitrust', 'ruling', 'act entered'] },
  { type: 'research_publication', terms: ['study finds', 'research paper', 'published research', 'survey of', 'report finds', 'benchmark'] },
  { type: 'technology_deployment', terms: ['deploy', 'rollout', 'roll out', 'implement', 'go live', 'in production', 'migrat'] },
  { type: 'restructuring', terms: ['restructur', 'job cuts', 'layoff', 'redundanc', 'reorganis', 'reorganiz', 'cost programme', 'cost program'] },
  { type: 'market_entry', terms: ['enters the', 'market entry', 'expands into', 'opens in', 'first store in'] },
  { type: 'legal_action', terms: ['lawsuit', 'sues', 'court', 'litigation', 'settlement', 'injunction'] },
  { type: 'sustainability', terms: ['emissions', 'net zero', 'net-zero', 'circular', 'recycl', 'sustainab', 'scope 3'] },
  { type: 'thought_leadership', terms: ['point of view', 'thought leadership', 'white paper', 'perspective on', 'blog post'] },
];

export function classifyEventType(title: string, body: string): EventType {
  const text = lower(`${title} ${title} ${body}`); // title weighted by repetition
  for (const rule of EVENT_TYPE_RULES) {
    if (hasAny(text, rule.terms)) return rule.type;
  }
  return 'other';
}

// ── Case maturity ────────────────────────────────────────────────────────────

const REVERSAL = ['discontinued', 'abandoned', 'scrapped', 'shelved', 'wound down', 'halted', 'cancelled', 'canceled', 'rolled back', 'pulled the plug'];
const SCALED = ['across all', 'group-wide', 'groupwide', 'company-wide', 'all stores', 'all markets', 'globally deployed', 'in production across', 'fully rolled out', 'enterprise-wide', 'at scale'];
const LIMITED = ['in selected', 'select stores', 'initial rollout', 'first phase', 'in two markets', 'in three markets', 'limited release', 'early access', 'beta'];
const PILOT = ['pilot', 'trial', 'proof of concept', 'proof-of-concept', 'poc', 'testing', 'experiment', 'trialling', 'trialing'];
const CONCEPT = ['exploring', 'evaluating', 'considering', 'plans to develop', 'intends to build', 'research project', 'prototype'];

/**
 * @param independentlyConfirmed whether a non-first-party source reported the same
 *   outcome. Required for INDEPENDENTLY_VALIDATED_IMPACT — a company cannot validate
 *   itself.
 */
export function classifyCaseMaturity(
  text: string,
  independentlyConfirmed: boolean,
): { maturity: CaseMaturity; rationale: string } {
  const s = lower(text);

  if (hasAny(s, REVERSAL)) {
    return { maturity: 'DISCONTINUED_OR_REVERSED', rationale: 'The source describes the initiative being stopped or reversed.' };
  }

  const quantified = containsQuantifiedOutcome(text);
  // Noun forms matter as much as verbs here: outcome claims in this register are
  // usually written as "an 18% reduction in markdown rate", not "markdown reduced by
  // 18%". Matching only verbs left every noun-phrased outcome classified as a bare
  // announcement.
  const outcomeLanguage =
    /\b(reduc\w*|increas\w*|improv\w*|cut|saved?|saving\w*|grew|grow\w*|lift\w*|lower\w*|decreas\w*|uplift|gain\w*|fell|rose|declin\w*)\b/.test(
      s,
    );

  if (quantified && outcomeLanguage) {
    return independentlyConfirmed
      ? { maturity: 'INDEPENDENTLY_VALIDATED_IMPACT', rationale: 'A quantified outcome is reported and at least one independent source reports the same result.' }
      : { maturity: 'QUANTIFIED_BUSINESS_IMPACT', rationale: 'A quantified outcome is stated, but only by the party reporting it. Not independently verified.' };
  }
  if (hasAny(s, SCALED)) {
    return { maturity: 'SCALED_DEPLOYMENT', rationale: 'The source describes deployment across the whole organisation or market.' };
  }
  if (hasAny(s, LIMITED)) {
    return { maturity: 'LIMITED_DEPLOYMENT', rationale: 'The source describes deployment limited to selected sites or markets.' };
  }
  if (hasAny(s, PILOT)) {
    return { maturity: 'PILOT', rationale: 'The source describes a pilot or trial.' };
  }
  if (hasAny(s, CONCEPT)) {
    return { maturity: 'CONCEPT', rationale: 'The source describes intent or exploration rather than an implementation.' };
  }
  return { maturity: 'ANNOUNCED', rationale: 'An announcement without stated implementation scope or measured outcome.' };
}

// ── Value levers ─────────────────────────────────────────────────────────────

const LEVER_RULES: { lever: BusinessValueLever; terms: readonly string[] }[] = [
  { lever: 'revenue_growth', terms: ['revenue growth', 'sales growth', 'top-line', 'new revenue', 'cross-sell', 'upsell', 'conversion rate'] },
  { lever: 'margin_improvement', terms: ['margin', 'gross profit', 'markdown', 'full-price sell'] },
  { lever: 'productivity', terms: ['productivity', 'efficiency', 'automat', 'throughput', 'cycle time'] },
  { lever: 'cost_reduction', terms: ['cost reduction', 'cost saving', 'lower costs', 'cost base', 'savings of'] },
  { lever: 'working_capital', terms: ['working capital', 'cash conversion', 'payment terms'] },
  { lever: 'inventory_reduction', terms: ['inventory', 'stock levels', 'overstock', 'stockout', 'availability', 'allocation', 'replenish'] },
  { lever: 'customer_retention', terms: ['retention', 'loyalty', 'churn', 'repeat purchase', 'lifetime value'] },
  { lever: 'speed_to_market', terms: ['speed to market', 'time to market', 'lead time', 'faster launch', 'design-to-shelf'] },
  { lever: 'risk_reduction', terms: ['risk', 'resilience of supply', 'fraud', 'security incident'] },
  { lever: 'compliance', terms: ['compliance', 'regulatory requirement', 'audit', 'reporting obligation', 'csrd', 'gdpr', 'ai act'] },
  { lever: 'employee_productivity', terms: ['employee productivity', 'store associate', 'workforce', 'colleague', 'staff time'] },
  { lever: 'resilience', terms: ['resilience', 'supply chain disruption', 'nearshoring', 'dual sourcing'] },
  { lever: 'innovation', terms: ['innovation', 'r&d', 'new capability', 'research and development'] },
  { lever: 'sustainability', terms: ['sustainab', 'emissions', 'circular', 'recycled', 'net zero', 'net-zero'] },
];

export function classifyValueLevers(text: string, max = 4): BusinessValueLever[] {
  const s = lower(text);
  return LEVER_RULES.filter((r) => hasAny(s, r.terms)).map((r) => r.lever).slice(0, max);
}

// ── Operating model dimensions ───────────────────────────────────────────────

const OM_RULES: { dim: OperatingModelDimension; terms: readonly string[] }[] = [
  { dim: 'governance', terms: ['governance', 'steering', 'oversight', 'board approved'] },
  { dim: 'decision_rights', terms: ['decision rights', 'who decides', 'mandate', 'accountability for', 'ownership of'] },
  { dim: 'organization', terms: ['reorganis', 'reorganiz', 'new unit', 'centre of excellence', 'center of excellence', 'team structure'] },
  { dim: 'process', terms: ['process', 'workflow', 'planning cycle', 'end-to-end'] },
  { dim: 'data', terms: ['data platform', 'data quality', 'data foundation', 'master data', 'data lake', 'data warehouse'] },
  { dim: 'technology', terms: ['platform', 'system', 'software', 'cloud', 'model', 'infrastructure', 'api'] },
  { dim: 'talent', terms: ['talent', 'upskill', 'reskill', 'training', 'hiring', 'capability building'] },
  { dim: 'incentives', terms: ['incentive', 'bonus', 'kpi target', 'performance pay'] },
  { dim: 'performance_management', terms: ['performance management', 'dashboard', 'reporting cadence', 'okr'] },
  { dim: 'funding', terms: ['capex', 'investment of', 'budget', 'funding model'] },
  { dim: 'change_adoption', terms: ['adoption', 'change management', 'rollout to users', 'user uptake', 'training programme'] },
];

export function classifyOperatingModelDimensions(text: string, max = 4): OperatingModelDimension[] {
  const s = lower(text);
  return OM_RULES.filter((r) => hasAny(s, r.terms)).map((r) => r.dim).slice(0, max);
}

// ── Likely executive owner ───────────────────────────────────────────────────

const OWNER_RULES: { owner: ExecutiveOwner; terms: readonly string[] }[] = [
  { owner: 'CFO', terms: ['margin', 'cost', 'capital', 'earnings', 'cash', 'financial reporting', 'working capital'] },
  { owner: 'CIO', terms: ['it landscape', 'erp', 'legacy system', 'integration', 'infrastructure'] },
  { owner: 'CTO', terms: ['engineering', 'architecture', 'model', 'platform', 'developer'] },
  { owner: 'CDO', terms: ['data', 'analytics', 'ai governance', 'data quality'] },
  { owner: 'CMO', terms: ['brand', 'marketing', 'campaign', 'customer acquisition', 'personalis', 'personaliz'] },
  { owner: 'CSCO', terms: ['supply chain', 'logistics', 'sourcing', 'inventory', 'warehouse', 'distribution'] },
  { owner: 'COO', terms: ['operations', 'store operations', 'process', 'productivity', 'fulfilment', 'fulfillment'] },
  { owner: 'CHRO', terms: ['workforce', 'talent', 'employee', 'training', 'hiring'] },
  { owner: 'TRANSFORMATION_OFFICER', terms: ['transformation programme', 'transformation program', 'change programme'] },
  { owner: 'CEO', terms: ['strategy', 'group strategy', 'portfolio', 'acquisition', 'merger'] },
];

export function classifyExecutiveOwners(text: string, max = 3): ExecutiveOwner[] {
  const s = lower(text);
  const scored = OWNER_RULES.map((r) => ({
    owner: r.owner,
    score: r.terms.filter((t) => s.includes(t)).length,
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((r) => r.owner);
}

// ── Strategic impact ─────────────────────────────────────────────────────────

/**
 * A coarse, explainable score. Deliberately not a learned model: an unexplainable
 * importance ranking is exactly the kind of thing this product is supposed to replace.
 */
export function scoreStrategicImpact(input: {
  eventType: EventType;
  maturity: CaseMaturity;
  quantified: boolean;
  entityCount: number;
  independentSourceCount: number;
}): 'low' | 'moderate' | 'high' | 'very_high' {
  let score = 0;

  const typeWeight: Partial<Record<EventType, number>> = {
    acquisition: 3, divestiture: 3, regulation: 3, restructuring: 2, partnership: 2,
    investment: 2, financial_result: 2, technology_deployment: 2, market_entry: 2,
    leadership_change: 1, product_launch: 1, research_publication: 1, legal_action: 2,
    sustainability: 1, thought_leadership: 0, other: 0,
  };
  score += typeWeight[input.eventType] ?? 0;

  if (input.maturity === 'SCALED_DEPLOYMENT') score += 1;
  if (input.maturity === 'QUANTIFIED_BUSINESS_IMPACT') score += 2;
  if (input.maturity === 'INDEPENDENTLY_VALIDATED_IMPACT') score += 3;
  if (input.maturity === 'DISCONTINUED_OR_REVERSED') score += 2; // reversals are news
  if (input.quantified) score += 1;
  if (input.entityCount >= 2) score += 1;
  if (input.independentSourceCount >= 2) score += 1;

  if (score >= 6) return 'very_high';
  if (score >= 4) return 'high';
  if (score >= 2) return 'moderate';
  return 'low';
}

// ── Taxonomy matching ────────────────────────────────────────────────────────

export interface TaxonomyTerm {
  kind: 'industry' | 'topic' | 'technology' | 'capability' | 'value_chain_stage' | 'kpi';
  slug: string;
  name: string;
  /** Extra surface forms; matching is whole-word to avoid "AI" inside "said". */
  aliases: string[];
}

export interface TaxonomyMatch {
  kind: TaxonomyTerm['kind'];
  slug: string;
  confidence: number;
}

export function matchTaxonomy(text: string, terms: TaxonomyTerm[]): TaxonomyMatch[] {
  const s = lower(text);
  const matches: TaxonomyMatch[] = [];

  for (const term of terms) {
    const surfaces = [term.name, ...term.aliases].filter(Boolean);
    let hits = 0;
    for (const surface of surfaces) {
      const needle = lower(surface);
      if (needle.length < 2) continue;
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(needle)}([^\\p{L}\\p{N}]|$)`, 'giu');
      const found = s.match(pattern);
      if (found) hits += found.length;
    }
    if (hits > 0) {
      matches.push({ kind: term.kind, slug: term.slug, confidence: Math.min(0.9, 0.4 + hits * 0.15) });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
