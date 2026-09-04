/**
 * Pipeline orchestration.
 *
 * Runs the chain source → document → version → evidence span → claim → event →
 * signal → insight → learning connection → conversation application, persisting every
 * step so the UI can walk back down it.
 *
 * Two invariants are enforced here rather than trusted:
 *   - a FACT claim is only written together with at least one evidence span
 *   - the rights gate is consulted before any connector runs, and the storage scope it
 *     returns caps what is written, whatever the connector produced
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  type ConnectorType,
  type NoveltyKind,
  type PipelineStage,
  type StorageScope,
  contentFingerprint,
  isFirstParty,
  isIndependent,
  normalizeText,
  truncate,
} from '@mios/domain';
import {
  applyStorageScope,
  canExtractEvidence,
  evaluateRights,
  getConnector,
  FetchBlockedError,
} from '@mios/connectors';
import { db, schema } from '@mios/database';
import {
  classifyCaseMaturity,
  classifyEventType,
  classifyExecutiveOwners,
  classifyOperatingModelDimensions,
  classifyValueLevers,
  matchTaxonomy,
  scoreStrategicImpact,
  type TaxonomyTerm,
} from './classify';
import { detectContradiction, detectMaterialChange, clusterDocuments, type ClusterableDocument } from './cluster';
import { extractClaims } from './extract';
import { resolveEntities, type EntityCandidate } from './entities';
import { assembleInsight, type InsightClaim, type MarketModelContext } from './insight';

const {
  claims, claimEntities, claimEvidence, contradictions, conversationApplications,
  documentVersions, entities: entitiesTable, entityAliases, eventClaims, eventDocuments,
  eventEntities, eventTaxonomy, events, evidenceSpans, importJobs, industries, insights,
  kpis, learningConcepts, learningConnections, pipelineRuns, pipelineStageRuns,
  rawDocuments, signals, sourceConnectors, sourcePolicies, sources, technologies, topics,
  valueChainStages, capabilities: capabilitiesTable,
} = schema;

export interface PipelineOptions {
  workspaceId: string;
  /** Restrict to one source; used by the admin "run this connector" action. */
  sourceSlug?: string;
  maxItemsPerSource?: number;
  trigger?: string;
  /** Skip network calls; process whatever is already stored. */
  ingestOnly?: boolean;
  rebuildInsights?: boolean;
  log?: (message: string) => void;
}

export interface PipelineSummary {
  runId: string;
  documentsFetched: number;
  documentsNew: number;
  documentsUpdated: number;
  documentsSkipped: number;
  claimsCreated: number;
  evidenceSpansCreated: number;
  eventsCreated: number;
  eventsUpdated: number;
  insightsCreated: number;
  contradictionsFound: number;
  sourcesBlocked: { source: string; reason: string }[];
  errors: string[];
  durationMs: number;
}

const noop = () => {};

export async function runPipeline(options: PipelineOptions): Promise<PipelineSummary> {
  const log = options.log ?? noop;
  const started = Date.now();
  const d = db();

  const [run] = await d
    .insert(pipelineRuns)
    .values({
      workspaceId: options.workspaceId,
      kind: options.rebuildInsights ? 'rebuild_insights' : options.ingestOnly ? 'ingest_only' : 'full',
      status: 'running',
      trigger: options.trigger ?? 'manual',
    })
    .returning();

  const runId = run!.id;
  const summary: PipelineSummary = {
    runId,
    documentsFetched: 0, documentsNew: 0, documentsUpdated: 0, documentsSkipped: 0,
    claimsCreated: 0, evidenceSpansCreated: 0, eventsCreated: 0, eventsUpdated: 0,
    insightsCreated: 0, contradictionsFound: 0, sourcesBlocked: [], errors: [],
    durationMs: 0,
  };

  try {
    if (!options.rebuildInsights) {
      await stage(runId, 'ingestion', async () => ingest(options, summary, log));
      await stage(runId, 'claim_extraction', async () => extractAll(summary, log));
      await stage(runId, 'event_clustering', async () => buildEvents(summary, log));
      await stage(runId, 'contradiction_detection', async () => findContradictions(summary, log));
    }
    if (!options.ingestOnly) {
      await stage(runId, 'insight_generation', async () =>
        buildInsights(options.workspaceId, summary, log, options.rebuildInsights ?? false),
      );
    }

    summary.durationMs = Date.now() - started;
    await d
      .update(pipelineRuns)
      .set({
        status: summary.errors.length > 0 ? 'succeeded' : 'succeeded',
        finishedAt: new Date(),
        stats: {
          documentsFetched: summary.documentsFetched,
          documentsNew: summary.documentsNew,
          documentsUpdated: summary.documentsUpdated,
          documentsSkipped: summary.documentsSkipped,
          claimsCreated: summary.claimsCreated,
          evidenceSpansCreated: summary.evidenceSpansCreated,
          eventsCreated: summary.eventsCreated,
          eventsUpdated: summary.eventsUpdated,
          insightsCreated: summary.insightsCreated,
          contradictionsFound: summary.contradictionsFound,
          sourcesBlocked: summary.sourcesBlocked.length,
        },
        error: summary.errors.join('\n').slice(0, 4000),
      })
      .where(eq(pipelineRuns.id, runId));
  } catch (err) {
    summary.durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(message);
    await d
      .update(pipelineRuns)
      .set({ status: 'failed', finishedAt: new Date(), error: message.slice(0, 4000) })
      .where(eq(pipelineRuns.id, runId));
    throw err;
  }

  return summary;
}

