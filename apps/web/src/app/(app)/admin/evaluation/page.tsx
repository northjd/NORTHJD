import { requireAdmin } from '@/lib/session';
import { Badge, Card, SectionHeading } from '@mios/ui';
import { runEvaluation } from '@mios/evaluation';

export const dynamic = 'force-dynamic';

/**
 * Evaluation dashboard.
 *
 * Runs the suite live against the current database rather than showing a stored
 * score, so the number on screen is true of the code as it is now.
 */
export default async function EvaluationPage() {
  await requireAdmin();
  const results = await runEvaluation();

  const bySuite = new Map<string, typeof results.cases>();
  for (const c of results.cases) {
    bySuite.set(c.suite, [...(bySuite.get(c.suite) ?? []), c]);
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Evaluation</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          Properties the product must hold, checked against the live database. These are invariants,
          not benchmarks — a failure here means something is wrong now.
        </p>
      </header>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[28px] font-semibold tabular-nums">
            {results.passed}/{results.total}
          </p>
          <Badge tone={results.passed === results.total ? 'verified' : 'alert'}>
            {results.passed === results.total ? 'All checks pass' : `${results.total - results.passed} failing`}
          </Badge>
        </div>
      </Card>

      {[...bySuite.entries()].map(([suite, cases]) => (
        <Card key={suite}>
          <SectionHeading>{suite.replace(/_/g, ' ')}</SectionHeading>
          <ul className="space-y-2.5">
            {cases.map((c) => (
              <li key={c.slug}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium">{c.name}</span>
                  <Badge tone={c.passed ? 'verified' : 'alert'}>{c.passed ? 'pass' : 'fail'}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">{c.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
