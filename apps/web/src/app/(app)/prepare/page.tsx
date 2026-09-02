import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Card, SectionHeading } from '@mios/ui';
import { MeetingForm } from '@/components/meeting-form';

export const dynamic = 'force-dynamic';

export default async function PreparePage() {
  const user = await requireUser();

  const companies = await db()
    .select({ id: schema.entities.id, name: schema.entities.name, slug: schema.entities.slug })
    .from(schema.entities)
    .where(eq(schema.entities.kind, 'company'))
    .orderBy(schema.entities.name);

  const meetings = await db()
    .select({
      id: schema.meetings.id,
      title: schema.meetings.title,
      companyName: schema.meetings.companyName,
      meetingAt: schema.meetings.meetingAt,
      createdAt: schema.meetings.createdAt,
    })
    .from(schema.meetings)
    .where(eq(schema.meetings.userId, user.userId))
    .orderBy(desc(schema.meetings.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Prepare</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          A brief for one specific conversation: what changed, what is actually evidenced, what is
          only inference, five specific questions, one contrarian angle, and what the sources cannot
          tell you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <MeetingForm companies={companies} />

        <aside>
          <Card>
            <SectionHeading>Recent briefs</SectionHeading>
            {meetings.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">No briefs yet.</p>
            ) : (
              <ul className="space-y-2">
                {meetings.map((m) => (
                  <li key={m.id} className="text-[13px]">
                    <Link href={`/prepare/${m.id}`} className="font-medium hover:underline underline-offset-2">
                      {m.title}
                    </Link>
                    <p className="text-[11px] text-[var(--text-subtle)]">
                      {m.companyName} · {m.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
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
