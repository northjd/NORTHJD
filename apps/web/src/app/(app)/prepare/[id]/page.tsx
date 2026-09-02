import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, GeneratorBadge, InterpretationBlock, KnownUnknowns, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import { CopyButton } from '@/components/copy-button';

export const dynamic = 'force-dynamic';

interface BriefContent {
  sixtySecondBrief: string;
  whatChanged: { window: string; items: { text: string }[] }[];
  companyContext: { text: string; citationIndexes: number[] }[];
  whatThisCouldMean: string[];
  conversationStarters: string[];
  contrarianAngle: string[];
  knownUnknowns: string[];
  citations: {
    claimId: string;
    documentTitle: string;
    sourceName: string;
    sourceUrl: string | null;
    publishedAt: string | null;
  }[];
  asOf: string;
  insufficientEvidence?: boolean;
  personalNotes?: string;
}

export default async function MeetingBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const meeting = await db().query.meetings.findFirst({
    where: and(eq(schema.meetings.id, id), eq(schema.meetings.userId, user.userId)),
  });
  if (!meeting) notFound();

  const briefs = await db()
    .select()
    .from(schema.meetingBriefs)
    .where(eq(schema.meetingBriefs.meetingId, meeting.id))
    .orderBy(desc(schema.meetingBriefs.createdAt))
    .limit(1);

  const brief = briefs[0];
  if (!brief) notFound();
  const content = brief.content as unknown as BriefContent;

  const copyText = [
    `${meeting.title}`,
    `Prepared ${formatAbsolute(new Date(content.asOf))}`,
    '',
    '60-SECOND BRIEF',
    content.sixtySecondBrief,
    '',
    'VERIFIED FACTS',
    ...content.companyContext.map((f, i) => `${i + 1}. ${f.text}`),
    '',
    'QUESTIONS TO ASK',
    ...content.conversationStarters.map((q, i) => `${i + 1}. ${q}`),
    '',
    'KNOWN UNKNOWNS',
    ...content.knownUnknowns.map((u) => `- ${u}`),
    '',
    'SOURCES',
    ...content.citations.map((c, i) => `[${i + 1}] ${c.documentTitle} — ${c.sourceName} ${c.sourceUrl ?? ''}`),
  ].join('\n');

  return (
    <article className="mx-auto max-w-[900px]">
      <nav className="no-print mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/prepare" className="hover:underline underline-offset-2">Prepare</Link>
        <span className="mx-1.5">/</span>
        <span>Brief</span>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{brief.depth}</Badge>
          <Badge tone="muted">{brief.lookbackDays}-day lookback</Badge>
          <GeneratorBadge generator={brief.generator} />
          {content.insufficientEvidence ? <Badge tone="alert">Insufficient evidence</Badge> : null}
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{meeting.title}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-subtle)]">
          {meeting.companyName}
          {meeting.meetingAt ? ` · meeting ${formatAbsolute(meeting.meetingAt)}` : ''} · prepared{' '}
          {formatAbsolute(new Date(content.asOf))}
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <SectionHeading>60-second brief</SectionHeading>
          <p className="prose-reading">{content.sixtySecondBrief}</p>
        </Card>

        {content.whatChanged.length > 0 ? (
          <section>
            <SectionHeading hint="From this company's own event timeline.">What changed</SectionHeading>
            <div className="space-y-3">
              {content.whatChanged.map((group) => (
                <div key={group.window} className="surface-flat rounded-md p-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
                    Last {group.window}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.companyContext.length > 0 ? (
          <section>
            <SectionHeading hint="Taken verbatim from the sources, with citations.">
              Verified facts
            </SectionHeading>
            <ol className="label-evidence space-y-2">
              {content.companyContext.map((fact, i) => (
                <li key={i} className="text-[14px] leading-relaxed">
                  {fact.text}
                  {fact.citationIndexes.map((ci) => {
                    const citation = content.citations[ci];
                    if (!citation) return null;
                    return (
                      <Link
                        key={ci}
                        href={`/evidence/${citation.claimId}`}
                        className="ml-1 align-super text-[11px] font-semibold text-[var(--accent)]"
                      >
                        [{ci + 1}]
                      </Link>
                    );
                  })}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {content.whatThisCouldMean.length > 0 ? (
          <InterpretationBlock label="What this could mean">
            <ul className="space-y-1.5">
              {content.whatThisCouldMean.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </InterpretationBlock>
        ) : null}

        {content.conversationStarters.length > 0 ? (
          <Card>
            <SectionHeading hint="Specific to what this company has actually done — not generic openers.">
              Questions to ask
            </SectionHeading>
            <ol className="space-y-2.5">
              {content.conversationStarters.map((question, i) => (
                <li key={i} className="text-[14px] leading-relaxed">
                  <span className="mr-1.5 font-semibold text-[var(--text-subtle)]">{i + 1}.</span>
                  {question}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        {content.contrarianAngle.length > 0 ? (
          <InterpretationBlock label="Contrarian angle">
            <ul className="space-y-1.5">
              {content.contrarianAngle.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </InterpretationBlock>
        ) : null}

        <KnownUnknowns items={content.knownUnknowns} />

        {content.personalNotes ? (
          <Card>
            <SectionHeading hint="Yours. Stored separately from source material and never cited as evidence.">
              Your notes
            </SectionHeading>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{content.personalNotes}</p>
          </Card>
        ) : null}

        {content.citations.length > 0 ? (
          <Card>
            <SectionHeading>Sources</SectionHeading>
            <ol className="space-y-1.5">
              {content.citations.map((citation, i) => (
                <li key={i} className="text-[13px]">
                  <span className="font-semibold">[{i + 1}]</span>{' '}
                  <a
                    href={citation.sourceUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2"
                  >
                    {citation.documentTitle}
                  </a>{' '}
                  <span className="text-[var(--text-subtle)]">
                    — {citation.sourceName}
                    {citation.publishedAt
                      ? ` · ${new Date(citation.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}`
                      : ''}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        <div className="no-print flex flex-wrap gap-2">
          <CopyButton label="Copy brief" text={copyText} />
          <CopyButton
            label="Copy questions only"
            text={content.conversationStarters.map((q, i) => `${i + 1}. ${q}`).join('\n')}
          />
        </div>
      </div>
    </article>
  );
}
