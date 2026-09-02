import Link from 'next/link';
import { requireUser, lastVisitAt, touchLastSeen } from '@/lib/session';
import { ensureTodayBrief, SECTION_META, SECTION_ORDER } from '@/lib/brief';
import { getCoverage, getFeedbackFor } from '@/lib/queries';
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  EvidenceBadge,
  MaturityBadge,
  NoveltyBadge,
  SectionHeading,
  VerificationBadge,
} from '@mios/ui';
import { formatAbsolute, formatRelative } from '@mios/domain';
import { WhyShown } from '@/components/why-shown';
import { BriefProgress } from '@/components/brief-progress';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await requireUser();
  const lastVisit = await lastVisitAt(user.userId);
  const { brief, items } = await ensureTodayBrief(user.userId, user.workspaceId, lastVisit);
  // Read *after* composing the brief, so "since your last visit" used the old value.
  await touchLastSeen(user.userId);

  const insightIds = items.map((i) => i.insightId).filter((id): id is string => id !== null);
  const feedback = await getFeedbackFor(user.userId, insightIds);
  const coverage = await getCoverage();

  const activeSources = coverage.sources.filter((s) => s.isActive && s.health !== 'disabled').length;
  const blockedSources = coverage.sources.filter((s) => s.rightsStatus !== 'approved').length;

  const bySection = new Map<string, typeof items>();
  for (const item of items) {
    bySection.set(item.section, [...(bySection.get(item.section) ?? []), item]);
  }

  const totalMinutes = items.reduce((sum, i) => sum + i.estimatedMinutes, 0);
  const readCount = items.filter((i) => i.readAt !== null).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <header className="mb-6">
          <p className="text-[13px] text-[var(--text-subtle)]">
            {formatAbsolute(new Date())}
            {lastVisit ? ` · last visit ${formatRelative(lastVisit)}` : ' · first visit'}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            {items.length > 0
              ? `${items.length} development${items.length === 1 ? '' : 's'} selected for you`
              : 'Nothing new in the monitored sources'}
          </h1>
          {items.length > 0 ? (
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">
              About {totalMinutes} minute{totalMinutes === 1 ? '' : 's'} · your budget is{' '}
              {brief.readingBudgetMinutes} minutes · the brief ends when you reach the bottom
            </p>
          ) : null}
          {brief.coverageNote ? (
            <p className="mt-2 rounded border border-[var(--border)] bg-[var(--surface-inset)] px-3 py-2 text-[13px] text-[var(--text-muted)]">
              {brief.coverageNote}
            </p>
          ) : null}
        </header>

        {items.length === 0 ? (
          <EmptyState
            title="No new events were found in the currently monitored sources."
            body={`That is a statement about ${activeSources} monitored source${activeSources === 1 ? '' : 's'}, not about the world. Run the pipeline to fetch again, add a source, or ingest a specific URL.`}
            action={
              <Link href="/admin/sources" className="mt-1 text-[13px] font-medium text-[var(--accent)] underline underline-offset-2">
                Review source coverage
              </Link>
            }
          />
        ) : null}

        {SECTION_ORDER.map((section) => {
          const sectionItems = bySection.get(section);
          if (!sectionItems || sectionItems.length === 0) return null;
          const meta = SECTION_META[section]!;

          return (
            <section key={section} className="mb-8">
              <SectionHeading hint={meta.hint}>{meta.title}</SectionHeading>
              <ul className="space-y-3">
                {sectionItems.map((item) =>
                  item.learningUnitId ? (
                    <Card as="li" key={item.id}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="accent">Fundamentals</Badge>
                        <span className="text-[12px] text-[var(--text-subtle)]">
                          {item.estimatedMinutes} min
                        </span>
                      </div>
                      <h3 className="text-[16px] font-semibold leading-snug">
                        <Link href={`/learn/${item.learningUnitSlug}`} className="hover:underline underline-offset-2">
                          {item.learningUnitTitle}
                        </Link>
                      </h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-muted)]">
                        {item.learningUnitObjective}
                      </p>
                    </Card>
                  ) : (
                    <Card as="li" key={item.id}>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <NoveltyBadge novelty={item.novelty!} />
                        <MaturityBadge maturity={item.maturity!} />
                        <EvidenceBadge strength={item.evidenceStrength!} />
                        {item.verificationStatus === 'DISPUTED' ? (
                          <VerificationBadge status="DISPUTED" />
                        ) : null}
                        {item.firstPartyOnly ? (
                          <Badge tone="caution" title="No independent source has confirmed this.">
                            Self-reported only
                          </Badge>
                        ) : null}
                        {item.isDemo ? <DemoBadge /> : null}
                        {feedback.get(item.insightId ?? '')?.includes('already_knew') ? (
                          <Badge tone="muted">You knew this</Badge>
                        ) : null}
                      </div>

                      <h3 className="text-[17px] font-semibold leading-snug tracking-tight">
                        <Link href={`/insights/${item.insightId}`} className="hover:underline underline-offset-2">
                          {item.headline}
                        </Link>
                      </h3>

                      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">
                        {item.takeaway}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-subtle)]">
                        <span title="When the event happened, if the source states it">
                          Event: {formatAbsolute(item.eventAt)}
                        </span>
                        <span title="When it was published">
                          Published: {formatAbsolute(item.firstReportedAt)}
                        </span>
                        <span>{item.sourceCount} source{item.sourceCount === 1 ? '' : 's'}</span>
                        <span>{item.estimatedMinutes} min</span>
                        <WhyShown reasons={item.whyShown} />
                      </div>
                    </Card>
                  ),
                )}
              </ul>
            </section>
          );
        })}

        {items.length > 0 ? (
          <BriefProgress
            briefId={brief.id}
            total={items.length}
            read={readCount}
            completed={brief.state === 'completed'}
          />
        ) : null}
      </div>

      <aside className="no-print space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <SectionHeading>Coverage</SectionHeading>
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Active sources</dt>
              <dd className="font-medium">{activeSources}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Awaiting rights review</dt>
              <dd className="font-medium">{blockedSources}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Evidenced claims</dt>
              <dd className="font-medium">{coverage.totals.claims}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Events tracked</dt>
              <dd className="font-medium">{coverage.totals.events}</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-[var(--border)] pt-2 text-[12px] leading-relaxed text-[var(--text-subtle)]">
            This brief reflects the monitored sources only. It is not a claim about everything that
            happened.
          </p>
          <Link
            href="/admin/coverage"
            className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] underline underline-offset-2"
          >
            Coverage detail
          </Link>
        </Card>

        <Card>
          <SectionHeading>Composition</SectionHeading>
          <p className="mb-2 text-[12px] leading-relaxed text-[var(--text-subtle)]">
            How the brief was assembled. One slot is reserved for a signal outside your stated
            interests.
          </p>
          <ul className="space-y-1 text-[13px]">
            {Object.entries(brief.compositionNote as Record<string, number>)
              .filter(([, n]) => n > 0)
              .map(([section, n]) => (
                <li key={section} className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{SECTION_META[section]?.title ?? section}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