async function stage(
  runId: string,
  name: PipelineStage,
  fn: () => Promise<void>,
): Promise<void> {
  const d = db();
  const [row] = await d
    .insert(pipelineStageRuns)
    .values({ runId, stage: name, status: 'running' })
    .returning();
  try {
    await fn();
    await d
      .update(pipelineStageRuns)
      .set({ status: 'succeeded', finishedAt: new Date() })
      .where(eq(pipelineStageRuns.id, row!.id));
  } catch (err) {
    await d
      .update(pipelineStageRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        error: (err instanceof Error ? err.message : String(err)).slice(0, 2000),
      })
      .where(eq(pipelineStageRuns.id, row!.id));
    throw err;
  }
}

// ── Stage 1: ingestion ───────────────────────────────────────────────────────

async function ingest(
  options: PipelineOptions,
  summary: PipelineSummary,
  log: (m: string) => void,
): Promise<void> {
  const d = db();
  const rows = await d
    .select({
      source: sources,
      policy: sourcePolicies,
      connector: sourceConnectors,
    })
    .from(sourceConnectors)
    .innerJoin(sources, eq(sources.id, sourceConnectors.sourceId))
    .leftJoin(sourcePolicies, eq(sourcePolicies.sourceId, sources.id))
    .where(options.sourceSlug ? eq(sources.slug, options.sourceSlug) : sql`true`);

  for (const { source, policy, connector } of rows) {
    if (!connector.isActive && !options.sourceSlug) continue;
    // On-demand connectors (manual URL, uploads) only run when explicitly targeted.
    if (connector.schedule === 'on_demand' && !options.sourceSlug) continue;

    const decision = evaluateRights(policy);
    if (!decision.allowed) {
      summary.sourcesBlocked.push({ source: source.slug, reason: decision.reason });
      log(`  ⊘ ${source.name}: ${decision.reason}`);
      await d
        .update(sourceConnectors)
        .set({ health: 'disabled', lastError: decision.reason })
        .where(eq(sourceConnectors.id, connector.id));
      continue;
    }

    const impl = getConnector(connector.connectorType as ConnectorType);
    if (!impl) {
      summary.sourcesBlocked.push({ source: source.slug, reason: `Connector type "${connector.connectorType}" is not implemented.` });
      continue;
    }

    const [job] = await d
      .insert(importJobs)
      .values({ connectorId: connector.id, pipelineRunId: summary.runId, status: 'running' })
      .returning();

    try {
      const result = await impl.run({
        sourceId: source.id,
        endpoint: connector.endpoint,
        cursor: connector.cursor,
        configuration: connector.configuration,
        maxItems: options.maxItemsPerSource ?? 25,
      });

      summary.documentsFetched += result.documents.length;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const doc of result.documents) {
        const outcome = await persistDocument(doc, source, decision.storageScope, source.isDemo);
        if (outcome === 'created') created++;
        else if (outcome === 'updated') updated++;
        else skipped++;
      }

      summary.documentsNew += created;
      summary.documentsUpdated += updated;
      summary.documentsSkipped += skipped;

      await d
        .update(importJobs)
        .set({
          status: 'succeeded',
          finishedAt: new Date(),
          documentsFound: result.documents.length,
          documentsNew: created,
          documentsUpdated: updated,
          documentsSkipped: skipped,
          warnings: result.warnings,
        })
        .where(eq(importJobs.id, job!.id));

      await d
        .update(sourceConnectors)
        .set({
          health: 'healthy',
          lastSuccessAt: new Date(),
          lastError: '',
          consecutiveFailures: 0,
          cursor: result.cursor,
        })
        .where(eq(sourceConnectors.id, connector.id));

      log(`  ✓ ${source.name}: ${created} new, ${updated} updated, ${skipped} unchanged`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isBlocked = err instanceof FetchBlockedError;
      summary.errors.push(`${source.slug}: ${message}`);

      await d
        .update(importJobs)
        .set({ status: 'failed', finishedAt: new Date(), error: message.slice(0, 2000) })
        .where(eq(importJobs.id, job!.id));

      await d
        .update(sourceConnectors)
        .set({
          health: isBlocked ? 'disabled' : 'failing',
          lastFailureAt: new Date(),
          lastError: message.slice(0, 2000),
          consecutiveFailures: sql`${sourceConnectors.consecutiveFailures} + 1`,
        })
        .where(eq(sourceConnectors.id, connector.id));

      log(`  ✗ ${source.name}: ${message}`);
    }
  }
}

type PersistOutcome = 'created' | 'updated' | 'unchanged';

