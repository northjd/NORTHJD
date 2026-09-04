/**
 * Duplicate detection and event clustering.
 *
 * "Events before articles": ten outlets covering one announcement must become one
 * event with ten sources, not ten items in the brief. Clustering is therefore not a
 * nicety — it is the mechanism that makes a finite daily brief possible.
 *
 * Two documents describe the same event when they share at least one entity, fall
 * within a short time window, and their text overlaps enough. All three are required:
 * shared entities alone would merge every H&M story of the week, and text similarity
 * alone would merge two different companies' identically-worded press releases.
 */

import { contentFingerprint, daysBetween, jaccard } from '@mios/domain';

export interface ClusterableDocument {
  documentId: string;
  title: string;
  summary: string;
  publishedAt: Date | null;
  eventAt: Date | null;
  entityIds: string[];
  fingerprint: string;
  sourceId: string;
  isFirstParty: boolean;
  /**
   * Whether this source can corroborate another's claim. Not the inverse of
   * `isFirstParty`: user-submitted and internal documents are neither first-party to
   * the subject nor independent verification of it.
   */
  isIndependent: boolean;
}

export interface DocumentCluster {
  /** Document that reported it first — the originating document. */
  originatingDocumentId: string;
  documentIds: string[];
  sourceIds: string[];
  entityIds: string[];
  firstReportedAt: Date | null;
  lastReportedAt: Date | null;
  eventAt: Date | null;
  independentSourceCount: number;
  firstPartyOnly: boolean;
}

export interface ClusterOptions {
  /** Documents further apart than this are separate events even if near-identical. */
  windowDays: number;
  /** Jaccard threshold on title+summary tokens. */
  similarityThreshold: number;
  /** A title-only match this strong counts even with a weaker body overlap. */
  titleThreshold: number;
  /** Tighter window applied to the two-shared-entities rule. */
  multiEntityWindowDays: number;
  /** Lower overlap bar, permitted only when two entities are shared. */
  multiEntitySimilarityThreshold: number;
}

export const DEFAULT_CLUSTER_OPTIONS: ClusterOptions = {
  windowDays: 5,
  similarityThreshold: 0.45,
  titleThreshold: 0.6,
  multiEntityWindowDays: 2,
  multiEntitySimilarityThreshold: 0.2,
};

function effective(d: ClusterableDocument): Date | null {
  return d.eventAt ?? d.publishedAt;
}

function sharesEntity(a: ClusterableDocument, b: ClusterableDocument): boolean {
  if (a.entityIds.length === 0 || b.entityIds.length === 0) return false;
  const setA = new Set(a.entityIds);
  return b.entityIds.some((id) => setA.has(id));
}

function withinWindow(a: ClusterableDocument, b: ClusterableDocument, windowDays: number): boolean {
  const da = effective(a);
  const dbb = effective(b);
  if (!da || !dbb) return true; // undated documents are not excluded on date grounds
  return daysBetween(da, dbb) <= windowDays;
}

function sharedEntityCount(a: ClusterableDocument, b: ClusterableDocument): number {
  const setA = new Set(a.entityIds);
  return b.entityIds.filter((id) => setA.has(id)).length;
}

export function describesSameEvent(
  a: ClusterableDocument,
  b: ClusterableDocument,
  options: ClusterOptions = DEFAULT_CLUSTER_OPTIONS,
): boolean {
  if (a.fingerprint === b.fingerprint) return true;
  if (!sharesEntity(a, b)) return false;
  if (!withinWindow(a, b, options.windowDays)) return false;

  const titleSim = jaccard(a.title, b.title);
  if (titleSim >= options.titleThreshold) return true;

  const combinedSim = jaccard(`${a.title} ${a.summary}`, `${b.title} ${b.summary}`);
  if (combinedSim >= options.similarityThreshold && titleSim >= 0.25) return true;

  // Two documents naming the *same pair* of organisations within a day of each other
  // are almost always covering one deal. Lexical similarity misses this constantly:
  // "X and Y announce partnership" and "Y signs X as anchor customer" share little
  // vocabulary but describe one event. Requiring two shared entities plus a tight
  // window plus some overlap keeps it from over-merging a company's busy week.
  const sharedEntities = sharedEntityCount(a, b);
  if (sharedEntities >= 2 && withinWindow(a, b, options.multiEntityWindowDays)) {
    return combinedSim >= options.multiEntitySimilarityThreshold;
  }

  return false;
}

/**
 * Single-link agglomeration. O(n²) on the batch, which is fine: a pipeline run
 * processes tens to low hundreds of documents, not millions.
 */
