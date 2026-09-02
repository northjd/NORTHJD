import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { CompanionPanel } from '@/components/companion-panel';
import { Card, SectionHeading, StatusBadge } from '@mios/ui';
import { capabilities } from '@mios/config';

export const dynamic = 'force-dynamic';

export default async function CompanionPage() {
  const user = await requireUser();

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
    .limit(15);

  const caps = capabilities().filter((c) => ['ai', 'stt', 'tts'].includes(c.key));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <header className="mb-5">
          <h1 className="text-[24px] font-semibold tracking-tight">Companion</h1>
          <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
            Ask about anything in the monitored sources. Answers separate verified facts from
            interpretation, cite the exact passage behind every factual line, and say so plainly when
            the evidence is not there.
          </p>
        </header>
        <CompanionPanel />
      </div>

      <aside className="space-y-4">
        <Card>
          <SectionHeading>Capabilities</SectionHeading>
          <ul className="space-y-2.5">
            {caps.map((cap) => (
              <li key={cap.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{cap.label}</span>
                  <StatusBadge status={cap.status} />
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">{cap.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading hint="Transcripts are personal data and are deleted with the conversation.">
            Recent conversations
          </SectionHeading>
          {conversations.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">No conversations yet.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li key={c.id} className="text-[13px]">
                  <Link href={`/library/conversations/${c.id}`} className="hover:underline underline-offset-2">
                    {c.title || 'Untitled'}
                  </Link>
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    {c.mode.replace(/_/g, ' ')}
                    {c.hadVoice ? ' · voice' : ''} ·{' '}
                    {c.updatedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
