import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { queryUserStats, readerStanding, type StatValue } from '@/lib/stats-queries';
import { InterpretationBlock } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your numbers' };

/**
 * Your numbers.
 *
 * Counting is the point here, which is why it gets its own tab rather than leaking into
 * the reading surfaces. Same honesty rules as everywhere else: every figure comes from a
 * stored row, nothing is a streak, nothing is a rank, and a zero means you have not done
 * the thing rather than that you are behind.
 */
export default async function YouPage() {
  const user = await requireUser();
  const stats = await queryUserStats(user.userId, user.workspaceId);
  const standing = readerStanding(stats);

  const headline: StatValue[] = [stats.readItems, stats.questionsAsked, stats.minutesRead];
  const practice: StatValue[] = [
    stats.briefsCompleted,
    stats.savedInsights,
    stats.notesWritten,
    stats.collections,
    stats.meetingBriefs,
    stats.companiesFollowed,
  ];
  const learning: StatValue[] = [
    stats.learningUnitsDone,
    stats.topicsUnderstood,
    stats.checksPassed,
    stats.voiceSessions,
  ];

  const minutes = stats.minutesRead.value ?? 0;

  return (
    <div className="mx-auto max-w-[860px]">
      <p className="t-eyebrow">Your numbers</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        {standing.title}
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        {standing.body}
      </p>
      {stats.since ? (
        <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
          Since {formatAbsolute(stats.since)}.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
        {headline.map((s) => (
          <div key={s.label} className="bg-[var(--surface-raised)] p-6">
            <p className="text-[38px] font-semibold leading-none tabular-nums tracking-tight">
              {s.value ?? '—'}
            </p>
            <p className="t-section mt-2.5">{s.label}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-subtle)]">{s.note}</p>
          </div>
        ))}
      </div>

      {minutes > 0 ? (
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
          That is roughly{' '}
          <strong className="font-semibold text-[var(--text)]">
            {minutes >= 60
              ? `${Math.round((minutes / 60) * 10) / 10} hours`
              : `${minutes} minutes`}
          </strong>{' '}
          of reading you did on purpose, rather than by scrolling until something stopped
          you. That was the whole idea.
        </p>
      ) : null}

      <StatGrid title="Practice" stats={practice} />
      <StatGrid title="Learning" stats={learning} />

      <section className="mt-10">
        <h2 className="t-rule">Behind everything you read</h2>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
          Not your numbers — the corpus everything above was drawn from. Every fact you saw
          traced back to one of these claims, and to the exact passage inside a stored
          document version.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
          {(
            [
              ['evidenced claims', stats.corpus.claims],
              ['events tracked', stats.corpus.events],
              ['active sources', stats.corpus.sources],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dd className="text-[22px] font-semibold leading-none tabular-nums tracking-tight">
                {value}
              </dd>
              <dt className="t-section mt-1.5">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10">
        <InterpretationBlock label="Why there is no streak here">
          <p>
            No streaks, no scores, no rank against colleagues. Those work by making you
            anxious about a number, and a product whose entire argument is that it only
            claims what the evidence supports should not then invent a metric to nag you
            with. These are counts of things you actually did. If a number is low, that is
            information, not a verdict.
          </p>
        </InterpretationBlock>
      </div>

      <p className="mt-8 text-[12.5px] text-[var(--text-subtle)]">
        Want more in here?{' '}
        <Link href="/" className="underline underline-offset-2 hover:text-[var(--text)]">
          Read today&rsquo;s brief
        </Link>{' '}
        or{' '}
        <Link href="/learn" className="underline underline-offset-2 hover:text-[var(--text)]">
          pick up a learning unit
        </Link>
        .
      </p>
    </div>
  );
}

function StatGrid({ title, stats }: { title: string; stats: StatValue[] }) {
  return (
    <section className="mt-10">
      <h2 className="t-rule">{title}</h2>
      <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[24px] font-semibold leading-none tabular-nums tracking-tight">
              {s.value ?? <span className="text-[14px] text-[var(--text-subtle)]">not tracked</span>}
            </p>
            <p className="t-section mt-2">{s.label}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
              {s.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
