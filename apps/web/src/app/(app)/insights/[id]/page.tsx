import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getInsightDetail } from '@/lib/queries';
import {
  Badge,
  Card,
  ClaimTypeBadge,
  DemoBadge,
  EvidenceBadge,
  GeneratorBadge,
  InterpretationBlock,
  KnownUnknowns,
  MaturityBadge,
  NoveltyBadge,
  PerspectiveBadge,
  SectionHeading,
  VerificationBadge,
} from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import { parseFilters, toSearchParams } from '@/lib/filters';
import { insightNeighbours } from '@/lib/insight-navigation';
import { sourcePassages, scopeLabel } from '@/lib/source-text';
import { FeedbackBar } from '@/components/feedback-bar';
import { CopyButton } from '@/components/copy-button';
import { AskAboutThis } from '@/components/ask-about-this';

export const dynamic = 'force-dynamic';

export default async function InsightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getInsightDetail(user.workspaceId, id);
  if (!detail) notFound();

  const { insight, event, claims, applications, connections, entities, taxonomy, contradictions } = detail;

  // Reconstruct the list this was opened from, so previous/next walk the same sequence
  // rather than an arbitrary one. Absent filters simply mean the whole corpus.
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const neighbours = await insightNeighbours(user.workspaceId, id, filters);
  const passages = await sourcePassages(id);
  const backToResults = `/explore?${toSearchParams(filters).toString()}`;

  const facts = claims.filter((c) => c.claimType === 'FACT' && c.spanId);
  const otherClaims = claims.filter((c) => c.claimType !== 'FACT');
  const starters = applications.filter((a) => a.kind === 'conversation_starter');
  const implications = applications.filter((a) => a.kind === 'client_implication');
  const hypotheses = applications.filter((a) => a.kind === 'hypothesis');
  const contrarian = applications.filter((a) => a.kind === 'contrarian_angle');

  const executiveSummary = [
    insight.headline,
    '',
    insight.takeaway,
    '',
    `What happened: ${insight.whatHappened}`,
    `Why it matters: ${insight.whyItMatters}`,
    '',
    'Sources:',
    ...[...new Set(claims.map((c) => `- ${c.sourceName}: ${c.documentTitle} (${formatAbsolute(c.publishedAt)}) ${c.documentUrl}`))],
  ].join('\n');

  return (
    <article className="mx-auto max-w-[1100px]">
      {/*
        Where you are in the list you came from, and how to keep moving through it
        without going back and finding your place again.
      */}
      <nav className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[var(--text-subtle)]">
        <Link href="/" className="hover:underline underline-offset-2">
          Today
        </Link>
        <span aria-hidden>/</span>
        {neighbours ? (
          <Link href={backToResults} className="hover:underline underline-offset-2">
            Results
          </Link>
        ) : (
          <span>Insight</span>
        )}

        {neighbours ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="tabular-nums">
              {neighbours.position} of {neighbours.total}
            </span>
            <NeighbourLink
              href={
                neighbours.previous
                  ? `/insights/${neighbours.previous.id}?${toSearchParams(filters).toString()}`
                  : null
              }
              label="Previous"
              title={neighbours.previous?.headline}
              glyph="‹"
            />
            <NeighbourLink
              href={
                neighbours.next
                  ? `/insights/${neighbours.next.id}?${toSearchParams(filters).toString()}`
                  : null
              }
              label="Next"
              title={neighbours.next?.headline}
              glyph="›"
            />
          </span>
        ) : null}
      </nav>

      <header className="mb-6">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <NoveltyBadge novelty={insight.novelty} />
          <MaturityBadge maturity={event.caseMaturity} />
          <EvidenceBadge strength={event.evidenceStrength} />
          <VerificationBadge status={event.verificationStatus} />
          <GeneratorBadge generator={insight.generator} />
          {insight.isDemo ? <DemoBadge /> : null}
        </div>

        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{insight.headline}</h1>
        <p className="mt-2 max-w-[68ch] text-[16px] leading-relaxed text-[var(--text-muted)]">
          {insight.takeaway}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-[var(--text-subtle)]">
          <div>
            <dt className="inline font-medium">Event date: </dt>
            <dd className="inline">{formatAbsolute(event.eventAt)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">First reported: </dt>
            <dd className="inline">{formatAbsolute(event.firstReportedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Sources: </dt>
            <dd className="inline">
              {event.sourceCount} ({event.independentSourceCount} independent)
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Reading time: </dt>
            <dd className="inline">{insight.estimatedReadingMinutes} min</dd>
          </div>
        </dl>

        {entities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entities.map((e) => (
              <Link key={e.id} href={`/explore/companies/${e.slug}`}>
                <Badge tone={e.role === 'subject' ? 'accent' : 'neutral'}>{e.name}</Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-7">
          {/* ── Verified facts ───────────────────────────────────────────── */}
          <section>
            <SectionHeading hint="Sentences taken verbatim from the sources. Every one links to the exact passage it came from.">
              Verified facts
            </SectionHeading>
            {facts.length === 0 ? (
              <p className="text-[14px] text-[var(--text-muted)]">
                No claim from this event met the bar for a verified fact.
              </p>
            ) : (
              <ol className="space-y-3">
                {facts.map((claim, i) => (
                  <li key={claim.claimId} className="label-evidence">
                    <p className="prose-reading text-[15px]">{claim.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ClaimTypeBadge type={claim.claimType} />
                      <PerspectiveBadge perspective={claim.perspective} />
                      <EvidenceBadge strength={claim.evidenceStrength} />
                      {claim.needsReview ? (
                        <Badge tone="alert" title="The source document changed after this claim was extracted.">
                          Needs re-check
                        </Badge>
                      ) : null}
                      <Link
                        href={`/evidence/${claim.claimId}`}
                        className="text-[12px] font-medium text-[var(--accent)] underline underline-offset-2"
                      >
                        View evidence [{i + 1}]
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ── In the source's own words ────────────────────────────────
              Everything above this point is our reading of the material. This is the
              material. People reasonably want to see the text a summary was drawn from
              and then go and read the thing itself, and burying the links at the foot of
              the page made that harder than it needed to be.

              What is stored is an excerpt, not the article — each source's rights policy
              decides how much may be kept — so the link out is the way to the rest, and
              the page says which it is showing. */}
          {passages.length > 0 ? (
            <section>
              <SectionHeading hint="Verbatim from the source, before any interpretation.">
                In the source&rsquo;s own words
              </SectionHeading>

              <div className="grid gap-4">
                {passages.map((p) => (
                  <div key={p.documentId} className="border-l border-[var(--border-strong)] pl-4">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <PerspectiveBadge perspective={p.perspective as never} />
                      <Badge tone="muted">{scopeLabel(p.storedScope)}</Badge>
                    </div>

                    {p.text ? (
                      <blockquote className="prose-reading text-[14px] leading-[1.72]">
                        {p.text}
                      </blockquote>
                    ) : (
                      <p className="text-[13px] text-[var(--text-subtle)]">
                        This source&rsquo;s rights policy permits the headline and link only,
                        so there is no stored text to show.
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-subtle)]">
                      <span>
                        {p.sourceName} · {formatAbsolute(p.publishedAt)}
                      </span>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-medium text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text)]"
                      >
                        Read the full article at {p.sourceName} ↗
                      </a>
                    </div>
                    {p.attribution ? (
                      <p className="mt-1 text-[11px] text-[var(--text-subtle)]">© {p.attribution}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── What changed ─────────────────────────────────────────────── */}
          {insight.whatChanged ? (
            <section>
              <SectionHeading>What changed</SectionHeading>
              <p className="prose-reading">{insight.whatChanged}</p>
            </section>
          ) : null}

          {insight.whatIsGenuinelyNew ? (
            <section>
              <SectionHeading hint="Separating the genuinely new from the re-communicated.">
                What is genuinely new
              </SectionHeading>
              <p className="prose-reading">{insight.whatIsGenuinelyNew}</p>
            </section>
          ) : null}

          {/* ── Why it matters ───────────────────────────────────────────── */}
          <section>
            <SectionHeading>Why it matters</SectionHeading>
            <p className="prose-reading">{insight.whyItMatters}</p>
          </section>

          {/* ── Market context (Depth) ───────────────────────────────────── */}
          <section>
            <SectionHeading hint="Where this sits in the market model.">Market context</SectionHeading>
            <p className="prose-reading">{insight.marketContext}</p>
            {taxonomy.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {taxonomy.map((t) => (
                  <Badge key={`${t.kind}-${t.slug}`} tone="muted" title={`Classification origin: ${t.origin}`}>
                    {t.kind.replace(/_/g, ' ')}: {t.slug}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>

          {/* ── Counter-signals ──────────────────────────────────────────── */}
          {(insight.counterSignals.length > 0 || contradictions.length > 0) && (
            <section>
              <SectionHeading hint="Evidence and considerations that cut the other way.">
                Counter-signals
              </SectionHeading>
              <ul className="space-y-2">
                {contradictions.map((c, i) => (
                  <li key={`c-${i}`} className="rounded border border-alert-500/30 bg-alert-100/50 p-3 text-[14px] dark:bg-alert-700/15">
                    <Badge tone="alert">Sources disagree</Badge>
                    <p className="mt-1.5 leading-relaxed">{c.explanation}</p>
                  </li>
                ))}
                {insight.counterSignals.map((s, i) => (
                  <li key={`s-${i}`} className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Interpretation ───────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading>Consultant perspective</SectionHeading>
            <InterpretationBlock label="Reading">
              <p>{insight.consultantPerspective}</p>
            </InterpretationBlock>

            {implications.length > 0 ? (
              <InterpretationBlock label="Client implications">
                <ul className="space-y-1.5">
                  {implications.map((a) => (
                    <li key={a.id}>{a.text}</li>
                  ))}
                </ul>
              </InterpretationBlock>
            ) : null}

            {hypotheses.length > 0 ? (
              <InterpretationBlock label="Hypotheses">
                <ul className="space-y-1.5">
                  {hypotheses.map((a) => (
                    <li key={a.id}>{a.text}</li>
                  ))}
                </ul>
              </InterpretationBlock>
            ) : null}

            {contrarian.length > 0 ? (
              <InterpretationBlock label="Contrarian angle">
                <ul className="space-y-1.5">
                  {contrarian.map((a) => (
                    <li key={a.id}>{a.text}</li>
                  ))}
                </ul>
              </InterpretationBlock>
            ) : null}
          </section>

          {/* ── Other claims ─────────────────────────────────────────────── */}
          {otherClaims.length > 0 ? (
            <section>
              <SectionHeading hint="Forecasts and interpretations stated by the sources themselves — not facts.">
                Also stated in the sources
              </SectionHeading>
              <ul className="space-y-2.5">
                {otherClaims.slice(0, 8).map((claim) => (
                  <li key={claim.claimId}>
                    <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">{claim.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ClaimTypeBadge type={claim.claimType} />
                      <span className="text-[12px] text-[var(--text-subtle)]">{claim.sourceName}</span>
                      {claim.spanId ? (
                        <Link
                          href={`/evidence/${claim.claimId}`}
                          className="text-[12px] text-[var(--accent)] underline underline-offset-2"
                        >
                          Evidence
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <Card>
            <SectionHeading>Conversation starters</SectionHeading>
            {starters.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">None generated for this item.</p>
            ) : (
              <ol className="space-y-2.5">
                {starters.map((a, i) => (
                  <li key={a.id} className="text-[13px] leading-relaxed">
                    <span className="mr-1 font-semibold text-[var(--text-subtle)]">{i + 1}.</span>
                    {a.text}
                  </li>
                ))}
              </ol>
            )}
            {starters.length > 0 ? (
              <CopyButton
                className="mt-3"
                label="Copy questions"
                text={starters.map((a, i) => `${i + 1}. ${a.text}`).join('\n')}
              />
            ) : null}
          </Card>

          <KnownUnknowns items={insight.knownUnknowns} />

          {connections.length > 0 ? (
            <Card>
              <SectionHeading hint="Fundamentals this connects to.">Learning connections</SectionHeading>
              <ul className="space-y-2">
                {connections.map((c, i) => (
                  <li key={i} className="text-[13px]">
                    <Link
                      href={`/learn?concept=${c.conceptSlug}`}
                      className="font-medium text-[var(--accent)] underline underline-offset-2"
                    >
                      {c.conceptName}
                    </Link>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">
                      {c.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionHeading>Sources</SectionHeading>
            <ul className="space-y-2.5">
              {[...new Map(claims.map((c) => [c.documentId, c])).values()].map((c) => (
                <li key={c.documentId} className="text-[13px]">
                  <a
                    href={c.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-medium underline underline-offset-2"
                  >
                    {c.documentTitle}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <PerspectiveBadge perspective={c.perspective} />
                    <span className="text-[12px] text-[var(--text-subtle)]">
                      {c.sourceName} · {formatAbsolute(c.publishedAt)}
                    </span>
                  </div>
                  {c.requiredAttribution ? (
                    <p className="mt-0.5 text-[11px] text-[var(--text-subtle)]">© {c.requiredAttribution}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <div className="no-print space-y-2">
            <CopyButton label="Copy executive summary" text={executiveSummary} full />
            <AskAboutThis
              insightId={insight.id}
              headline={insight.headline}
              suggestions={[
                'What is genuinely new about this?',
                'Challenge this conclusion.',
                'What should I ask a client about it?',
              ]}
            />
          </div>

          <FeedbackBar insightId={insight.id} />
        </aside>
      </div>
    </article>
  );
}

/** Previous / next through the filtered set. Disabled rather than hidden at the ends,
 *  so the control does not move under the cursor as you walk the list. */
function NeighbourLink({
  href,
  label,
  title,
  glyph,
}: {
  href: string | null;
  label: string;
  title?: string;
  glyph: string;
}) {
  const shared =
    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] transition-colors';
  if (!href) {
    return (
      <span
        aria-disabled
        className={`${shared} border-[var(--border)] text-[var(--text-subtle)] opacity-40`}
      >
        <span aria-hidden>{glyph}</span>
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      title={title}
      className={`${shared} border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]`}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </Link>
  );
}
