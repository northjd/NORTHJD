import Link from 'next/link';
import { asc, eq, and } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * Learn — structured, evergreen, and connected to what is happening now.
 *
 * Knowledge state is shown per unit with the reason we hold it, and the user can
 * correct it. A cautious estimate the user can see and override is the only honest
 * form this can take.
 */
export default async function LearnPage() {
  const user = await requireUser();

  const paths = await db()
    .select()
    .from(schema.learningPaths)
    .orderBy(asc(schema.learningPaths.position));

  const units = await db()
    .select({
      id: schema.learningUnits.id,
      slug: schema.learningUnits.slug,
      title: schema.learningUnits.title,
      objective: schema.learningUnits.objective,
      depth: schema.learningUnits.depth,
      pathId: schema.learningUnits.pathId,
      position: schema.learningUnits.position,
      minutes: schema.learningUnits.estimatedMinutes,
      lastReviewedAt: schema.learningUnits.lastReviewedAt,
      hasCheck: schema.learningUnits.knowledgeCheck,
      status: schema.userLearningProgress.status,
    })
    .from(schema.learningUnits)
    .leftJoin(
      schema.userLearningProgress,
      and(
        eq(schema.userLearningProgress.learningUnitId, schema.learningUnits.id),
        eq(schema.userLearningProgress.userId, user.userId),
      ),
    )
    .orderBy(asc(schema.learningUnits.position));

  const states = await db()
    .select({
      slug: schema.learningConcepts.slug,
      name: schema.learningConcepts.name,
      state: schema.userKnowledgeStates.state,
      reason: schema.userKnowledgeStates.reason,
      userAsserted: schema.userKnowledgeStates.userAsserted,
    })
    .from(schema.userKnowledgeStates)
    .innerJoin(schema.learningConcepts, eq(schema.learningConcepts.id, schema.userKnowledgeStates.conceptId))
    .where(eq(schema.userKnowledgeStates.userId, user.userId))
    .limit(40);

  const completed = units.filter((u) => u.status === 'completed').length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Learn</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          Industry fundamentals at three depths. This is the half of the product that compounds:
          news without a model to hang it on does not become competence.
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-subtle)]">
          {completed} of {units.length} units completed
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-7">
          {paths.map((path) => {
            const pathUnits = units.filter((u) => u.pathId === path.id);
            if (pathUnits.length === 0) return null;
            return (
              <section key={path.id}>
                <SectionHeading hint={path.description}>{path.name}</SectionHeading>
                <ol className="space-y-2">
                  {pathUnits.map((unit) => (
                    <Card as="li" key={unit.id}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={unit.depth === 'foundation' ? 'neutral' : unit.depth === 'executive' ? 'accent' : 'verified'}>
                          {unit.depth}
                        </Badge>
                        <Badge tone="muted">{unit.minutes} min</Badge>
                        {unit.hasCheck ? <Badge tone="muted">Knowledge check</Badge> : null}
                        {unit.status === 'completed' ? <Badge tone="verified">Completed</Badge> : null}
                      </div>
                      <h3 className="text-[15px] font-semibold leading-snug">
                        <Link href={`/learn/${unit.slug}`} className="hover:underline underline-offset-2">
                          {unit.title}
                        </Link>
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {unit.objective}
                      </p>
                      {unit.lastReviewedAt ? (
                        <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
                          Last reviewed {formatAbsolute(unit.lastReviewedAt)}
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        <aside className="space-y-4">
          <Card>
            <SectionHeading hint="A cautious estimate, not an assertion. Every row shows why, and you can change it.">
              Your knowledge state
            </SectionHeading>
            {states.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                Nothing recorded yet. Reading insights and marking them as known or new builds this up.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {states.map((s) => (
                  <li key={s.slug} className="text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      <Badge tone={s.state === 'understood' || s.state === 'applied' ? 'verified' : 'muted'}>
                        {s.state.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-subtle)]">
                      {s.reason}
                      {s.userAsserted ? ' (you set this)' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
