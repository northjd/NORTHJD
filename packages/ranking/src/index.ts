/**
 * Ranking and daily brief composition.
 *
 * Two properties matter more than the scoring maths:
 *
 *   1. **Explainability.** Every score contributes a human-readable reason, and the
 *      "Why am I seeing this?" panel is assembled from those reasons rather than
 *      written separately. A ranking nobody can interrogate is exactly what this
 *      product is meant to replace.
 *
 *   2. **Neutrality.** No company, firm or source gets a bonus for being itself.
 *      `WEIGHTS` contains no entity-specific term, and an evaluation case asserts that
 *      a consulting firm's item scores identically to an equivalent item from any
 *      other company.
 *
 * The brief is *finite*: composition stops at the reading budget, and the exploration
 * budget reserves room for things outside the user's stated interests so the feed does
 * not close in on itself.
 */

import {
  CASE_MATURITY_ORDER,
  EVIDENCE_STRENGTH_RANK,
  STRATEGIC_IMPACT_SCORE,
  type CaseMaturity,
  type EvidenceStrength,
  type NoveltyKind,
  type StrategicImpact,
  daysAgo,
} from '@mios/domain';

export interface RankableItem {
  insightId: string;
  eventId: string;
  headline: string;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  strategicImpact: StrategicImpact;
  evidenceStrength: EvidenceStrength;
  caseMaturity: CaseMaturity;
  novelty: NoveltyKind;
  sourceCount: number;
  independentSourceCount: number;
  firstPartyOnly: boolean;
  estimatedMinutes: number;
  isDemo: boolean;

  /** Taxonomy the event was classified into. */
  industrySlugs: string[];
  topicSlugs: string[];
  technologySlugs: string[];
  entityIds: string[];

  /** Concepts this event touches, with the user's current state for each. */
  conceptSlugs: string[];
  knowledgeGapConceptSlugs: string[];

  /** Set when the user has already been shown this insight. */
  alreadyShown: boolean;
  /** Number of prior events the user has seen on the same story. */
  storyRepetitions: number;
}

export interface UserRankingContext {
  industrySlugs: string[];
  topicSlugs: string[];
  technologySlugs: string[];
  watchedEntityIds: string[];
  accountEntityIds: string[];
  /** Active mission, or null. Blended in — never replaces the baseline profile. */
  mission: {
    industrySlugs: string[];
    topicSlugs: string[];
    technologySlugs: string[];
    entityIds: string[];
  } | null;
  /** Cut-off for "what changed since your last visit". */
  lastVisitAt: Date | null;
  readingBudgetMinutes: number;
}

export interface ScoredItem {
  item: RankableItem;
  score: number;
  /** Component contributions, for the admin ranking inspector. */
  components: Record<string, number>;
  /** Sentences shown verbatim under "Why am I seeing this?". */
  reasons: string[];
}

/**
 * Tunable weights. Deliberately a flat, inspectable object rather than a learned
 * model: a consultant must be able to see why an item was chosen and disagree with it.
 */
export const WEIGHTS = {
  industryMatch: 1.6,
  topicMatch: 1.2,
  technologyMatch: 1.0,
  watchlistMatch: 2.2,
  accountMatch: 2.6,
  missionMatch: 1.8,
  knowledgeGap: 1.1,
  strategicImpact: 2.0,
  evidenceStrength: 1.2,
  corroboration: 0.8,
  freshness: 1.5,
  novelty: 1.0,
  maturitySubstance: 0.9,
  firstPartyOnlyPenalty: -0.5,
  repetitionPenalty: -1.4,
  alreadyShownPenalty: -2.5,
  demoPenalty: -0.3,
} as const;

/** Share of the brief reserved for each purpose. Configurable, per the brief spec. */
export const EXPLORATION_BUDGET = {
  coreInterests: 0.6,
  mission: 0.15,
  knowledgeGaps: 0.15,
  adjacent: 0.1,
} as const;

const overlap = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
};

