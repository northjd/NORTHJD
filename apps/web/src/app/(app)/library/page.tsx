import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Card, EmptyState, SectionHeading } from '@mios/ui';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const user = await requireUser();

  const saved = await db()
    .select({
      id: schema.savedInsights.id,
      insightId: schema.insights.id,
      headline: schema.insights.headline,
      takeaway: schema.insights.takeaway,
      createdAt: schema.savedInsights.createdAt,
    })
    .from(schema.savedInsights)
    .innerJoin(schema.insights, eq(schema.insights.id, schema.savedInsights.insightId))
    .where(eq(schema.savedInsights.userId, user.userId))
    .orderBy(desc(schema.savedInsights.createdAt))
    .limit(30);

  const notes = await db()
    .select()
    .from(schema.notes)
    .where(eq(schema.notes.userId, user.userId))
    .orderBy(desc(schema.notes.createdAt))
    .limit(30);

  const conversations = await db()
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      mode: schema.conversations.mode,
      hadVoice: schema.conversations.hadVoice,
      updatedAt: schema.conversations.updatedAt,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, user.userId))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(20);

  const briefs = await db()
    .select({
      id: schema.meetings.id,
      title: schema.meetings.title,
      companyName: schema.meetings.companyName,
      createdAt: schema.meetings.createdAt,
    })
    .from(schema.meetings)
    .where(eq(schema.meetings.userId, user.userId))
    .orderBy(desc(schema.meetings.createdAt))
    .limit(20);

  const empty = saved.length + notes.length + conversations.length + briefs.length === 0;

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          Everything you kept. Your notes stay separate from source material throughout.
        </p>
      </header>

      {empty ? (
        <EmptyState
          title="Nothing saved yet"
          body="Save an insight from its page, write a note, build a meeting brief, or have a conversation with the Companion — they all land here."
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {saved.length > 0 ? (
          <section>
            <SectionHeading>Saved insights</SectionHeading>
            <ul className="space-y-2">
              {saved.map((item) => (
                <Card as="li" key={item.id}>
                  <Link href={`/insights/${item.insightId}`} className="text-[14px] font-medium hover:underline underline-offset-2">
                    {item.headline}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-muted)]">{item.takeaway}</p>
                </Card>
              ))}
            </ul>
          </section>
        ) : null}

        {notes.length > 0 ? (
          <section>
            <SectionHeading hint="Your own thinking. Never cited as evidence.">Notes</SectionHeading>
            <ul className="space-y-2">
              {notes.map((note) => (
                <Card as="li" key={note.id}>
                  {note.title ? <p className="text-[14px] font-medium">{note.title}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {note.body.slice(0, 400)}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
                    {note.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </p>
                </Card>
              ))}
            </ul>
          </section>
        ) : null}

        {briefs.length > 0 ? (
          <section>
            <SectionHeading>Meeting briefs</SectionHeading>
            <ul className="space-y-2">
              {briefs.map((brief) => (
                <Card as="li" key={brief.id}>
                  <Link href={`/prepare/${brief.id}`} className="text-[14px] font-medium hover:underline underline-offset-2">
                    {brief.title}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-[var(--text-subtle)]">
                    {brief.companyName} · {brief.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </p>
                </Card>
              ))}
            </ul>
          </section>
        ) : null}

        {conversations.length > 0 ? (
          <section>
            <SectionHeading hint="Transcripts are personal data and are deleted with the conversation.">
              Conversations
            </SectionHeading>
            <ul className="space-y-2">
              {conversations.map((c) => (
                <Card as="li" key={c.id}>
                  <Link href={`/library/conversations/${c.id}`} className="text-[14px] font-medium hover:underline underline-offset-2">
                    {c.title || 'Untitled'}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-[var(--text-subtle)]">
                    {c.mode.replace(/_/g, ' ')}
                    {c.hadVoice ? ' · voice' : ''} · {c.updatedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </p>
                </Card>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
