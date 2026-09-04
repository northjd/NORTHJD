'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { assetPath } from '@/lib/asset-path';
import { readPreferences, hasCompletedSetup } from '@/lib/local-preferences';
import {
  composeBrief,
  scoreItem,
  type RankableItem,
  type ScoredItem,
  type UserRankingContext,
} from '@mios/ranking';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity, EvidenceStrength, NoveltyKind, StrategicImpact } from '@mios/domain';
import {
  Badge,
  Card,
  DemoBadge,
  EvidenceBadge,
  MaturityBadge,
  NoveltyBadge,
  SectionHeading,
  VerificationBadge,
} from '@mios/ui';
import { WhyShown } from '@/components/why-shown';
import { SECTION_META, SECTION_ORDER } from '@/lib/brief-sections';

/**
 * Today, composed in the browser from your own answers.
 *
 * The static export has no server and no profile rows, so the prerendered brief is the
 * one the build machine composed for nobody in particular. This runs the *same* ranking
 * module over the *same* candidate pool, with a context built from what you chose during
 * set-up — so the weights, the section order and the "why am I seeing this?" sentences
 * are identical to the hosted build. Only the machine differs.
 *
 * It renders nothing until the pool has loaded, and falls back to the prerendered brief
 * if anything goes wrong or if you skipped set-up. A generic brief is a reasonable thing
 * to be handed; a blank page is not.
 */

interface PoolItem {
  insightId: string;
  eventId: string;
  headline: string;
  takeaway: string;
  novelty: NoveltyKind;
  estimatedMinutes: number;
  isDemo: boolean;
  eventAt: string | null;
  firstReportedAt: string | null;
  strategicImpact: StrategicImpact;
  evidenceStrength: EvidenceStrength;
  caseMaturity: CaseMaturity;
  verificationStatus: string | null;
  sourceCount: number;
  independentSourceCount: number;
  firstPartyOnly: boolean;
  industrySlugs: string[];
  topicSlugs: string[];
  technologySlugs: string[];
  entityIds: string[];
  conceptSlugs: string[];
}

interface LearningUnit {
  slug: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
}

interface Pool {
  items: PoolItem[];
  entities: { id: string; slug: string; name: string }[];
  learningUnits: LearningUnit[];
}