async function persistDocument(
  doc: { url: string; externalId: string | null; title: string; body: string; excerpt: string; author: string | null; language: string | null; publishedAt: Date | null; updatedAt: Date | null; raw: Record<string, unknown> },
  source: typeof sources.$inferSelect,
  scope: StorageScope,
  isDemo: boolean,
): Promise<PersistOutcome> {
  const d = db();
  const canonicalUrl = canonicalise(doc.url);
  const normalized = normalizeText(doc.body);
  const stored = applyStorageScope(scope, normalized, normalizeText(doc.excerpt));
  const fingerprint = contentFingerprint(doc.title, normalized);
  const contentHash = contentFingerprint(doc.title, stored.normalizedText);

  const existing = await d.query.rawDocuments.findFirst({
    where: and(eq(rawDocuments.sourceId, source.id), eq(rawDocuments.canonicalUrl, canonicalUrl)),
  });

  if (!existing) {
    const [inserted] = await d
      .insert(rawDocuments)
      .values({
        sourceId: source.id,
        url: doc.url,
        canonicalUrl,
        externalId: doc.externalId,
        title: doc.title,
        author: doc.author ?? '',
        language: doc.language ?? source.language,
        publishedAt: doc.publishedAt,
        sourceUpdatedAt: doc.updatedAt,
        fingerprint,
        isDemo,
      })
      .returning();

    await d.insert(documentVersions).values({
      documentId: inserted!.id,
      version: 1,
      title: doc.title,
      normalizedText: stored.normalizedText,
      excerpt: stored.excerpt,
      storedScope: scope,
      contentHash,
    });
    return 'created';
  }

  const latest = await d.query.documentVersions.findFirst({
    where: eq(documentVersions.documentId, existing.id),
    orderBy: [desc(documentVersions.version)],
  });

  if (!latest || latest.contentHash === contentHash) return 'unchanged';

  const change = detectMaterialChange(latest.normalizedText, stored.normalizedText);
  if (!change.changed) return 'unchanged';

  await d.insert(documentVersions).values({
    documentId: existing.id,
    version: latest.version + 1,
    title: doc.title,
    normalizedText: stored.normalizedText,
    excerpt: stored.excerpt,
    storedScope: scope,
    contentHash,
    isCorrection: change.likelyCorrection,
    changeSummary: change.likelyCorrection
      ? `Source text changed materially (similarity ${change.similarity.toFixed(2)}). Treated as a possible correction; dependent claims flagged for review.`
      : `Source text updated (similarity ${change.similarity.toFixed(2)}).`,
  });

  await d
    .update(rawDocuments)
    .set({ title: doc.title, sourceUpdatedAt: doc.updatedAt ?? new Date(), fingerprint })
    .where(eq(rawDocuments.id, existing.id));

  if (change.likelyCorrection) {
    // A correction upstream must not silently leave derived claims standing.
    await d
      .update(claims)
      .set({ needsReview: true, reviewReason: 'The source document was corrected after this claim was extracted.' })
      .where(eq(claims.documentVersionId, latest.id));
  }

  return 'updated';
}

/** Strips tracking parameters and fragments so one article is one row. */
function canonicalise(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    const drop = [...url.searchParams.keys()].filter(
      (k) => k.startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'source'].includes(k),
    );
    drop.forEach((k) => url.searchParams.delete(k));
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.href.replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

// ── Stage 2: claims + evidence ───────────────────────────────────────────────

async function extractAll(summary: PipelineSummary, log: (m: string) => void): Promise<void> {
  const d = db();

  // Versions that have no claims yet.
  const pending = await d
    .select({
      version: documentVersions,
      document: rawDocuments,
      source: sources,
    })
    .from(documentVersions)
    .innerJoin(rawDocuments, eq(rawDocuments.id, documentVersions.documentId))
    .innerJoin(sources, eq(sources.id, rawDocuments.sourceId))
    .leftJoin(claims, eq(claims.documentVersionId, documentVersions.id))
    .where(isNull(claims.id))
    .limit(500);

  if (pending.length === 0) return;

  const candidates = await loadEntityCandidates();

  for (const { version, document, source } of pending) {
    if (!canExtractEvidence(version.storedScope)) {
      // Metadata-only: no body to quote, so no evidence spans and no FACT claims.
      continue;
    }

    const extracted = extractClaims({
      normalizedText: version.normalizedText,
      title: version.title,
      perspective: source.perspective,
      sourceType: source.sourceType,
    });

    if (extracted.length === 0) continue;

    const mentions = resolveEntities(candidates, {
      title: version.title,
      body: version.normalizedText,
      sourceDomain: source.officialDomain,
      sourceSubjectEntityId: source.subjectEntityId,
    });

    for (const row of extracted) {
      const [span] = await d
        .insert(evidenceSpans)
        .values({
          documentVersionId: version.id,
          startOffset: row.startOffset,
          endOffset: row.endOffset,
          quote: version.normalizedText.slice(row.startOffset, row.endOffset),
        })
        .onConflictDoNothing()
        .returning();

      const spanId =
        span?.id ??
        (
          await d.query.evidenceSpans.findFirst({
            where: and(
              eq(evidenceSpans.documentVersionId, version.id),
              eq(evidenceSpans.startOffset, row.startOffset),
              eq(evidenceSpans.endOffset, row.endOffset),
            ),
          })
        )?.id;

      if (!spanId) continue;
      if (span) summary.evidenceSpansCreated++;

      const [claim] = await d
        .insert(claims)
        .values({
          documentVersionId: version.id,
          sourceId: source.id,
          text: row.text,
          claimType: row.claimType,
          evidenceStrength: row.evidenceStrength,
          confidence: row.confidence,
          quantified: row.quantified,
          eventAt: document.publishedAt,
          lastVerifiedAt: new Date(),
          generator: 'deterministic_extractive',
        })
        .returning();

      // The invariant: a claim and its evidence link are written together.
      await d.insert(claimEvidence).values({ claimId: claim!.id, evidenceSpanId: spanId });
      summary.claimsCreated++;

      for (const mention of mentions.slice(0, 6)) {
        await d
          .insert(claimEntities)
          .values({
            claimId: claim!.id,
            entityId: mention.entityId,
            role: mention.role,
            confidence: mention.confidence,
          })
          .onConflictDoNothing();
      }
    }

    await d.update(rawDocuments).set({ processedAt: new Date() }).where(eq(rawDocuments.id, document.id));
  }

  log(`  extracted ${summary.claimsCreated} claims with ${summary.evidenceSpansCreated} evidence spans`);
}

