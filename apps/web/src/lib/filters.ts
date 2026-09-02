/**
 * Explore filters.
 *
 * The brief lists eighteen filter dimensions (§15). Every one is a stored, indexed
 * column; this module is the single place that turns URL search params into a typed
 * filter object and that object into SQL conditions.
 *
 * Two properties are deliberate:
 *
 *   - **URL is the state.** Filters live in the query string, so a filtered view is
 *     shareable, bookmarkable and survives a reload. No client-side filter store.
 *   - **Parsing is total.** An unknown value is dropped rather than passed through, so
 *     a hand-edited URL cannot inject an enum value the database would reject.
 */

import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import {
  CASE_MATURITIES,
  EVENT_TYPES,
  EVIDENCE_STRENGTHS,
  NOVELTY_KINDS,
  PERSPECTIVE_GROUP_MEMBERS,
  PERSPECTIVE_FILTER_GROUPS,
  STRATEGIC_IMPACTS,
  subtractDays,
  type CaseMaturity,
  type EventType,
  type EvidenceStrength,
  type NoveltyKind,
  type PerspectiveFilterGroup,
  type StrategicImpact,
} from '@mios/domain';
import { schema } from '@mios/database';

const { eventDocuments, eventEntities, eventTaxonomy, events, insights, rawDocuments, sources } =
  schema;

/** Lookback windows offered in the UI, in days. */
export const LOOKBACK_OPTIONS = [7, 30, 90, 365] as const;
export type LookbackDays = (typeof LOOKBACK_OPTIONS)[number];

export interface ExploreFilters {
  /** Taxonomy slugs. Multiple values are OR-ed within a dimension. */
  industries: string[];
  topics: string[];
  technologies: string[];
  capabilities: string[];
  /** Entity slugs — companies, firms, institutions. */
  entities: string[];

  eventTypes: EventType[];
  maturities: CaseMaturity[];
  evidenceStrengths: EvidenceStrength[];
  impacts: StrategicImpact[];
  novelties: NoveltyKind[];
  perspectiveGroup: PerspectiveFilterGroup | null;

  /** Published or occurred within this many days. */
  withinDays: LookbackDays | null;
  /** Reading-time ceiling in minutes. */
  maxMinutes: number | null;

  /** Only events with at least one independent source. */
  independentOnly: boolean;
  /** Hide clearly-labelled demo fixtures. */
  excludeDemo: boolean;
  /** Free-text search across the event's title and summary. */
  query: string;
}

export const EMPTY_FILTERS: ExploreFilters = {
  industries: [],
  topics: [],
  technologies: [],
  capabilities: [],
  entities: [],
  eventTypes: [],
  maturities: [],
  evidenceStrengths: [],
  impacts: [],
  novelties: [],
  perspectiveGroup: null,
  withinDays: null,
  maxMinutes: null,
  independentOnly: false,
  excludeDemo: false,
  query: '',
};

// ── Parsing ──────────────────────────────────────────────────────────────────

type ParamValue = string | string[] | undefined;
export type SearchParams = Record<string, ParamValue>;

const first = (v: ParamValue): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

/** Comma-separated or repeated params both work; unknown values are dropped. */
function slugList(v: ParamValue, limit = 12): string[] {
  const raw = Array.isArray(v) ? v : [v ?? ''];
  const out = raw
    .flatMap((entry) => String(entry).split(','))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9][a-z0-9-]{0,120}$/.test(s));
  return [...new Set(out)].slice(0, limit);
}

/** Keeps only members of the given vocabulary — never trusts the URL. */
function enumList<T extends string>(v: ParamValue, allowed: readonly T[], limit = 8): T[] {
  const raw = Array.isArray(v) ? v : [v ?? ''];
  const set = new Set<string>(allowed);
  const out = raw
    .flatMap((entry) => String(entry).split(','))
    .map((s) => s.trim())
    .filter((s): s is T => set.has(s));
  return [...new Set(out)].slice(0, limit);
}

function intIn(v: ParamValue, allowed: readonly number[]): number | null {
  const n = Number.parseInt(first(v), 10);
  return allowed.includes(n) ? n : null;
}