export function PersonalBrief({ children }: { children: React.ReactNode }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [personalise, setPersonalise] = useState(false);

  useEffect(() => {
    if (!hasCompletedSetup()) return;
    const prefs = readPreferences();
    // Nothing chosen means nothing to personalise with; the generic brief is the honest
    // result of "no preferences", not a degraded one.
    const chose =
      prefs.industries.length > 0 || prefs.topics.length > 0 || prefs.companies.length > 0;
    if (!chose) return;

    setPersonalise(true);
    void fetch(assetPath('/brief-pool.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Pool | null) => data && setPool(data))
      .catch(() => setPersonalise(false));
  }, []);

  if (!personalise) return <>{children}</>;
  if (!pool) {
    return (
      <div className="mx-auto max-w-[760px]">
        <p className="text-[13px] text-[var(--text-subtle)]">Composing your brief…</p>
      </div>
    );
  }

  const prefs = readPreferences();
  const idBySlug = new Map(pool.entities.map((e) => [e.slug, e.id]));
  const entityIds = prefs.companies
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is string => Boolean(id));

  const ctx: UserRankingContext = {
    industrySlugs: prefs.industries,
    topicSlugs: prefs.topics,
    technologySlugs: prefs.technologies,
    watchedEntityIds: entityIds,
    accountEntityIds: entityIds,
    mission: null,
    // Everything in the pool is new to a browser that has never had a profile, so there
    // is no honest "since your last visit" line to draw.
    lastVisitAt: null,
    readingBudgetMinutes: prefs.dailyReadingMinutes,
  };

  const now = new Date();
  const scored: ScoredItem[] = pool.items.map((i) =>
    scoreItem(
      {
        ...i,
        eventAt: i.eventAt ? new Date(i.eventAt) : null,
        firstReportedAt: i.firstReportedAt ? new Date(i.firstReportedAt) : null,
        knowledgeGapConceptSlugs: [],
        alreadyShown: false,
        // No reading history in a browser that has never had a profile.
        storyRepetitions: 0,
      } satisfies RankableItem,
      ctx,
      now,
    ),
  );

  const composed = composeBrief(scored, ctx);
  const byId = new Map(pool.items.map((i) => [i.insightId, i]));

  const bySection = new Map<string, typeof composed.slots>();
  for (const slot of composed.slots) {
    bySection.set(slot.section, [...(bySection.get(slot.section) ?? []), slot]);
  }

  const unit = pool.learningUnits[now.getDate() % Math.max(1, pool.learningUnits.length)];
  const totalMinutes = composed.estimatedMinutes + (unit?.estimatedMinutes ?? 0);

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="min-w-0">
        <header className="mb-6">
          <p className="text-[13px] text-[var(--text-subtle)]">{formatAbsolute(now)}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            {composed.slots.length > 0
              ? `${composed.slots.length} development${composed.slots.length === 1 ? '' : 's'} selected for you`
              : 'Nothing in the monitored sources matches your areas'}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            {composed.slots.length > 0
              ? `About ${totalMinutes} minutes, chosen for the areas you picked during set-up.`
              : composed.coverageNote}
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
            Ranked in this browser from your own answers.{' '}
            <Link href="/profile" className="underline underline-offset-2 hover:text-[var(--text)]">
              Change them
            </Link>
            .
          </p>
        </header>

        {SECTION_ORDER.map((section) => {
          const slots = bySection.get(section);
          if (!slots || slots.length === 0) return null;
          const meta = SECTION_META[section];
          return (
            <section key={section} className="mb-9">
              <SectionHeading hint={meta?.hint}>{meta?.title ?? section}</SectionHeading>
              <ul className="space-y-3">
                {slots.map((slot) => {
                  const item = byId.get(slot.scored.item.insightId);
                  if (!item) return null;
                  return (
                    <Card as="li" key={item.insightId}>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <NoveltyBadge novelty={item.novelty} />
                        <MaturityBadge maturity={item.caseMaturity} />
                        <EvidenceBadge strength={item.evidenceStrength} />
                        {item.verificationStatus === 'DISPUTED' ? (
                          <VerificationBadge status="DISPUTED" />
                        ) : null}
                        {item.firstPartyOnly ? (
                          <Badge tone="caution" title="No independent source has confirmed this.">
                            Self-reported only
                          </Badge>
                        ) : null}
                        {item.isDemo ? <DemoBadge /> : null}
                      </div>

                      <h3 className="text-[17px] font-semibold leading-snug tracking-tight">
                        <Link
                          href={`/insights/${item.insightId}`}
                          className="hover:underline underline-offset-2"
                        >
                          {item.headline}
                        </Link>
                      </h3>

                      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">
                        {item.takeaway}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-subtle)]">
                        <span>Event: {formatAbsolute(item.eventAt)}</span>
                        <span>Published: {formatAbsolute(item.firstReportedAt)}</span>
                        <span>
                          {item.sourceCount} source{item.sourceCount === 1 ? '' : 's'}
                        </span>
                        <span>{item.estimatedMinutes} min</span>
                        <WhyShown reasons={slot.scored.reasons} />
                      </div>
                    </Card>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {unit ? (
          <section className="mb-9">
            <SectionHeading hint={SECTION_META.learn_one_thing!.hint}>
              {SECTION_META.learn_one_thing!.title}
            </SectionHeading>
            <ul className="space-y-3">
              <Card as="li">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">Fundamentals</Badge>
                  <span className="text-[12px] text-[var(--text-subtle)]">
                    {unit.estimatedMinutes} min
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold leading-snug">
                  <Link href={`/learn/${unit.slug}`} className="hover:underline underline-offset-2">
                    {unit.title}
                  </Link>
                </h3>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-muted)]">
                  {unit.objective}
                </p>
              </Card>
            </ul>
          </section>
        ) : null}

        {composed.slots.length === 0 ? (
          <div className="border-l border-caution-500/50 pl-4">
            <p className="max-w-[70ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
              Nothing published in the monitored sources touches the areas you picked. That is a
              statement about our coverage, not about your markets — most sectors here have no
              registered source yet.{' '}
              <Link href="/account" className="underline underline-offset-2">
                See which markets have coverage
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>

      <div className="no-print mt-10 border-t border-[var(--border)] pt-5">
        <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">
          This brief reflects the monitored sources only. It is not a claim about everything that
          happened.
        </p>
      </div>
    </div>
  );
}