async function loadEntityCandidates(): Promise<EntityCandidate[]> {
  const d = db();
  const rows = await d
    .select({
      entityId: entitiesTable.id,
      name: entitiesTable.name,
      officialDomain: entitiesTable.officialDomain,
      alias: entityAliases.normalized,
      requiresContext: entityAliases.requiresContext,
    })
    .from(entitiesTable)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entitiesTable.id));

  const map = new Map<string, EntityCandidate>();
  for (const row of rows) {
    const existing = map.get(row.entityId) ?? {
      entityId: row.entityId,
      name: row.name,
      officialDomain: row.officialDomain,
      aliases: [],
    };
    if (row.alias) {
      existing.aliases.push({ normalized: row.alias, requiresContext: row.requiresContext ?? false });
    }
    map.set(row.entityId, existing);
  }
  return [...map.values()];
}

// ── Stage 3: events ──────────────────────────────────────────────────────────

async function buildEvents(summary: PipelineSummary, log: (m: string) => void): Promise<void> {
  const d = db();

  // Documents with claims but no event yet.
  const unclustered = await d
    .select({
      documentId: rawDocuments.id,
      title: rawDocuments.title,
      publishedAt: rawDocuments.publishedAt,
      sourceId: rawDocuments.sourceId,
      perspective: sources.perspective,
      isDemo: rawDocuments.isDemo,
    })
    .from(rawDocuments)
    .innerJoin(sources, eq(sources.id, rawDocuments.sourceId))
    .leftJoin(eventDocuments, eq(eventDocuments.documentId, rawDocuments.id))
    .where(isNull(eventDocuments.id))
    .limit(300);

  if (unclustered.length === 0) return;

  const docIds = unclustered.map((doc) => doc.documentId);

  const versionRows = await d
    .select({ documentId: documentVersions.documentId, id: documentVersions.id, text: documentVersions.normalizedText, title: documentVersions.title })
    .from(documentVersions)
    .where(inArray(documentVersions.documentId, docIds));

  const claimRows = await d
    .select({
      claimId: claims.id,
      documentId: documentVersions.documentId,
      text: claims.text,
      claimType: claims.claimType,
      quantified: claims.quantified,
      evidenceStrength: claims.evidenceStrength,
      eventAt: claims.eventAt,
    })
    .from(claims)
    .innerJoin(documentVersions, eq(documentVersions.id, claims.documentVersionId))
    .where(inArray(documentVersions.documentId, docIds));

  const entityRows = await d
    .select({ documentId: documentVersions.documentId, entityId: claimEntities.entityId, role: claimEntities.role })
    .from(claimEntities)
    .innerJoin(claims, eq(claims.id, claimEntities.claimId))
    .innerJoin(documentVersions, eq(documentVersions.id, claims.documentVersionId))
    .where(inArray(documentVersions.documentId, docIds));

  const byDoc = new Map<string, { text: string; entityIds: Set<string>; subjectIds: Set<string> }>();
  for (const doc of unclustered) byDoc.set(doc.documentId, { text: '', entityIds: new Set(), subjectIds: new Set() });
  for (const v of versionRows) {
    const entry = byDoc.get(v.documentId);
    if (entry) entry.text = v.text;
  }
  for (const e of entityRows) {
    const entry = byDoc.get(e.documentId);
    if (!entry) continue;
    entry.entityIds.add(e.entityId);
    if (e.role === 'subject') entry.subjectIds.add(e.entityId);
  }

  const clusterables: ClusterableDocument[] = unclustered.map((doc) => {
    const entry = byDoc.get(doc.documentId)!;
    return {
      documentId: doc.documentId,
      title: doc.title,
      summary: truncate(entry.text, 1200),
      publishedAt: doc.publishedAt,
      eventAt: null,
      entityIds: [...entry.entityIds],
      fingerprint: contentFingerprint(doc.title, entry.text),
      sourceId: doc.sourceId,
      isFirstParty: isFirstParty(doc.perspective),
      isIndependent: isIndependent(doc.perspective),
    };
  });

  const clusters = clusterDocuments(clusterables);
  const taxonomyTerms = await loadTaxonomyTerms();

  const sourceIndustryRows = await d
    .select({ id: sources.id, industrySlugs: sources.industrySlugs })
    .from(sources);
  const sourceIndustrySlugs = new Map(sourceIndustryRows.map((r) => [r.id, r.industrySlugs]));

  for (const cluster of clusters) {
    const clusterDocs = clusterables.filter((c) => cluster.documentIds.includes(c.documentId));
    const originating = clusterDocs.find((c) => c.documentId === cluster.originatingDocumentId) ?? clusterDocs[0]!;
    const clusterClaims = claimRows.filter((c) => cluster.documentIds.includes(c.documentId));
    const fullText = clusterDocs.map((c) => `${c.title}. ${c.summary}`).join('\n');

    const eventType = classifyEventType(originating.title, fullText);
    const { maturity, rationale } = classifyCaseMaturity(fullText, cluster.independentSourceCount > 0);
    const quantified = clusterClaims.some((c) => c.quantified);

    const strategicImpact = scoreStrategicImpact({
      eventType,
      maturity,
      quantified,
      entityCount: cluster.entityIds.length,
      independentSourceCount: cluster.independentSourceCount,
    });

    const strongest = clusterClaims
      .map((c) => c.evidenceStrength)
      .sort((a, b) => strengthRank(a) - strengthRank(b))[0];

    const [event] = await d
      .insert(events)
      .values({
        title: truncate(originating.title, 300),
        summary: truncate(clusterClaims.find((c) => c.claimType === 'FACT')?.text ?? originating.summary, 1500),
        eventType,
        eventAt: cluster.eventAt,
        firstReportedAt: cluster.firstReportedAt,
        lastReportedAt: cluster.lastReportedAt,
        lastMaterialChangeAt: cluster.firstReportedAt,
        strategicImpact,
        caseMaturity: maturity,
        changeNote: rationale,
        evidenceStrength: strongest ?? 'WEAK_OR_UNVERIFIED_SIGNAL',
        verificationStatus:
          cluster.independentSourceCount >= 2
            ? 'CORROBORATED'
            : cluster.sourceIds.length > 1
              ? 'CORROBORATED'
              : 'SINGLE_SOURCE',
        sourceCount: cluster.sourceIds.length,
        independentSourceCount: cluster.independentSourceCount,
        firstPartyOnly: cluster.firstPartyOnly,
        classificationOrigin: 'inferred',
        valueLevers: classifyValueLevers(fullText),
        operatingModelDimensions: classifyOperatingModelDimensions(fullText),
        likelyExecutiveOwners: classifyExecutiveOwners(fullText),
        isDemo: unclustered.find((u) => u.documentId === originating.documentId)?.isDemo ?? false,
      })
      .returning();

    summary.eventsCreated++;

    for (const docId of cluster.documentIds) {
      await d
        .insert(eventDocuments)
        .values({ eventId: event!.id, documentId: docId, isOriginating: docId === cluster.originatingDocumentId })
        .onConflictDoNothing();
    }
    for (const claim of clusterClaims) {
      await d
        .insert(eventClaims)
        .values({
          eventId: event!.id,
          claimId: claim.claimId,
          isPrimary: claim.claimId === clusterClaims.find((c) => c.claimType === 'FACT')?.claimId,
        })
        .onConflictDoNothing();
    }
    for (const entityId of cluster.entityIds) {
      const isSubject = clusterDocs.some((doc) => byDoc.get(doc.documentId)?.subjectIds.has(entityId));
      await d
        .insert(eventEntities)
        .values({ eventId: event!.id, entityId, role: isSubject ? 'subject' : 'mentioned' })
        .onConflictDoNothing();
    }

    const matches = matchTaxonomy(fullText, taxonomyTerms).slice(0, 12);
    for (const match of matches) {
      await d
        .insert(eventTaxonomy)
        .values({ eventId: event!.id, kind: match.kind, slug: match.slug, origin: 'inferred', confidence: match.confidence })
        .onConflictDoNothing();
    }

    // Industry names almost never appear in the text of an announcement. Where the
    // text yields no industry, fall back to the industries the source is registered
    // against — that is real metadata about the publication, not a guess about the
    // content, and it is recorded at lower confidence so ranking treats it as weaker.
    if (!matches.some((m) => m.kind === 'industry')) {
      const sourceIndustries = [
        ...new Set(
          clusterDocs.flatMap((doc) => sourceIndustrySlugs.get(doc.sourceId) ?? []),
        ),
      ];
      for (const slug of sourceIndustries.slice(0, 2)) {
        await d
          .insert(eventTaxonomy)
          .values({ eventId: event!.id, kind: 'industry', slug, origin: 'inferred', confidence: 0.3 })
          .onConflictDoNothing();
      }
    }

    // A signal is the event placed against a pattern. With no trend model yet we still
    // record the placement so the Depth link exists and is auditable.
    await d.insert(signals).values({
      eventId: event!.id,
      direction: maturity === 'DISCONTINUED_OR_REVERSED' ? 'contradicts' : 'supports',
      rationale,
      strength: quantified ? 0.7 : 0.45,
      generator: 'deterministic_extractive',
    });
  }

  log(`  clustered ${unclustered.length} documents into ${clusters.length} events`);
}

