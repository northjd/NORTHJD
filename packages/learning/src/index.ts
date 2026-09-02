/**
 * Learning support: spaced resurfacing and knowledge-state transitions.
 *
 * The transition rules are deliberately conservative and always produce a reason
 * string, because the user can inspect and override every value.
 */

import { KNOWLEDGE_STATE_ORDER, type KnowledgeEvidenceKind, type KnowledgeState } from '@mios/domain';

export interface StateTransition {
  next: KnowledgeState;
  confidence: number;
  reason: string;
  reviewInDays: number | null;
}

/**
 * Advances a concept's state from one observation.
 *
 * Never jumps more than one level from an inferred signal — reading one article about
 * a KPI is not understanding it. Only explicit user assertions and passed knowledge
 * checks move state decisively.
 */
export function nextKnowledgeState(
  current: KnowledgeState,
  evidence: KnowledgeEvidenceKind,
  conceptLabel: string,
): StateTransition {
  switch (evidence) {
    case 'knowledge_check_passed':
      return {
        next: 'understood',
        confidence: 0.75,
        reason: `You passed the knowledge check for ${conceptLabel}.`,
        reviewInDays: 30,
      };
    case 'knowledge_check_failed':
      return {
        next: 'needs_refresh',
        confidence: 0.4,
        reason: `You answered the knowledge check for ${conceptLabel} incorrectly.`,
        reviewInDays: 3,
      };
    case 'self_assessed':
      return {
        next: 'understood',
        confidence: 0.9,
        reason: 'You told us you know this.',
        reviewInDays: 90,
      };
    case 'used_in_meeting_brief':
      return {
        next: 'applied',
        confidence: 0.7,
        reason: `You used ${conceptLabel} in a meeting brief.`,
        reviewInDays: 60,
      };
    case 'learning_unit_completed':
      return {
        next: KNOWLEDGE_STATE_ORDER[current] >= KNOWLEDGE_STATE_ORDER.explored ? 'understood' : 'explored',
        confidence: 0.6,
        reason: `You completed a learning unit covering ${conceptLabel}.`,
        reviewInDays: 45,
      };
    case 'insight_read':
      return {
        next: current === 'unseen' ? 'introduced' : current,
        confidence: 0.3,
        reason: `You read an insight touching ${conceptLabel}. Reading is not the same as understanding, so this only marks it as introduced.`,
        reviewInDays: 14,
      };
    case 'content_saved':
      return {
        next: current === 'unseen' ? 'introduced' : current,
        confidence: 0.35,
        reason: `You saved content about ${conceptLabel}.`,
        reviewInDays: 21,
      };
    case 'repeatedly_skipped':
      return {
        next: current,
        confidence: 0.2,
        reason: `You have skipped items about ${conceptLabel} several times. This may not be relevant to you.`,
        reviewInDays: null,
      };
    case 'decay':
      return {
        next: 'needs_refresh',
        confidence: 0.3,
        reason: `It has been a while since you engaged with ${conceptLabel}.`,
        reviewInDays: 7,
      };
  }
}

/** Days until a concept should resurface, by state. Not a streak mechanic. */
export function reviewIntervalDays(state: KnowledgeState, reviewCount: number): number {
  const base: Record<KnowledgeState, number> = {
    unseen: 7,
    introduced: 10,
    explored: 21,
    understood: 45,
    applied: 90,
    needs_refresh: 3,
  };
  // Widening interval with each successful review, capped so nothing disappears.
  return Math.min(180, Math.round(base[state] * (1 + reviewCount * 0.5)));
}
