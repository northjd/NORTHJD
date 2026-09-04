import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, SectionHeading } from '@mios/ui';
import { CopyButton } from '@/components/copy-button';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const { db, schema } = await import('@mios/database');
  const rows = await db().select({ id: schema.conversations.id }).from(schema.conversations);
  return rows.map((r) => ({ id: r.id }));
}


/** Searchable transcript, with the structured answer preserved per assistant turn. */
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const conversation = await db().query.conversations.findFirst({
    where: and(eq(schema.conversations.id, id), eq(schema.conversations.userId, user.userId)),
  });
  if (!conversation) notFound();

  const turns = await db()
    .select()
    .from(schema.conversationTurns)
    .where(eq(schema.conversationTurns.conversationId, conversation.id))
    .orderBy(asc(schema.conversationTurns.position));

  const transcript = turns
    .map((t) => `${t.role === 'user' ? 'You' : 'Companion'}: ${t.text}`)
    .join('\n\n');

  return (
    <div className="mx-auto max-w-[860px]">
      <nav className="mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/library" className="hover:underline underline-offset-2">Library</Link>
        <span className="mx-1.5">/</span>
        <span>Transcript</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">{conversation.title || 'Conversation'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{conversation.mode.replace(/_/g, ' ')}</Badge>
          {conversation.hadVoice ? <Badge tone="accent">Included voice</Badge> : null}
          <span className="text-[12px] text-[var(--text-subtle)]">
            {conversation.updatedAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      </header>

      <div className="space-y-3">
        {turns.map((turn) => (
          <Card key={turn.id}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Badge tone={turn.role === 'user' ? 'neutral' : 'accent'}>
                {turn.role === 'user' ? 'You' : 'Companion'}
              </Badge>
              {turn.inputMode === 'voice' ? <Badge tone="muted">voice</Badge> : null}
              {turn.generator ? <Badge tone="muted">{turn.generator.replace(/_/g, ' ')}</Badge> : null}
              {turn.latencyMs ? (
                <span className="text-[11px] text-[var(--text-subtle)]">{turn.latencyMs} ms</span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{turn.text}</p>
            {turn.contextUsed.length > 0 ? (
              <p className="mt-2 text-[11px] text-[var(--text-subtle)]">
                Context used: {turn.contextUsed.map((c) => c.label || c.kind).join(', ')}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="mt-5">
        <CopyButton label="Copy transcript" text={transcript} />
      </div>
    </div>
  );
}