function strengthRank(s: string): number {
  const order = [
    'QUANTIFIED_PRIMARY_EVIDENCE', 'UNQUANTIFIED_PRIMARY_EVIDENCE',
    'MULTIPLE_CREDIBLE_SECONDARY_SOURCES', 'SINGLE_CREDIBLE_SECONDARY_SOURCE',
    'COMPANY_SELF_REPORTING', 'WEAK_OR_UNVERIFIED_SIGNAL',
  ];
  const idx = order.indexOf(s);
  return idx === -1 ? 99 : idx;
}

async function loadTaxonomyTerms(): Promise<TaxonomyTerm[]> {
  const d = db();
  // Sequential, not Promise.all: the local PGlite backend is single-connection and
  // concurrent queries drop it. Six small reads cost nothing anyway.
  const inds = await d.select({ slug: industries.slug, name: industries.name }).from(industries);
  const tops = await d.select({ slug: topics.slug, name: topics.name }).from(topics);
  const techs = await d.select({ slug: technologies.slug, name: technologies.name }).from(technologies);
  const stages = await d.select({ slug: valueChainStages.slug, name: valueChainStages.name }).from(valueChainStages);
  const caps = await d.select({ slug: capabilitiesTable.slug, name: capabilitiesTable.name }).from(capabilitiesTable);
  const kpiRows = await d.select({ slug: kpis.slug, name: kpis.name }).from(kpis);

  const expand = (name: string): string[] => {
    const out = [name];
    if (name.includes(' and ')) out.push(name.replace(' and ', ' & '));
    if (name.includes(' & ')) out.push(name.replace(' & ', ' and '));
    return out;
  };

  return [
    ...inds.map((r) => ({ kind: 'industry' as const, slug: r.slug, name: r.name, aliases: expand(r.name) })),
    ...tops.map((r) => ({ kind: 'topic' as const, slug: r.slug, name: r.name, aliases: expand(r.name) })),
    ...techs.map((r) => ({ kind: 'technology' as const, slug: r.slug, name: r.name, aliases: expand(r.name) })),
    ...stages.map((r) => ({ kind: 'value_chain_stage' as const, slug: r.slug, name: r.name, aliases: [] })),
    ...caps.map((r) => ({ kind: 'capability' as const, slug: r.slug, name: r.name, aliases: [] })),
    ...kpiRows.map((r) => ({ kind: 'kpi' as const, slug: r.slug, name: r.name, aliases: [] })),
  ];
}

