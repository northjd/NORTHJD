import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { queryWatchBoard } from '@/lib/watch-queries';
import { Badge, Card, InterpretationBlock, MaturityBadge, PerspectiveBadge } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * Watch — foresight derived from the evidence, not generated from it.
 *
 * Deliberately not called "Predictions". It assigns no probabilities, predicts no
 * figures and asserts no outcomes. Each band answers two questions: why this is
 * unresolved, and what observation would resolve it.
 */

interface Band {
  id: string;
  icon: string;
  title: string;
  why: string;
  falsifier: string;
  count: number;
  body: React.ReactNode;
}

function BandSection({ band }: { band: Band }) {
  return (
    <section className="mb-9">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--surface-inset)] text-[12px]"
        >
          {band.icon}
        </span>
        <h2 className="t-title">{band.title}</h2>
        <Badge tone="muted">{band.count}</Badge>
      </div>
      <p className="t-body mt-1.5 max-w-[74ch]">{band.why}</p>
      <p className="mt-1 max-w-[74ch] text-[12.5px] leading-relaxed text-[var(--accent)]">
        <strong className="font-semibold">What would settle it:</strong> {band.falsifier}
      </p>
      <div className="mt-3">
        {band.count === 0 ? (
          <p className="t-meta">Nothing in this band right now.</p>
        ) : (
          band.body
        )}
      </div>
    </section>
  );
}

