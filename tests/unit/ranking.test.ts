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
    // One clock for both, or the freshness term decays between the two calls and the
    // assertion fails on the time rather than on the entity.
    const now = new Date();
    expect(scoreItem(base, ctx(), now).score).toBeCloseTo(
      scoreItem({ ...base, entityIds: ['hm-group'] }, ctx(), now).score,
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
    // This reader stated interests, so the honest reading of an empty pool is that
    // nothing covers their areas — not that the corpus is empty.
    expect(brief.coverageNote).toMatch(/areas you chose/i);
  });

  it('says the corpus is empty when the reader stated no interests', () => {
    const brief = composeBrief([], ctx({ industrySlugs: [], topicSlugs: [] }));
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

/*
 * Single-industry onboarding.
 *
 * Reported from the live site: a reader who chose Fashion & Apparel and nothing else was
 * shown tobacco news. The cause was in composition rather than scoring — four sections
 * admitted items with no reference to preferences at all, so a high-impact item from an
 * unchosen sector outranked a moderate one from the chosen sector and took a slot.
 */
describe('a reader who chose one industry', () => {
  const fashionOnly = ctx({ industrySlugs: ['fashion-apparel'], topicSlugs: [] });

  /** Five tobacco items that outscore fashion on every non-relevance dimension. */
  const loudTobacco = Array.from({ length: 5 }, (_, i) =>
    item({
      insightId: `tob${i}`,
      industrySlugs: ['tobacco'],
      strategicImpact: 'high',
      evidenceStrength: 'MULTIPLE_CREDIBLE_SECONDARY_SOURCES',
      independentSourceCount: 4,
    }),
  );
  const quietFashion = Array.from({ length: 3 }, (_, i) =>
    item({ insightId: `fash${i}`, industrySlugs: ['fashion-apparel'], strategicImpact: 'low' }),
  );

  const scoreAll = (items: RankableItem[], c: UserRankingContext) =>
    items.map((i) => scoreItem(i, c));

  it('is not handed items from an industry it did not choose', () => {
    const brief = composeBrief(
      scoreAll([...loudTobacco, ...quietFashion], fashionOnly),
      fashionOnly,
    );
    const offTopic = brief.slots.filter(
      (s) =>
        s.section !== 'adjacent_signal' && !s.scored.item.industrySlugs.includes('fashion-apparel'),
    );
    expect(offTopic).toEqual([]);
  });

  it('still leads with the chosen industry when louder news exists elsewhere', () => {
    const brief = composeBrief(
      scoreAll([...loudTobacco, ...quietFashion], fashionOnly),
      fashionOnly,
    );
    const lead = brief.slots.filter((s) => s.section === 'executive_three');
    expect(lead.length).toBeGreaterThan(0);
    for (const slot of lead) {
      expect(slot.scored.item.industrySlugs).toContain('fashion-apparel');
    }
  });

  it('allows exactly one adjacent item, and labels it as such', () => {
    const brief = composeBrief(
      scoreAll([...loudTobacco, ...quietFashion], fashionOnly),
      fashionOnly,
    );
    const adjacent = brief.slots.filter((s) => s.section === 'adjacent_signal');
    expect(adjacent.length).toBeLessThanOrEqual(1);
    // Nothing unrelated may reach the reader through any other section.
    expect(brief.composition.broader_market).toBe(0);
  });

  it('reports an honest gap rather than inventing a brief when its industry is uncovered', () => {
    const brief = composeBrief(scoreAll(loudTobacco, fashionOnly), fashionOnly);
    const core = brief.slots.filter((s) => s.section !== 'adjacent_signal');
    expect(core).toEqual([]);
    expect(brief.coverageNote).toMatch(/areas you chose/i);
  });

  it('is unaffected when the reader chose nothing — a general brief is still general', () => {
    const none = ctx({ industrySlugs: [], topicSlugs: [] });
    const brief = composeBrief(scoreAll([...loudTobacco, ...quietFashion], none), none);
    expect(brief.slots.length).toBeGreaterThan(0);
  });

  it('counts a watched company as relevant even outside the chosen industry', () => {
    const withWatch = ctx({
      industrySlugs: ['fashion-apparel'],
      topicSlugs: [],
      watchedEntityIds: ['pmi'],
    });
    const watched = item({ insightId: 'w1', industrySlugs: ['tobacco'], entityIds: ['pmi'] });
    const brief = composeBrief(scoreAll([watched, ...quietFashion], withWatch), withWatch);
    expect(brief.slots.some((s) => s.scored.item.insightId === 'w1')).toBe(true);
  });
});