export function clusterDocuments(
  documents: ClusterableDocument[],
  options: ClusterOptions = DEFAULT_CLUSTER_OPTIONS,
): DocumentCluster[] {
  const parent = new Map<string, string>();
  documents.forEach((d) => parent.set(d.documentId, d.documentId));

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const a = documents[i]!;
      const b = documents[j]!;
      if (describesSameEvent(a, b, options)) union(a.documentId, b.documentId);
    }
  }

  const groups = new Map<string, ClusterableDocument[]>();
  for (const doc of documents) {
    const root = find(doc.documentId);
    const list = groups.get(root) ?? [];
    list.push(doc);
    groups.set(root, list);
  }

  return [...groups.values()].map(toCluster);
}

function toCluster(docs: ClusterableDocument[]): DocumentCluster {
  const dated = docs
    .filter((d) => d.publishedAt)
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime());
  const originating = dated[0] ?? docs[0]!;

  const sourceIds = [...new Set(docs.map((d) => d.sourceId))];
  const independentSources = new Set(docs.filter((d) => d.isIndependent).map((d) => d.sourceId));
  const eventDates = docs.map((d) => d.eventAt).filter((d): d is Date => d !== null);

  return {
    originatingDocumentId: originating.documentId,
    documentIds: docs.map((d) => d.documentId),
    sourceIds,
    entityIds: [...new Set(docs.flatMap((d) => d.entityIds))],
    firstReportedAt: dated[0]?.publishedAt ?? null,
    lastReportedAt: dated.at(-1)?.publishedAt ?? null,
    // Earliest stated event date: a later article restating an old event must not
    // make the event look newer than it is.
    eventAt:
      eventDates.length > 0 ? new Date(Math.min(...eventDates.map((d) => d.getTime()))) : null,
    independentSourceCount: independentSources.size,
    firstPartyOnly: independentSources.size === 0,
  };
}

/**
 * Exact-duplicate check against documents already stored. Returns the id of the
 * existing document when this one adds nothing.
 */
export function findExactDuplicate(
  candidate: { title: string; body: string },
  existing: { documentId: string; fingerprint: string }[],
): string | null {
  const fp = contentFingerprint(candidate.title, candidate.body);
  return existing.find((e) => e.fingerprint === fp)?.documentId ?? null;
}

/**
 * Detects whether a re-fetch materially changed a document — the signal that a
 * publisher issued a correction. Whitespace and boilerplate churn must not trigger it,
 * so the comparison runs on token overlap rather than string equality.
 */
export function detectMaterialChange(
  previousText: string,
  nextText: string,
): { changed: boolean; similarity: number; likelyCorrection: boolean } {
  const similarity = jaccard(previousText, nextText);
  const changed = similarity < 0.98;
  const correctionLanguage =
    /\b(correct(ion|ed)?|updated?|clarif(y|ied|ication)|amend(ed|ment)?|retract(ed|ion)?)\b/i.test(
      nextText.slice(0, 600),
    );
  return {
    changed,
    similarity,
    likelyCorrection: changed && (similarity < 0.85 || correctionLanguage),
  };
}

/**
 * Numeric and negation conflicts between two claims about the same subject. Surfaced
 * to the user as a disagreement rather than resolved silently.
 */
export function detectContradiction(
  a: string,
  b: string,
): { conflict: boolean; kind: string; explanation: string } | null {
  const numbersOf = (s: string) =>
    [...s.matchAll(/(\d+(?:[.,]\d+)?)\s?(%|percent|million|billion|bn|m\b)/gi)].map(
      (m) => `${m[1]}${(m[2] ?? '').toLowerCase()}`,
    );

  const na = numbersOf(a);
  const nb = numbersOf(b);
  if (na.length > 0 && nb.length > 0) {
    const unitsA = new Set(na.map((n) => n.replace(/[\d.,]/g, '')));
    const unitsB = new Set(nb.map((n) => n.replace(/[\d.,]/g, '')));
    const sharedUnit = [...unitsA].some((u) => unitsB.has(u));
    if (sharedUnit && na.join() !== nb.join()) {
      return {
        conflict: true,
        kind: 'numeric_mismatch',
        explanation: `Sources state different figures: "${na.join(', ')}" versus "${nb.join(', ')}".`,
      };
    }
  }

  const negated = /\b(not|no longer|denied|denies|rejected|refuted|never)\b/i;
  if (negated.test(a) !== negated.test(b) && jaccard(a, b) > 0.5) {
    return {
      conflict: true,
      kind: 'negation',
      explanation: 'One source asserts what the other denies.',
    };
  }

  return null;
}