// ── Stage 4: contradictions ──────────────────────────────────────────────────

async function findContradictions(summary: PipelineSummary, log: (m: string) => void): Promise<void> {
  const d = db();
  const recent = await d
    .select({ eventId: eventClaims.eventId, claimId: claims.id, text: claims.text })
    .from(eventClaims)
    .innerJoin(claims, eq(claims.id, eventClaims.claimId))
    .where(eq(claims.claimType, 'FACT'))
    .limit(1500);

  const byEvent = new Map<string, { claimId: string; text: string }[]>();
  for (const row of recent) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push({ claimId: row.claimId, text: row.text });
    byEvent.set(row.eventId, list);
  }

  for (const [eventId, list] of byEvent) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const conflict = detectContradiction(a.text, b.text);
        if (!conflict) continue;
        const [row] = await d
          .insert(contradictions)
          .values({
            eventId,
            claimAId: a.claimId,
            claimBId: b.claimId,
            kind: conflict.kind,
            explanation: conflict.explanation,
          })
          .onConflictDoNothing()
          .returning();
        if (row) {
          summary.contradictionsFound++;
          await d.update(events).set({ verificationStatus: 'DISPUTED' }).where(eq(events.id, eventId));
        }
      }
    }
  }

  if (summary.contradictionsFound > 0) log(`  found ${summary.contradictionsFound} contradictions`);
}

// ── Stage 5: insights ────────────────────────────────────────────────────────

