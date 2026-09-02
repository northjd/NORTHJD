/**
 * Finding a company by whatever the user actually typed.
 *
 * Three things this has to get right, each of which failed in an earlier version:
 *
 *  1. **Aliases.** "Zara" has no substring in common with "Inditex", and "AWS" none with
 *     "Amazon". Without the alias table the user types the name they know and the
 *     product tells them the company does not exist.
 *
 *  2. **Short queries must not match mid-word.** A plain `%term%` makes "PMI" match
 *     "Deep**Mi**nd", so searching a client's short name returns Google. Terms of four
 *     characters or fewer are therefore anchored to the start of a word. "PMI" then
 *     correctly finds nothing, while "amaz" still finds Amazon and "Mi" finds Microsoft
 *     — which is what someone typing four letters wants. Longer terms keep substring
 *     matching, so "morris" would find "Philip Morris" mid-name.
 *
 *  3. **Companies with no coverage stay visible.** A company you cannot select is a
 *     question you cannot ask. A company you select and find empty is an answer, and it
 *     points at the fix: a missing source, not a missing query.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

/** At or below this length, match the start of a word rather than anywhere in it. */
const BOUNDARY_MAX = 4;

export interface MatchPattern {
  operator: 'ilike' | '~*';
  pattern: string;
  anchored: boolean;
}

/**
 * Builds the comparison for a user-typed term.
 *
 * The pattern is escaped here and bound as a parameter rather than assembled inside SQL:
 * escaping a regex through two layers of string quoting is how
 * `invalid regular expression: brackets [] not balanced` happens.
 */
export function matchPattern(term: string): MatchPattern {
  const trimmed = term.trim();
  if (trimmed.length > BOUNDARY_MAX) {
    return { operator: 'ilike', pattern: `%${trimmed}%`, anchored: false };
  }
  const escaped = trimmed.replace(/[.^$*+?()[\]{}|\\-]/g, (c) => `\\${c}`);
  return { operator: '~*', pattern: `\\y${escaped}`, anchored: true };
}

export interface EntityMatch {
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  kind: string;
  events: number;
  lastSeen: Date | null;
  industries: string | null;
  aliases: string | null;
  /** The alias that produced the match, when the name itself did not. */
  matchedAlias: string | null;
}

/**
 * Every entity matching the term, including those with no coverage.
 *
 * An empty term returns the full list ordered by coverage, which is what the filter
 * dropdown wants before anyone types.
 */
export async function searchEntities(term = '', limit = 60): Promise<EntityMatch[]> {
  const { operator, pattern } = matchPattern(term);

  // The column and operator are raw (both are from a fixed internal set); only the
  // user-supplied pattern is bound as a parameter.
  const compare = (column: string) =>
    sql`${sql.raw(column)} ${sql.raw(operator)} ${sql.param(pattern)}`;

  const rows = await db().execute(sql`
    select
      en.slug,
      en.name,
      en.legal_name          as "legalName",
      en.description,
      en.kind,
      count(distinct e.id)::int                              as events,
      max(coalesce(e.event_at, e.first_reported_at))         as "lastSeen",
      (select string_agg(distinct i.name, ', ')
         from entity_industries ei
         join industries i on i.id = ei.industry_id
        where ei.entity_id = en.id)                          as industries,
      (select string_agg(al.alias, ', ')
         from entity_aliases al where al.entity_id = en.id)  as aliases,
      (select al.alias
         from entity_aliases al
        where al.entity_id = en.id
          and (${compare('al.alias')} or ${compare('al.normalized')})
        limit 1)                                             as "matchedAlias"
    from entities en
    left join event_entities ee on ee.entity_id = en.id
    left join events e on e.id = ee.event_id and e.is_suppressed = false
    where ${sql.param(term.trim())} = ''
       or ${compare('en.name')}
       or ${compare('en.slug')}
       or ${compare('coalesce(en.legal_name, \'\')')}
       or exists (
            select 1 from entity_aliases al
             where al.entity_id = en.id
               and (${compare('al.alias')} or ${compare('al.normalized')})
          )
    group by en.id, en.slug, en.name, en.legal_name, en.description, en.kind
    order by count(distinct e.id) desc, en.name asc
    limit ${sql.param(limit)}
  `);

  return (rows.rows ?? []) as unknown as EntityMatch[];
}

export interface CoverageLookup {
  term: string;
  entities: EntityMatch[];
  /** Events whose full-text index mentions the term. */
  events: {
    id: string;
    title: string;
    caseMaturity: string;
    evidenceStrength: string;
    eventAt: Date | null;
    firstReportedAt: Date | null;
    sourceCount: number;
    insightId: string | null;
  }[];
  claimMentions: number;
  /** True when nothing in the corpus refers to this at all. */
  empty: boolean;
}

/**
 * What the corpus knows about a term.
 *
 * The useful answer to a term we do not track is not an empty list. It is: no entity
 * carries that name or alias, N events and M claims mention the word, and here is the
 * specific thing that would change that. A gap that names its own remedy is worth more
 * than a blank screen — and it is the honest alternative to answering from general
 * knowledge, which is the failure this product exists to prevent.
 */
export async function lookupCoverage(term: string): Promise<CoverageLookup> {
  const cleaned = term.trim();
  if (!cleaned) {
    return { term: cleaned, entities: [], events: [], claimMentions: 0, empty: true };
  }

  const entities = await searchEntities(cleaned, 10);

  // OR the words: a multi-word term should not require every word to be present.
  const tsquery = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter((w) => w.length > 1)
    .join(' | ');

  if (!tsquery) {
    return { term: cleaned, entities, events: [], claimMentions: 0, empty: entities.length === 0 };
  }

  const events = await db().execute(sql`
    select e.id, e.title,
           e.case_maturity        as "caseMaturity",
           e.evidence_strength    as "evidenceStrength",
           e.event_at             as "eventAt",
           e.first_reported_at    as "firstReportedAt",
           e.source_count         as "sourceCount",
           i.id                   as "insightId"
      from events e
      left join insights i on i.event_id = e.id
     where e.is_suppressed = false
       and e.search_vector @@ to_tsquery('english', ${sql.param(tsquery)})
     order by coalesce(e.event_at, e.first_reported_at) desc
     limit 15
  `);

  const claims = await db().execute(sql`
    select count(*)::int as n
      from claims c
     where c.search_vector @@ to_tsquery('english', ${sql.param(tsquery)})
  `);

  const eventRows = (events.rows ?? []) as CoverageLookup['events'];
  const claimMentions = Number(((claims.rows ?? [])[0] as { n?: number } | undefined)?.n ?? 0);

  return {
    term: cleaned,
    entities,
    events: eventRows,
    claimMentions,
    empty: entities.length === 0 && eventRows.length === 0 && claimMentions === 0,
  };
}