export function scoreItem(
  item: RankableItem,
  ctx: UserRankingContext,
  now: Date = new Date(),
): ScoredItem {
  const components: Record<string, number> = {};
  const reasons: string[] = [];

  const industryHits = overlap(ctx.industrySlugs, item.industrySlugs);
  if (industryHits > 0) {
    components.industryMatch = WEIGHTS.industryMatch * Math.min(1, industryHits / 2);
    reasons.push(
      `It is in ${item.industrySlugs.filter((s) => ctx.industrySlugs.includes(s)).join(', ')}, which you follow.`,
    );
  }

  const topicHits = overlap(ctx.topicSlugs, item.topicSlugs);
  if (topicHits > 0) {
    components.topicMatch = WEIGHTS.topicMatch * Math.min(1, topicHits / 2);
    reasons.push(
      `It touches ${item.topicSlugs.filter((s) => ctx.topicSlugs.includes(s)).join(', ')}.`,
    );
  }

  const techHits = overlap(ctx.technologySlugs, item.technologySlugs);
  if (techHits > 0) {
    components.technologyMatch = WEIGHTS.technologyMatch * Math.min(1, techHits / 2);
  }

  const watchHits = overlap(ctx.watchedEntityIds, item.entityIds);
  if (watchHits > 0) {
    components.watchlistMatch = WEIGHTS.watchlistMatch;
    reasons.push('It involves a company on your watchlist.');
  }

  const accountHits = overlap(ctx.accountEntityIds, item.entityIds);
  if (accountHits > 0) {
    components.accountMatch = WEIGHTS.accountMatch;
    reasons.push('It involves a company you have marked as a priority.');
  }

  if (ctx.mission) {
    const missionHits =
      overlap(ctx.mission.industrySlugs, item.industrySlugs) +
      overlap(ctx.mission.topicSlugs, item.topicSlugs) +
      overlap(ctx.mission.technologySlugs, item.technologySlugs) +
      overlap(ctx.mission.entityIds, item.entityIds);
    if (missionHits > 0) {
      components.missionMatch = WEIGHTS.missionMatch * Math.min(1, missionHits / 2);
      reasons.push('It is relevant to your active mission.');
    }
  }

  const gapHits = overlap(item.conceptSlugs, item.knowledgeGapConceptSlugs);
  if (gapHits > 0) {
    components.knowledgeGap = WEIGHTS.knowledgeGap * Math.min(1, gapHits / 2);
    reasons.push('It connects to a concept you have not covered yet.');
  }

  components.strategicImpact =
    WEIGHTS.strategicImpact * STRATEGIC_IMPACT_SCORE[item.strategicImpact];

  // Strong evidence is worth ranking points; weak evidence should not float to the top
  // on relevance alone.
  const strengthScore = 1 - EVIDENCE_STRENGTH_RANK[item.evidenceStrength] / 5;
  components.evidenceStrength = WEIGHTS.evidenceStrength * strengthScore;

  if (item.independentSourceCount >= 2) {
    components.corroboration = WEIGHTS.corroboration;
    reasons.push(`${item.independentSourceCount} independent sources reported it.`);
  } else if (item.independentSourceCount === 1) {
    components.corroboration = WEIGHTS.corroboration * 0.5;
  }

  const effectiveDate = item.eventAt ?? item.firstReportedAt;
  if (effectiveDate) {
    const age = daysAgo(effectiveDate, now);
    // Half-life of about a week: current without discarding last month entirely.
    components.freshness = WEIGHTS.freshness * Math.exp(-age / 7);
    if (ctx.lastVisitAt && effectiveDate > ctx.lastVisitAt) {
      reasons.push('It is new since your last visit.');
    }
  }

  const noveltyScore: Record<NoveltyKind, number> = {
    new_to_world: 1,
    new_to_user: 0.7,
    updated_event: 0.6,
    foundational: 0.4,
    repeated_announcement: 0,
  };
  components.novelty = WEIGHTS.novelty * noveltyScore[item.novelty];
  if (item.novelty === 'repeated_announcement') {
    reasons.push('Note: this restates an earlier announcement rather than adding anything.');
  }

  // Substance over noise: a measured outcome outranks an announcement, and a reversal
  // outranks both because it is genuinely informative.
  const maturityScore =
    item.caseMaturity === 'DISCONTINUED_OR_REVERSED'
      ? 0.8
      : CASE_MATURITY_ORDER[item.caseMaturity] / 7;
  components.maturitySubstance = WEIGHTS.maturitySubstance * maturityScore;

  if (item.firstPartyOnly) {
    components.firstPartyOnly = WEIGHTS.firstPartyOnlyPenalty;
    reasons.push('Only the company itself has reported this so far.');
  }
  if (item.storyRepetitions > 1) {
    components.repetition =
      WEIGHTS.repetitionPenalty * Math.min(1, (item.storyRepetitions - 1) / 3);
  }
  if (item.alreadyShown) {
    components.alreadyShown = WEIGHTS.alreadyShownPenalty;
  }
  if (item.isDemo) {
    components.demo = WEIGHTS.demoPenalty;
  }

  const score = Object.values(components).reduce((sum, v) => sum + v, 0);

  if (reasons.length === 0) {
    reasons.push(
      'It scored highly on strategic impact and recency, outside your stated interests.',
    );
  }

  return { item, score, components, reasons };
}

