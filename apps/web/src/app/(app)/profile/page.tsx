import { eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser, signOut } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Badge, Card, SectionHeading } from '@mios/ui';
import { getProfile, getActiveMission } from '@/lib/queries';

export const dynamic = 'force-dynamic';

async function signOutAction() {
  'use server';
  await signOut();
  redirect('/login');
}

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.userId, user.workspaceId);
  const mission = await getActiveMission(user.userId, user.workspaceId);

  const states = await db()
    .select({
      name: schema.learningConcepts.name,
      state: schema.userKnowledgeStates.state,
      reason: schema.userKnowledgeStates.reason,
      userAsserted: schema.userKnowledgeStates.userAsserted,
      confidence: schema.userKnowledgeStates.confidence,
    })
    .from(schema.userKnowledgeStates)
    .innerJoin(schema.learningConcepts, eq(schema.learningConcepts.id, schema.userKnowledgeStates.conceptId))
    .where(eq(schema.userKnowledgeStates.userId, user.userId))
    .limit(50);

  return (
    <div className="mx-auto max-w-[800px] space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Profile and preferences</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          {user.name || user.email} · {user.workspaceName} · {user.role}
        </p>
      </header>

      <Card>
        <SectionHeading hint="Long-lived interests. Mission Mode adds a temporary emphasis without overwriting these.">
          Baseline profile
        </SectionHeading>
        {profile ? (
          <dl className="space-y-2 text-[13px]">
            <div>
              <dt className="text-[var(--text-muted)]">Role</dt>
              <dd className="font-medium">{profile.role || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Industries</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {profile.industrySlugs.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Topics</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {profile.topicSlugs.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Daily reading budget</dt>
              <dd className="font-medium">{profile.dailyReadingMinutes} minutes</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Preferred depth</dt>
              <dd className="font-medium">{profile.preferredDepth}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Response language</dt>
              <dd className="font-medium">
                {profile.responseLanguage}
                {profile.keepOriginalTerms ? ' (keep original terminology)' : ''}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">No profile yet.</p>
        )}
      </Card>

      <Card>
        <SectionHeading hint="A temporary emphasis with an expiry. It blends with the baseline rather than replacing it.">
          Mission mode
        </SectionHeading>
        {mission ? (
          <div className="text-[13px]">
            <p className="font-medium">{mission.name}</p>
            <p className="mt-0.5 text-[var(--text-muted)]">{mission.description}</p>
            <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
              Until {mission.endsAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">
            No active mission. Ranking uses your baseline profile only.
          </p>
        )}
      </Card>

      <Card>
        <SectionHeading hint="What the platform believes you know, why, and whether you said so yourself.">
          Knowledge state
        </SectionHeading>
        {states.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {states.map((s, i) => (
              <li key={i} className="text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="flex items-center gap-1.5">
                    <Badge tone={s.userAsserted ? 'verified' : 'muted'}>{s.state.replace(/_/g, ' ')}</Badge>
                    <span className="text-[11px] text-[var(--text-subtle)]">
                      {(s.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-subtle)]">{s.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-[12px] leading-relaxed text-[var(--text-subtle)]">
          These are cautious estimates from your own activity, not assertions about what you know.
          Anything you set yourself takes precedence.
        </p>
      </Card>

      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded border border-[var(--border)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--surface-inset)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