export default async function WatchPage() {
  const user = await requireUser();
  const w = await queryWatchBoard(user.workspaceId);

  const eventCard = (
    e: { eventId: string; insightId: string | null; title: string; entityNames: string | null },
    badges: React.ReactNode,
    meta?: React.ReactNode,
  ) => (
    <Card as="li" key={e.eventId} className="card-lift pl-5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">{badges}</div>
      <h3 className="t-heading">
        {e.insightId ? (
          <Link href={`/insights/${e.insightId}`} className="hover:underline underline-offset-2">
            {e.title}
          </Link>
        ) : (
          e.title
        )}
      </h3>
      {e.entityNames ? <p className="t-meta mt-1.5">{e.entityNames}</p> : null}
      {meta}
    </Card>
  );

  const bands: Band[] = [
    {
      id: 'stated',
      icon: '◷',
      title: 'Stated intentions',
      why: 'Things the sources themselves say will happen. These are FORECAST claims — cited, and never presented as fact.',
      falsifier: 'The stated thing happens, or the stated date passes without it.',
      count: w.stated.length,
      body: (
        <ul className="grid gap-3">
          {w.stated.map((s) => (
            <Card as="li" key={s.claimId} className="card-lift pl-5">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="caution" title="A claim about the future, stated by the source.">
                  Forecast
                </Badge>
                <PerspectiveBadge perspective={s.perspective} />
              </div>
              <p className="prose-reading text-[14.5px]">{s.text}</p>
              <div className="t-meta mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                <span>{s.sourceName}</span>
                <span>{formatAbsolute(s.publishedAt)}</span>
                <Link
                  href={`/evidence/${s.claimId}`}
                  className="font-medium text-[var(--accent)] underline underline-offset-2"
                >
                  Evidence
                </Link>
              </div>
            </Card>
          ))}
        </ul>
      ),
    },
    {
      id: 'scale',
      icon: '▲',
      title: 'Awaiting scale',
      why: 'Pilots, concepts and limited deployments with no reported expansion. Most pilots do not scale — the interesting question is which of these do.',
      falsifier:
        'Scope language in the next report: more sites, more markets, or a move to production. Silence past two quarters is itself the answer.',
      count: w.awaitingScale.length,
      body: (
        <ul className="grid gap-3">
          {w.awaitingScale.map((e) =>
            eventCard(
              e,
              <>
                <MaturityBadge maturity={e.caseMaturity} />
                {e.firstPartyOnly ? <Badge tone="caution">Self-reported only</Badge> : null}
                {e.ageDays != null ? <Badge tone="muted">{e.ageDays} days old</Badge> : null}
              </>,
            ),
          )}
        </ul>
      ),
    },
    {
      id: 'unconfirmed',
      icon: '◑',
      title: 'Unconfirmed outcomes',
      why: 'Quantified or scaled claims that only the subject itself has made. Not doubted — unverified, which is a different thing.',
      falsifier:
        'A second, independent source reporting the same figure. Or the company disclosing its baseline and measurement method.',
      count: w.unconfirmed.length,
      body: (
        <ul className="grid gap-3">
          {w.unconfirmed.map((e) =>
            eventCard(
              e,
              <>
                <MaturityBadge maturity={e.caseMaturity} />
                <Badge tone="caution">No independent source</Badge>
              </>,
            ),
          )}
        </ul>
      ),
    },
    {
      id: 'disputed',
      icon: '⚡',
      title: 'Open disagreements',
      why: 'Sources that cannot both be right. Shown as a conflict rather than averaged into a false consensus.',
      falsifier:
        'A correction from one source, a third figure, or a disclosed method that reconciles them.',
      count: w.disputed.length,
      body: (
        <ul className="grid gap-3">
          {w.disputed.map((d) => (
            <Card as="li" key={d.eventId} className="card-lift pl-5">
              <div className="mb-2">
                <Badge tone="alert">Sources disagree</Badge>
              </div>
              <h3 className="t-heading">
                {d.insightId ? (
                  <Link href={`/insights/${d.insightId}`} className="hover:underline underline-offset-2">
                    {d.title}
                  </Link>
                ) : (
                  d.title
                )}
              </h3>
              {d.why ? (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-alert-700 dark:text-alert-100">
                  {d.why}
                </p>
              ) : null}
            </Card>
          ))}
        </ul>
      ),
    },
    {
      id: 'hypotheses',
      icon: '◈',
      title: 'Open hypotheses',
      why: 'Testable propositions derived from the evidence and labelled as interpretation, never as fact.',
      falsifier: 'Stated inline — each carries the observation that would confirm or refute it.',
      count: w.hypotheses.length,
      body: (
        <ul className="grid gap-3">
          {w.hypotheses.map((h, i) => (
            <Card as="li" key={i} className="card-lift pl-5">
              <div className="mb-2">
                <Badge tone="caution" title="A testable proposition we are putting forward — not a fact.">
                  Hypothesis
                </Badge>
              </div>
              <p className="text-[13.5px] leading-relaxed">{h.text}</p>
              <p className="t-meta mt-2">
                from:{' '}
                <Link href={`/insights/${h.insightId}`} className="underline underline-offset-2">
                  {h.headline}
                </Link>
              </p>
            </Card>
          ))}
        </ul>
      ),
    },
    {
      id: 'reversals',
      icon: '▼',
      title: 'Recent reversals',
      why: 'Programmes stopped or rolled back. Usually more informative than the announcement was — the stated reason tells you what the real constraint was.',
      falsifier:
        'Already settled. Read the reason given, and check whether it applies to comparable initiatives you are tracking.',
      count: w.reversals.length,
      body: (
        <ul className="grid gap-3">
          {w.reversals.map((e) =>
            eventCard(
              e,
              <Badge tone="alert">Discontinued</Badge>,
              <p className="t-meta mt-1.5">{formatAbsolute(e.firstReportedAt)}</p>,
            ),
          )}
        </ul>
      ),
    },
    {
      id: 'quiet',
      icon: '○',
      title: 'Quiet on your watchlist',
      why: 'Companies you follow that the monitored sources have said little or nothing about. This is a coverage statement, not a claim that nothing is happening.',
      falsifier:
        'Adding a source for that company. Silence here is about our monitoring, not about them.',
      count: w.quiet.length,
      body: (
        <ul className="grid gap-3 sm:grid-cols-2">
          {w.quiet.map((q) => (
            <Card as="li" key={q.slug} className="card-lift pl-5">
              <h3 className="t-heading text-[15px]">
                <Link href={`/explore/companies/${q.slug}`} className="hover:underline underline-offset-2">
                  {q.name}
                </Link>
              </h3>
              <p className="t-meta mt-1.5">
                {q.events > 0 ? `${q.events} events tracked` : 'no events tracked'} ·{' '}
                {q.lastSeen
                  ? `last seen ${formatAbsolute(q.lastSeen)}`
                  : 'never seen in the monitored sources'}
              </p>
            </Card>
          ))}
        </ul>
      ),
    },
  ];

  const stats = [
    ['Announced, no scope', w.counts.announced],
    ['Pilots awaiting scale', w.counts.pilots],
    ['Measured outcomes', w.counts.measured],
    ['Open disagreements', w.counts.disputed],
    ['Source-stated forecasts', w.counts.forecasts],
  ] as const;

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="hero-wash surface mb-6 p-7">
        <p className="t-eyebrow">Watch</p>
        <h1 className="t-display mt-2">What to watch, and what would settle it</h1>
        <p className="t-lede mt-2 max-w-[70ch]">
          Foresight derived from the evidence, not generated from it. There are no
          probabilities here and no predicted outcomes — every band is a query over what the
          sources actually said, and each one states the observation that would resolve it.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--border)] pt-5">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dd className="text-[25px] font-semibold leading-none tracking-tight tabular-nums">
                {value}
              </dd>
              <dt className="t-section mt-1.5">{label}</dt>
            </div>
          ))}
        </dl>
      </header>

      <div className="mb-8">
        <InterpretationBlock label="What this deliberately does not do">
          <p>
            It assigns no probabilities, predicts no prices or figures, and asserts no
            outcomes. A confidence number this system could not justify would be more damaging
            than no view at all — so what it offers instead is the set of things that are
            unresolved, why each matters, and the specific observation that would resolve it.
            That is what a good analyst hands you.
          </p>
        </InterpretationBlock>
      </div>

      {bands.map((band) => (
        <BandSection key={band.id} band={band} />
      ))}
    </div>
  );
}