export type BriefSection =
  | 'executive_three'
  | 'what_changed'
  | 'industry_signals'
  | 'company_watch'
  | 'tech_radar'
  | 'broader_market'
  | 'adjacent_signal'
  | 'learn_one_thing'
  | 'deep_dive'
  | 'prepare_next';

export interface BriefSlot {
  section: BriefSection;
  scored: ScoredItem;
}

export interface ComposedBrief {
  slots: BriefSlot[];
  estimatedMinutes: number;
  /** How the budget was spent, for the composition audit shown in the UI. */
  composition: Record<string, number>;
  /** Honest note when the brief is short. */
  coverageNote: string;
}

/**
 * Builds a finite brief inside the reading budget.
 *
 * Sections are filled in priority order, each item is used once, and composition stops
 * when the budget is exhausted. A short brief is reported as a short brief — it is
 * never padded, because padding is how "nothing important happened today" becomes
 * eight items of filler.
 */
export function composeBrief(scored: ScoredItem[], ctx: UserRankingContext): ComposedBrief {
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const slots: BriefSlot[] = [];
  let minutes = 0;

  const budget = ctx.readingBudgetMinutes;
  const take = (section: BriefSection, predicate: (s: ScoredItem) => boolean, max: number) => {
    let taken = 0;
    for (const candidate of pool) {
      if (taken >= max) break;
      if (used.has(candidate.item.insightId)) continue;
      if (minutes + candidate.item.estimatedMinutes > budget && slots.length > 0) continue;
      if (!predicate(candidate)) continue;
      used.add(candidate.item.insightId);
      slots.push({ section, scored: candidate });
      minutes += candidate.item.estimatedMinutes;
      taken++;
    }
    return taken;
  };

  const isRecent = (s: ScoredItem) => {
    const date = s.item.eventAt ?? s.item.firstReportedAt;
    if (!date || !ctx.lastVisitAt) return false;
    return date > ctx.lastVisitAt;
  };
  const matchesInterest = (s: ScoredItem) =>
    overlap(ctx.industrySlugs, s.item.industrySlugs) > 0 ||
    overlap(ctx.topicSlugs, s.item.topicSlugs) > 0;

  /**
   * Has this reader told us anything about themselves?
   *
   * Everything below turns on it. With no answers there is nothing to be relevant *to*,
   * and a general brief is the honest result rather than a degraded one.
   */
  const hasPreferences =
    ctx.industrySlugs.length > 0 ||
    ctx.topicSlugs.length > 0 ||
    ctx.technologySlugs.length > 0 ||
    ctx.watchedEntityIds.length > 0 ||
    ctx.accountEntityIds.length > 0 ||
    ctx.mission !== null;

  /** Any connection at all to what the reader asked for. */
  const relevant = (s: ScoredItem) =>
    matchesInterest(s) ||
    overlap(ctx.technologySlugs, s.item.technologySlugs) > 0 ||
    overlap(ctx.watchedEntityIds, s.item.entityIds) > 0 ||
    overlap(ctx.accountEntityIds, s.item.entityIds) > 0 ||
    (ctx.mission
      ? overlap(ctx.mission.industrySlugs, s.item.industrySlugs) +
          overlap(ctx.mission.topicSlugs, s.item.topicSlugs) +
          overlap(ctx.mission.technologySlugs, s.item.technologySlugs) +
          overlap(ctx.mission.entityIds, s.item.entityIds) >
        0
      : false);

  /*
   * The relevance gate.
   *
   * Four sections used to admit anything: `executive_three` took the top three by raw
   * score with the predicate `() => true`, `what_changed` asked only whether an item was
   * new, `tech_radar` took any technology item, and `broader_market` required the item to
   * be *un*related. Someone who chose Fashion & Apparel and nothing else could therefore
   * receive nine unrelated items against two related ones — reported from the live site
   * as tobacco news on a fashion reader's brief, and entirely reproducible.
   *
   * Scoring alone could never fix this. Strategic impact, evidence strength, freshness
   * and novelty together outweigh a single industry match, so a high-impact item from a
   * sector you did not pick will outrank a moderate one you did. Relevance has to gate
   * the pool, not merely tilt it.
   *
   * Applies only to readers who told us something. Without preferences the predicate
   * would exclude everything and the brief would be empty.
   */
  const gated =
    (predicate: (s: ScoredItem) => boolean) =>
    (s: ScoredItem): boolean =>
      hasPreferences ? relevant(s) && predicate(s) : predicate(s);

  const composition: Record<string, number> = {};

  /*
   * The adjacent signal is selected *first*, then displayed last.
   *
   * Filling in display order starves it: the earlier sections consume the whole
   * reading budget and the one slot reserved against filter bubbles silently
   * disappears — exactly the failure the reservation exists to prevent. Display order
   * is controlled by the UI's section ordering, so choosing it early costs nothing.
   */
  const adjacentHeld: BriefSlot[] = [];
  if (hasPreferences) {
    for (const candidate of pool) {
      if (!relevant(candidate)) {
        used.add(candidate.item.insightId);
        adjacentHeld.push({ section: 'adjacent_signal', scored: candidate });
        minutes += candidate.item.estimatedMinutes;
        break;
      }
    }
  }

  composition.executive_three = take(
    'executive_three',
    gated(() => true),
    3,
  );
  composition.what_changed = take('what_changed', gated(isRecent), 2);
  composition.company_watch = take(
    'company_watch',
    (s) => overlap(ctx.watchedEntityIds, s.item.entityIds) > 0,
    2,
  );
  composition.industry_signals = take('industry_signals', matchesInterest, 2);
  composition.tech_radar = take(
    'tech_radar',
    gated(
      (s) => s.item.industrySlugs.includes('technology-ai') || s.item.technologySlugs.length > 0,
    ),
    2,
  );

  /*
   * Broader market is for readers who told us nothing.
   *
   * Its predicate is `!matchesInterest` — it exists to widen a generic brief. For a
   * reader who did state interests, that is a section defined as "things you did not ask
   * for", and one of those is already reserved and labelled as the adjacent signal.
   * Running both meant two unrelated items competing with the two related ones.
   */
  composition.broader_market = hasPreferences
    ? 0
    : take('broader_market', (s) => !matchesInterest(s) && s.item.strategicImpact !== 'low', 1);

  /*
   * Append the held adjacent slot — but only if there is something for it to be adjacent
   * *to*.
   *
   * A reserved slot for one thing outside your interests is a guard against the feed
   * closing in on itself. When nothing relevant was found at all, that same slot becomes
   * a brief consisting entirely of an item you did not ask for, which is the original
   * complaint in miniature: a fashion reader handed a tobacco story. Better to report the
   * gap and show nothing.
   *
   * Chosen before the discretionary sections so the budget could not squeeze it out;
   * released here when it turns out to be the only thing in the brief.
   */
  if (slots.length > 0) {
    slots.push(...adjacentHeld);
    composition.adjacent_signal = adjacentHeld.length;
  } else {
    for (const held of adjacentHeld) minutes -= held.scored.item.estimatedMinutes;
    composition.adjacent_signal = 0;
  }

  /*
   * Two different silences, and they are not interchangeable.
   *
   * With the relevance gate on, an empty brief no longer means the corpus is empty — it
   * means nothing in it touches the areas this reader chose. Saying "no new events were
   * found" there would be false, and would send someone looking for a broken pipeline
   * when the answer is that nobody is publishing about their sector.
   */
  const coverageNote =
    slots.length === 0
      ? hasPreferences
        ? 'Nothing published in the monitored sources touches the areas you chose. That is a gap in our coverage, not a quiet day in your markets.'
        : 'No new events were found in the currently monitored sources.'
      : minutes < budget * 0.5
        ? `Short brief today: ${slots.length} item${slots.length === 1 ? '' : 's'} met the relevance bar from the monitored sources. Nothing has been added to fill the time.`
        : '';

  return { slots, estimatedMinutes: minutes, composition, coverageNote };
}

/**
 * Asserts the neutrality property directly: an item is scored, then re-scored with a
 * different entity, and the two must be identical. Used by the evaluation suite.
 */
export function scoreIsEntityNeutral(
  item: RankableItem,
  ctx: UserRankingContext,
  substituteEntityId: string,
): boolean {
  const a = scoreItem(item, ctx);
  const b = scoreItem({ ...item, entityIds: [substituteEntityId] }, ctx);
  const relevanceKeys = ['watchlistMatch', 'accountMatch', 'missionMatch'];
  const strip = (components: Record<string, number>) =>
    Object.fromEntries(Object.entries(components).filter(([k]) => !relevanceKeys.includes(k)));
  return JSON.stringify(strip(a.components)) === JSON.stringify(strip(b.components));
}
