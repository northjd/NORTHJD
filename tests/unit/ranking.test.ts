import { describe, expect, it } from 'vitest';
import {
  composeBrief,
  scoreItem,
  scoreIsEntityNeutral,
  type RankableItem,
  type UserRankingContext,
} from '@mios/ranking';

const item = (over: Partial<RankableItem> = {}): RankableItem => ({
  insightId: over.insightId ?? 'i1',
  eventId: 'e1',
  headline: 'A development',
  eventAt: new Date(),
  firstReportedAt: new Date(),
  strategicImpact: 'moderate',
  evidenceStrength: 'SINGLE_CREDIBLE_SECONDARY_SOURCE',
  caseMaturity: 'ANNOUNCED',
  novelty: 'new_to_world',
  sourceCount: 1,
  independentSourceCount: 1,
  firstPartyOnly: false,
  estimatedMinutes: 2,
  isDemo: false,
  industrySlugs: [],
  topicSlugs: [],
  technologySlugs: [],
  entityIds: [],
  conceptSlugs: [],
  knowledgeGapConceptSlugs: [],
  alreadyShown: false,
  storyRepetitions: 0,
  ...over,
});

const ctx = (over: Partial<UserRankingContext> = {}): UserRankingContext => ({
  industrySlugs: ['retail'],
  topicSlugs: ['artificial-intelligence'],
  technologySlugs: [],
  watchedEntityIds: [],
  accountEntityIds: [],
  mission: null,
  lastVisitAt: null,
  readingBudgetMinutes: 12,
  ...over,
});

describe('ranking neutrality', () => {
  it('scores an item identically whichever company it involves', () => {
    const base = item({ entityIds: ['accenture'] });
    expect(scoreIsEntityNeutral(base, ctx(), 'hm-group')).toBe(true);
    expect(scoreItem(base, ctx()).score).toBeCloseTo(
      scoreItem({ ...base, entityIds: ['hm-group'] }, ctx()).score,
      10,
    );
  });

  it('boosts an item only because it is watched, not because of who it is', () => {
    const consulting = item({ entityIds: ['accenture'] });
    const watched = ctx({ watchedEntityIds: ['accenture'] });
    expect(scoreItem(consulting, watched).score).toBeGreaterThan(
      scoreItem(consulting, ctx()).score,
    );
  });
});

describe('ranking explanations', () => {
  it('always gives at least one reason', () => {
    expect(scoreItem(item(), ctx()).reasons.length).toBeGreaterThan(0);
  });

  it('names the matched industry', () => {
    const scored = scoreItem(item({ industrySlugs: ['retail'] }), ctx());
    expect(scored.reasons.join(' ')).toContain('retail');
  });

  it('warns when only the company itself has reported something', () => {
    const scored = scoreItem(item({ firstPartyOnly: true, independentSourceCount: 0 }), ctx());
    expect(scored.reasons.join(' ')).toMatch(/company itself/i);
  });

  it('flags a restated announcement as adding nothing', () => {
    const scored = scoreItem(item({ novelty: 'repeated_announcement' }), ctx());
    expect(scored.reasons.join(' ')).toMatch(/restates/i);
  });
});

describe('substance over noise', () => {
  it('ranks a measured outcome above an announcement', () => {
    const announced = scoreItem(item({ caseMaturity: 'ANNOUNCED' }), ctx()).score;
    const measured = scoreItem(item({ caseMaturity: 'QUANTIFIED_BUSINESS_IMPACT' }), ctx()).score;
    expect(measured).toBeGreaterThan(announced);
  });

  it('penalises an item the user has already seen', () => {
    expect(scoreItem(item({ alreadyShown: true }), ctx()).score).toBeLessThan(
      scoreItem(item(), ctx()).score,
    );
  });

  it('prefers stronger evidence, all else equal', () => {
    const weak = scoreItem(item({ evidenceStrength: 'WEAK_OR_UNVERIFIED_SIGNAL' }), ctx()).score;
    const strong = scoreItem(
      item({ evidenceStrength: 'QUANTIFIED_PRIMARY_EVIDENCE' }),
      ctx(),
    ).score;
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('brief composition', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    scoreItem(
      item({
        insightId: `i${i}`,
        industrySlugs: i % 2 === 0 ? ['retail'] : ['other'],
        estimatedMinutes: 3,
      }),
      ctx(),
    ),
  );

  it('stays inside the reading budget', () => {
    const brief = composeBrief(many, ctx({ readingBudgetMinutes: 9 }));
    expect(brief.estimatedMinutes).toBeLessThanOrEqual(9);
  });

  it('never repeats an item across sections', () => {
    const brief = composeBrief(many, ctx());
    const ids = brief.slots.map((s) => s.scored.item.insightId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reserves a slot outside the user’s stated interests', () => {
    const brief = composeBrief(many, ctx());
    const adjacent = brief.slots.find((s) => s.section === 'adjacent_signal');
    expect(adjacent).toBeDefined();
    expect(adjacent!.scored.item.industrySlugs).not.toContain('retail');
  });

  it('reports an empty day honestly instead of padding it', () => {
    const brief = composeBrief([], ctx());
    expect(brief.slots).toHaveLength(0);
    expect(brief.coverageNote).toMatch(/No new events were found/);
  });

  it('says so when the day is thin rather than filling the time', () => {
    const brief = composeBrief(many.slice(0, 1), ctx({ readingBudgetMinutes: 20 }));
    expect(brief.coverageNote).toMatch(/Short brief/);
  });

  it('has no section reserved for any company or firm', () => {
    const brief = composeBrief(many, ctx());
    for (const slot of brief.slots) {
      expect(slot.section).not.toMatch(/accenture|consulting|competitor/i);
    }
  });
});
