import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { Badge, Card, ClaimTypeBadge, EvidenceBadge, PerspectiveBadge, SectionHeading } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';

export const dynamic = 'force-dynamic';

/**
 * The bottom of the evidence chain.
 *
 * Shows the claim, the exact character range it was taken from, and that range
 * highlighted inside the surrounding stored text. This is the page that makes every
 * factual statement in the product checkable rather than merely attributed.
 */
export default async function EvidencePage({ params }: { params: Promise<{ claimId: string }> }) {
  await requireUser();
  const { claimId } = await params;

  const rows = await db()
    .select({
      claimId: schema.claims.id,
      claimText: schema.claims.text,
      claimType: schema.claims.claimType,
      evidenceStrength: schema.claims.evidenceStrength,
      verificationStatus: schema.claims.verificationStatus,
      confidence: schema.claims.confidence,
      quantified: schema.claims.quantified,
      needsReview: schema.claims.needsReview,
      reviewReason: schema.claims.reviewReason,
      generator: schema.claims.generator,
      lastVerifiedAt: schema.claims.lastVerifiedAt,
      spanId: schema.evidenceSpans.id,
      startOffset: schema.evidenceSpans.startOffset,
      endOffset: schema.evidenceSpans.endOffset,
      quote: schema.evidenceSpans.quote,
      versionId: schema.documentVersions.id,
      versionNumber: schema.documentVersions.version,
      normalizedText: schema.documentVersions.normalizedText,
      storedScope: schema.documentVersions.storedScope,
      retrievedAt: schema.documentVersions.retrievedAt,
      isCorrection: schema.documentVersions.isCorrection,
      changeSummary: schema.documentVersions.changeSummary,
      documentTitle: schema.rawDocuments.title,
      documentUrl: schema.rawDocuments.url,
      publishedAt: schema.rawDocuments.publishedAt,
      sourceUpdatedAt: schema.rawDocuments.sourceUpdatedAt,
      discoveredAt: schema.rawDocuments.discoveredAt,
      sourceName: schema.sources.name,
      sourceSlug: schema.sources.slug,
      perspective: schema.sources.perspective,
      isDemo: schema.rawDocuments.isDemo,
      attribution: schema.sourcePolicies.requiredAttribution,
      storagePolicy: schema.sourcePolicies.reviewNotes,
    })
    .from(schema.claims)
    .innerJoin(schema.documentVersions, eq(schema.documentVersions.id, schema.claims.documentVersionId))
    .innerJoin(schema.rawDocuments, eq(schema.rawDocuments.id, schema.documentVersions.documentId))
    .innerJoin(schema.sources, eq(schema.sources.id, schema.claims.sourceId))
    .leftJoin(schema.sourcePolicies, eq(schema.sourcePolicies.sourceId, schema.sources.id))
    .leftJoin(schema.claimEvidence, eq(schema.claimEvidence.claimId, schema.claims.id))
    .leftJoin(schema.evidenceSpans, eq(schema.evidenceSpans.id, schema.claimEvidence.evidenceSpanId))
    .where(eq(schema.claims.id, claimId))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const text = row.normalizedText;
  const start = row.startOffset ?? 0;
  const end = row.endOffset ?? 0;
  const windowStart = Math.max(0, start - 600);
  const windowEnd = Math.min(text.length, end + 600);

  const before = text.slice(windowStart, start);
  const highlighted = text.slice(start, end);
  const after = text.slice(end, windowEnd);

  return (
    <div className="mx-auto max-w-[860px]">
      <nav className="mb-4 text-[13px] text-[var(--text-subtle)]">
        <Link href="/" className="hover:underline underline-offset-2">
          Today
        </Link>
        <span className="mx-1.5">/</span>
        <span>Evidence</span>
      </nav>

      <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Evidence for this claim</h1>
      <p className="mb-5 max-w-[68ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
        The exact passage the claim was taken from, in the stored version of the source document.
        Offsets refer to that version, which is immutable — a later edit to the article creates a new
        version rather than moving this citation.
      </p>

      <Card className="mb-5">
        <SectionHeading>The claim</SectionHeading>
        <p className="prose-reading text-[16px]">{row.claimText}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ClaimTypeBadge type={row.claimType} />
          <EvidenceBadge strength={row.evidenceStrength} />
          <PerspectiveBadge perspective={row.perspective} />
          {row.quantified ? <Badge tone="accent">Quantified</Badge> : null}
          <Badge tone="muted" title="Confidence in the extraction, not in the world.">
            Extraction confidence {(row.confidence * 100).toFixed(0)}%
          </Badge>
          {row.isDemo ? <Badge tone="alert">Demo data</Badge> : null}
        </div>
        {row.needsReview ? (
          <p className="mt-3 rounded bg-alert-100 px-3 py-2 text-[13px] text-alert-700">
            Flagged for re-check: {row.reviewReason}
          </p>
        ) : null}
      </Card>

      <Card className="mb-5">
        <SectionHeading
          hint={
            row.spanId
              ? `Characters ${start}–${end} of document version ${row.versionNumber}.`
              : 'No evidence span is linked to this claim.'
          }
        >
          The passage
        </SectionHeading>

        {row.spanId ? (
          <div className="prose-reading max-w-none rounded bg-[var(--surface-sunken)] p-4 text-[15px]">
            {windowStart > 0 ? <span className="text-[var(--text-subtle)]">… </span> : null}
            <span className="text-[var(--text-subtle)]">{before}</span>
            <mark className="evidence-highlight">{highlighted}</mark>
            <span className="text-[var(--text-subtle)]">{after}</span>
            {windowEnd < text.length ? <span className="text-[var(--text-subtle)]"> …</span> : null}
          </div>
        ) : (
          <p className="text-[14px] text-[var(--text-muted)]">
            This claim has no evidence span. It cannot be presented as a verified fact anywhere in the
            product.
          </p>
        )}

        {row.storedScope !== 'full_text' ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-subtle)]">
            Only an excerpt of this document is stored ({row.storedScope.replace('_', ' ')}), as permitted
            by the source policy. Follow the link below for the full original.
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionHeading>Source</SectionHeading>
        <a
          href={row.documentUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-[15px] font-medium underline underline-offset-2"
        >
          {row.documentTitle}
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PerspectiveBadge perspective={row.perspective} />
          <Link href={`/admin/sources#${row.sourceSlug}`}>
            <Badge tone="muted">{row.sourceName}</Badge>
          </Link>
        </div>

        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Published</dt>
            <dd>{formatAbsolute(row.publishedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Source last updated</dt>
            <dd>{formatAbsolute(row.sourceUpdatedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Discovered by us</dt>
            <dd>{formatAbsolute(row.discoveredAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Version retrieved</dt>
            <dd>{formatAbsolute(row.retrievedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Claim last verified</dt>
            <dd>{formatAbsolute(row.lastVerifiedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Document version</dt>
            <dd>
              v{row.versionNumber}
              {row.isCorrection ? ' (correction)' : ''}
            </dd>
          </div>
        </dl>

        {row.changeSummary ? (
          <p className="mt-3 rounded bg-[var(--surface-inset)] px-3 py-2 text-[13px] text-[var(--text-muted)]">
            {row.changeSummary}
          </p>
        ) : null}

        {row.attribution ? (
          <p className="mt-3 text-[12px] text-[var(--text-subtle)]">Attribution required: {row.attribution}</p>
        ) : null}
        {row.storagePolicy ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-[var(--text-subtle)]">
              Rights review for this source
            </summary>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">{row.storagePolicy}</p>
          </details>
        ) : null}
      </Card>
    </div>
  );
}