async function buildInsights(
  workspaceId: string,
  summary: PipelineSummary,
  log: (m: string) => void,
  rebuild: boolean,
): Promise<void> {
  const d = db();

  const existing = await d
    .select({ eventId: insights.eventId })
    .from(insights)
    .where(eq(insights.workspaceId, workspaceId));
  const done = new Set(existing.map((e) => e.eventId));

  const candidates = await d
    .select()
    .from(events)
    .where(eq(events.isSuppressed, false))
    .orderBy(desc(sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`))
    .limit(400);

  const targets = rebuild ? candidates : candidates.filter((e) => !done.has(e.id));
  if (targets.length === 0) return;

  const coverage = await coverageSnapshot();
  const conceptBySlug = await loadConcepts();

  for (const event of targets) {
    const claimRows = await d
      .select({
        id: claims.id,
        text: claims.text,
        claimType: claims.claimType,
        quantified: claims.quantified,
        evidenceStrength: claims.evidenceStrength,
        perspective: sources.perspective,
        sourceName: sources.name,
      })
      .from(eventClaims)
      .innerJoin(claims, eq(claims.id, eventClaims.claimId))
      .innerJoin(sources, eq(sources.id, claims.sourceId))
      .where(eq(eventClaims.eventId, event.id));

    if (claimRows.length === 0) continue;

    const insightClaims: InsightClaim[] = claimRows.map((c) => ({
      id: c.id,
      text: c.text,
      claimType: c.claimType,
      quantified: c.quantified,
      evidenceStrength: c.evidenceStrength,
      isFirstParty: isFirstParty(c.perspective),
      sourceName: c.sourceName,
    }));

    const entityRows = await d
      .select({ name: entitiesTable.name, role: eventEntities.role })
      .from(eventEntities)
      .innerJoin(entitiesTable, eq(entitiesTable.id, eventEntities.entityId))
      .where(eq(eventEntities.eventId, event.id));

    const market = await marketContextFor(event.id);
    const priorEvents = await priorEventsFor(event.id);
    const contradictionRows = await d
      .select({ explanation: contradictions.explanation })
      .from(contradictions)
      .where(eq(contradictions.eventId, event.id));

    const novelty: NoveltyKind =
      priorEvents.length > 0 && event.caseMaturity === priorEvents[0]?.maturity
        ? 'repeated_announcement'
        : event.revision > 1
          ? 'updated_event'
          : 'new_to_world';

    const assembled = assembleInsight({
      eventTitle: event.title,
      eventType: event.eventType,
      eventAt: event.eventAt,
      firstReportedAt: event.firstReportedAt,
      maturity: event.caseMaturity,
      maturityRationale: event.changeNote,
      claims: insightClaims,
      entityNames: entityRows.map((e) => e.name),
      primaryEntityName: entityRows.find((e) => e.role === 'subject')?.name ?? entityRows[0]?.name ?? null,
      valueLevers: event.valueLevers as never[],
      operatingModelDimensions: event.operatingModelDimensions as never[],
      market,
      sourceCount: event.sourceCount,
      independentSourceCount: event.independentSourceCount,
      firstPartyOnly: event.firstPartyOnly,
      priorEvents,
      contradictions: contradictionRows.map((c) => c.explanation),
      novelty,
      coverage,
    });

    const [insight] = await d
      .insert(insights)
      .values({
        workspaceId,
        eventId: event.id,
        headline: assembled.headline,
        takeaway: assembled.takeaway,
        whatHappened: assembled.whatHappened,
        whatChanged: assembled.whatChanged,
        whyItMatters: assembled.whyItMatters,
        whatIsGenuinelyNew: assembled.whatIsGenuinelyNew,
        marketContext: assembled.marketContext,
        consultantPerspective: assembled.consultantPerspective,
        clientImplications: assembled.clientImplications,
        knownUnknowns: assembled.knownUnknowns,
        counterSignals: assembled.counterSignals,
        novelty,
        estimatedReadingMinutes: assembled.estimatedReadingMinutes,
        generator: 'deterministic_extractive',
        isDemo: event.isDemo,
      })
      .onConflictDoNothing()
      .returning();

    if (!insight) continue;
    summary.insightsCreated++;

    const factClaimIds = claimRows.filter((c) => c.claimType === 'FACT').map((c) => c.id);

    const applications = [
      ...assembled.conversationStarters.map((text) => ({ kind: 'conversation_starter' as const, text })),
      ...assembled.clientImplications.map((text) => ({ kind: 'client_implication' as const, text })),
      ...assembled.hypotheses.map((text) => ({ kind: 'hypothesis' as const, text })),
      ...assembled.contrarianAngle.map((text) => ({ kind: 'contrarian_angle' as const, text })),
    ];

    for (const application of applications) {
      await d.insert(conversationApplications).values({
        insightId: insight.id,
        eventId: event.id,
        kind: application.kind,
        text: application.text,
        derivedFromClaimIds: factClaimIds,
        generator: 'deterministic_extractive',
      });
    }

    // Learning connections: link the event to concepts via its taxonomy matches.
    const taxRows = await d
      .select({ kind: eventTaxonomy.kind, slug: eventTaxonomy.slug, confidence: eventTaxonomy.confidence })
      .from(eventTaxonomy)
      .where(eq(eventTaxonomy.eventId, event.id));

    for (const tax of taxRows) {
      const concept = conceptBySlug.get(tax.slug);
      if (!concept) continue;
      await d.insert(learningConnections).values({
        insightId: insight.id,
        eventId: event.id,
        conceptId: concept.id,
        kind: conceptKind(tax.kind),
        explanation: `This event was classified as touching ${concept.name}. Classification, not a statement from the source.`,
        strength: tax.confidence,
        generator: 'deterministic_extractive',
      });
    }
  }

  log(`  generated ${summary.insightsCreated} insights`);
}

function conceptKind(taxonomyKind: string): 'industry_concept' | 'kpi' | 'capability' | 'technology' | 'value_chain_stage' {
  switch (taxonomyKind) {
    case 'kpi': return 'kpi';
    case 'capability': return 'capability';
    case 'technology': return 'technology';
    case 'value_chain_stage': return 'value_chain_stage';
    default: return 'industry_concept';
  }
}

async function loadConcepts(): Promise<Map<string, { id: string; name: string }>> {
  const rows = await db()
    .select({ id: learningConcepts.id, name: learningConcepts.name, slug: learningConcepts.slug, refSlug: learningConcepts.refSlug })
    .from(learningConcepts);
  const map = new Map<string, { id: string; name: string }>();
  for (const row of rows) {
    map.set(row.slug, { id: row.id, name: row.name });
    if (row.refSlug) map.set(row.refSlug, { id: row.id, name: row.name });
  }
  return map;
}

async function marketContextFor(eventId: string): Promise<MarketModelContext> {
  const d = db();
  const tax = await d
    .select({ kind: eventTaxonomy.kind, slug: eventTaxonomy.slug })
    .from(eventTaxonomy)
    .where(eq(eventTaxonomy.eventId, eventId));

  const slugsOf = (kind: string) => tax.filter((t) => t.kind === kind).map((t) => t.slug);

  const industrySlugs = slugsOf('industry');
  let industryRow = industrySlugs[0]
    ? (await d.query.industries.findFirst({ where: eq(industries.slug, industrySlugs[0]) })) ?? null
    : null;

  // Industry names rarely appear in the text of an announcement — a press release
  // about markdown and sell-through never says the word "retail". Infer the industry
  // from the KPIs and value chain stages that *did* match, since those belong to
  // exactly one industry in the model.
  if (!industryRow) {
    const kpiSlugs = slugsOf('kpi');
    const stageSlugs = slugsOf('value_chain_stage');
    if (kpiSlugs.length > 0) {
      const row = await d
        .select({ industryId: kpis.industryId })
        .from(kpis)
        .where(inArray(kpis.slug, kpiSlugs))
        .limit(1);
      const industryId = row[0]?.industryId;
      if (industryId) {
        industryRow = (await d.query.industries.findFirst({ where: eq(industries.id, industryId) })) ?? null;
      }
    }
    if (!industryRow && stageSlugs.length > 0) {
      const row = await d
        .select({ industryId: valueChainStages.industryId })
        .from(valueChainStages)
        .where(inArray(valueChainStages.slug, stageSlugs))
        .limit(1);
      const industryId = row[0]?.industryId;
      if (industryId) {
        industryRow = (await d.query.industries.findFirst({ where: eq(industries.id, industryId) })) ?? null;
      }
    }
  }

  const [stageRows, kpiRows, capRows, techRows] = await Promise.all([
    fetchNames(valueChainStages, slugsOf('value_chain_stage')),
    fetchNames(kpis, slugsOf('kpi')),
    fetchNames(capabilitiesTable, slugsOf('capability')),
    fetchNames(technologies, slugsOf('technology')),
  ]);

  // No explicit KPI match: fall back to the industry's headline KPIs so the Depth
  // section is still useful rather than empty.
  let kpiNames = kpiRows;
  if (kpiNames.length === 0 && industryRow) {
    const fallback = await d
      .select({ name: kpis.name })
      .from(kpis)
      .where(and(eq(kpis.industryId, industryRow.id), isNull(kpis.parentId)))
      .limit(3);
    kpiNames = fallback.map((r) => r.name);
  }

  return {
    industryName: industryRow?.name ?? null,
    industrySlug: industryRow?.slug ?? null,
    valueChainStageNames: stageRows,
    kpiNames,
    capabilityNames: capRows,
    technologyNames: techRows,
  };
}

async function fetchNames(
  table: typeof valueChainStages | typeof kpis | typeof capabilitiesTable | typeof technologies,
  slugs: string[],
): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db()
    .select({ name: table.name })
    .from(table)
    .where(inArray(table.slug, slugs))
    .limit(5);
  return rows.map((r) => r.name);
}

async function priorEventsFor(eventId: string): Promise<{ title: string; at: Date | null; maturity: never }[]> {
  const d = db();
  const entityIds = (
    await d.select({ entityId: eventEntities.entityId }).from(eventEntities).where(eq(eventEntities.eventId, eventId))
  ).map((r) => r.entityId);
  if (entityIds.length === 0) return [];

  const current = await d.query.events.findFirst({ where: eq(events.id, eventId) });
  const cutoff = current?.eventAt ?? current?.firstReportedAt ?? new Date();

  // The ordering expression is selected explicitly: `SELECT DISTINCT … ORDER BY <expr>`
  // where the expression is absent from the select list is invalid in PostgreSQL, and
  // PGlite drops the connection rather than raising the error.
  const rows = await d
    .selectDistinct({
      id: events.id,
      title: events.title,
      eventAt: events.eventAt,
      firstReportedAt: events.firstReportedAt,
      maturity: events.caseMaturity,
      sortAt: sql<string>`coalesce(${events.eventAt}, ${events.firstReportedAt})`.as('sort_at'),
    })
    .from(events)
    .innerJoin(eventEntities, eq(eventEntities.eventId, events.id))
    .where(
      and(
        inArray(eventEntities.entityId, entityIds),
        sql`${events.id} <> ${eventId}`,
        sql`coalesce(${events.eventAt}, ${events.firstReportedAt}) < ${cutoff.toISOString()}`,
      ),
    )
    .orderBy(desc(sql`sort_at`))
    .limit(3);

  return rows.map((r) => ({
    title: r.title,
    at: r.eventAt ?? r.firstReportedAt,
    maturity: r.maturity as never,
  }));
}

async function coverageSnapshot(): Promise<{ monitoredSources: number; industriesCovered: number }> {
  const d = db();
  const [sourceCount] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(sourceConnectors)
    .where(eq(sourceConnectors.isActive, true));
  const [industryCount] = await d.select({ n: sql<number>`count(*)::int` }).from(industries);
  return {
    monitoredSources: sourceCount?.n ?? 0,
    industriesCovered: industryCount?.n ?? 0,
  };
}