function boundedInt(v: ParamValue, min: number, max: number): number | null {
  const n = Number.parseInt(first(v), 10);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

const truthy = (v: ParamValue): boolean => ['1', 'true', 'yes'].includes(first(v).toLowerCase());

export function parseFilters(params: SearchParams): ExploreFilters {
  const group = first(params.perspective);
  return {
    industries: slugList(params.industry),
    topics: slugList(params.topic),
    technologies: slugList(params.technology),
    capabilities: slugList(params.capability),
    entities: slugList(params.company),
    eventTypes: enumList(params.eventType, EVENT_TYPES),
    maturities: enumList(params.maturity, CASE_MATURITIES),
    evidenceStrengths: enumList(params.evidence, EVIDENCE_STRENGTHS),
    impacts: enumList(params.impact, STRATEGIC_IMPACTS),
    novelties: enumList(params.novelty, NOVELTY_KINDS),
    perspectiveGroup:
      group && (PERSPECTIVE_FILTER_GROUPS as readonly string[]).includes(group) && group !== 'ALL'
        ? (group as PerspectiveFilterGroup)
        : null,
    withinDays: intIn(params.within, LOOKBACK_OPTIONS) as LookbackDays | null,
    maxMinutes: boundedInt(params.minutes, 1, 60),
    independentOnly: truthy(params.independent),
    excludeDemo: truthy(params.hideDemo),
    query: first(params.q).slice(0, 200).trim(),
  };
}

/** Round-trips a filter object back to a query string, for links and share URLs. */
export function toSearchParams(f: ExploreFilters): URLSearchParams {
  const p = new URLSearchParams();
  const put = (key: string, values: string[]) => {
    if (values.length > 0) p.set(key, values.join(','));
  };
  put('industry', f.industries);
  put('topic', f.topics);
  put('technology', f.technologies);
  put('capability', f.capabilities);
  put('company', f.entities);
  put('eventType', f.eventTypes);
  put('maturity', f.maturities);
  put('evidence', f.evidenceStrengths);
  put('impact', f.impacts);
  put('novelty', f.novelties);
  if (f.perspectiveGroup) p.set('perspective', f.perspectiveGroup);
  if (f.withinDays) p.set('within', String(f.withinDays));
  if (f.maxMinutes) p.set('minutes', String(f.maxMinutes));
  if (f.independentOnly) p.set('independent', '1');
  if (f.excludeDemo) p.set('hideDemo', '1');
  if (f.query) p.set('q', f.query);
  return p;
}

export function activeFilterCount(f: ExploreFilters): number {
  return (
    f.industries.length +
    f.topics.length +
    f.technologies.length +
    f.capabilities.length +
    f.entities.length +
    f.eventTypes.length +
    f.maturities.length +
    f.evidenceStrengths.length +
    f.impacts.length +
    f.novelties.length +
    (f.perspectiveGroup ? 1 : 0) +
    (f.withinDays ? 1 : 0) +
    (f.maxMinutes ? 1 : 0) +
    (f.independentOnly ? 1 : 0) +
    (f.excludeDemo ? 1 : 0) +
    (f.query ? 1 : 0)
  );
}

// ── SQL ──────────────────────────────────────────────────────────────────────

/** Existence check against `event_taxonomy` for one taxonomy kind. */
function taxonomyMatch(kind: string, slugs: string[]): SQL {
  return sql`exists (
    select 1 from ${eventTaxonomy} et
    where et.event_id = ${events.id}
      and et.kind = ${kind}
      and et.slug = any(${sql.param(slugs)}::text[])
  )`;
}

/**
 * Builds the WHERE conditions for a filter set.
 *
 * Values within one dimension are OR-ed; dimensions are AND-ed together. That is the
 * behaviour people expect from faceted filtering — picking two industries widens,
 * adding a maturity narrows.
 *
 * Returned as an array so the caller can append its own scoping (workspace, suppression)
 * without this module knowing about it.
 */
export function filterConditions(f: ExploreFilters, now: Date = new Date()): SQL[] {
  const where: SQL[] = [];

  if (f.industries.length) where.push(taxonomyMatch('industry', f.industries));
  if (f.topics.length) where.push(taxonomyMatch('topic', f.topics));
  if (f.technologies.length) where.push(taxonomyMatch('technology', f.technologies));
  if (f.capabilities.length) where.push(taxonomyMatch('capability', f.capabilities));

  if (f.entities.length) {
    where.push(sql`exists (
      select 1 from ${eventEntities} ee
      join ${schema.entities} en on en.id = ee.entity_id
      where ee.event_id = ${events.id} and en.slug = any(${sql.param(f.entities)}::text[])
    )`);
  }

  if (f.eventTypes.length) {
    where.push(sql`${events.eventType} = any(${sql.param(f.eventTypes)}::event_type[])`);
  }
  if (f.maturities.length) {
    where.push(sql`${events.caseMaturity} = any(${sql.param(f.maturities)}::case_maturity[])`);
  }
  if (f.evidenceStrengths.length) {
    where.push(sql`${events.evidenceStrength} = any(${sql.param(f.evidenceStrengths)}::evidence_strength[])`);
  }
  if (f.impacts.length) {
    where.push(sql`${events.strategicImpact} = any(${sql.param(f.impacts)}::strategic_impact[])`);
  }
  if (f.novelties.length) {
    where.push(sql`${insights.novelty} = any(${sql.param(f.novelties)}::novelty_kind[])`);
  }

  // 'ALL' is a legitimate selection that deliberately has no member list: it means
  // "do not constrain perspective", so it must not reach the lookup table.
  if (f.perspectiveGroup && f.perspectiveGroup !== 'ALL') {
    const members = PERSPECTIVE_GROUP_MEMBERS[f.perspectiveGroup];
    if (members && members.length > 0) {
      where.push(sql`exists (
        select 1 from ${eventDocuments} ed
        join ${rawDocuments} rd on rd.id = ed.document_id
        join ${sources} s on s.id = rd.source_id
        where ed.event_id = ${events.id}
          and s.perspective = any(${sql.param([...members])}::source_perspective[])
      )`);
    }
  }

  if (f.withinDays) {
    // Filters on the effective date, so an old event re-reported today does not
    // qualify as recent.
    where.push(
      gte(
        sql`coalesce(${events.eventAt}, ${events.firstReportedAt})`,
        subtractDays(now, f.withinDays),
      ),
    );
  }

  if (f.maxMinutes) where.push(lte(insights.estimatedReadingMinutes, f.maxMinutes));
  if (f.independentOnly) where.push(sql`${events.independentSourceCount} > 0`);
  if (f.excludeDemo) where.push(eq(insights.isDemo, false));

  if (f.query) {
    where.push(sql`${events.searchVector} @@ websearch_to_tsquery('english', ${f.query})`);
  }

  return where;
}

/** Convenience wrapper for callers that just want one condition. */
export function filterWhere(f: ExploreFilters, extra: SQL[] = [], now?: Date): SQL | undefined {
  const all = [...extra, ...filterConditions(f, now)];
  return all.length > 0 ? and(...all) : undefined;
}
