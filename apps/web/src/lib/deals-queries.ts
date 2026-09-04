import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

/**
 * Publicly announced deals.
 *
 * Acquisitions, divestitures, investments, partnerships and market entries — the event
 * types that move ownership, capital or market position, as opposed to the product and
 * technology news that fills most of the corpus.
 *
 * The maturity model matters more here than anywhere else in the product. An *announced*
 * acquisition is not a completed one: deals collapse, regulators block them, terms are
 * renegotiated, and the announcement is written by the party that wants it to happen. So
 * every deal carries its implementation maturity and whether anyone other than the
 * participants has reported it, and the page says plainly that announcement is not
 * completion.
 *
 * Nothing here is a valuation, a multiple or a recommendation. Where a figure appears it
 * is because a source stated it and the evidence span proves it.
 */

export type DealKind =
  'acquisition' | 'divestiture' | 'investment' | 'partnership' | 'market_entry';

export interface Deal {
  id: string;
  insightId: string | null;
  title: string;
  eventType: DealKind;
  caseMaturity: string;
  evidenceStrength: string;
  verificationStatus: string;
  eventAt: Date | null;
  firstReportedAt: Date | null;
  sourceCount: number;
  independentSourceCount: number;
  firstPartyOnly: boolean;
  entityNames: string | null;
  industryNames: string | null;
  takeaway: string | null;
  /** True when a source states a monetary figure — the span proves it. */
  hasFigure: boolean;
}

export interface DealBoard {
  groups: { kind: DealKind; label: string; why: string; deals: Deal[] }[];
  total: number;
  counts: {
    announcedOnly: number;
    corroborated: number;
    withFigures: number;
  };
  /** Age in days of the freshest deal, so nothing reads as more current than it is. */
  newestAgeDays: number | null;
}

const DEAL_KINDS: { kind: DealKind; label: string; why: string }[] = [
  {
    kind: 'acquisition',
    label: 'Acquisitions',
    why: 'One company buying another. Announced is not completed — regulators block, terms change and deals collapse, and the announcement is written by the side that wants it to proceed.',
  },
  {
    kind: 'divestiture',
    label: 'Divestitures',
    why: 'Businesses being sold or spun out. Often more informative than an acquisition, because it says what an owner has decided not to keep.',
  },
  {
    kind: 'investment',
    label: 'Investments and funding',
    why: 'Capital going in, whether venture, growth or strategic. Amounts appear only where a source stated them.',
  },
  {
    kind: 'partnership',
    label: 'Partnerships and alliances',
    why: 'The loosest category and the easiest to over-read. Many partnership announcements describe an intention to work together rather than anything contracted.',
  },
  {
    kind: 'market_entry',
    label: 'Market entries',
    why: 'A company entering a geography or category it was not in.',
  },
];

export async function queryDeals(workspaceId: string, withinDays?: number): Promise<DealBoard> {
  const kinds = DEAL_KINDS.map((d) => d.kind);

  const result = await db().execute(sql`
    select e.id,
           i.id                        as "insightId",
           e.title,
           e.event_type                as "eventType",
           e.case_maturity             as "caseMaturity",
           e.evidence_strength         as "evidenceStrength",
           e.verification_status       as "verificationStatus",
           e.event_at                  as "eventAt",
           e.first_reported_at         as "firstReportedAt",
           e.source_count              as "sourceCount",
           e.independent_source_count  as "independentSourceCount",
           e.first_party_only          as "firstPartyOnly",
           i.takeaway,
           (select string_agg(distinct en.name, ', ')
              from event_entities ee join entities en on en.id = ee.entity_id
             where ee.event_id = e.id)                       as "entityNames",
           (select string_agg(distinct t.slug, ', ')
              from event_taxonomy t
             where t.event_id = e.id and t.kind = 'industry') as "industryNames",
           exists (
             select 1 from event_claims ec
               join claims c on c.id = ec.claim_id
              where ec.event_id = e.id and c.quantified = true
           )                                                  as "hasFigure"
      from events e
      left join insights i on i.event_id = e.id and i.workspace_id = ${sql.param(workspaceId)}
     where e.is_suppressed = false
       and e.event_type = any(${sql.param(kinds)}::event_type[])
       ${
         withinDays
           ? sql`and coalesce(e.event_at, e.first_reported_at) >= now() - (${sql.param(String(withinDays))} || ' days')::interval`
           : sql``
       }
     order by coalesce(e.event_at, e.first_reported_at) desc
     limit 120
  `);

  const deals = (result.rows ?? []) as unknown as Deal[];

  const newest = deals
    .map((d) => d.eventAt ?? d.firstReportedAt)
    .filter((d): d is Date => d != null)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a)[0];

  return {
    groups: DEAL_KINDS.map((meta) => ({
      ...meta,
      deals: deals.filter((d) => d.eventType === meta.kind),
    })).filter((g) => g.deals.length > 0),
    total: deals.length,
    counts: {
      announcedOnly: deals.filter(
        (d) => d.caseMaturity === 'ANNOUNCED' || d.caseMaturity === 'CONCEPT',
      ).length,
      corroborated: deals.filter((d) => d.independentSourceCount > 0).length,
      withFigures: deals.filter((d) => d.hasFigure).length,
    },
    newestAgeDays: newest ? Math.max(0, Math.floor((Date.now() - newest) / 86_400_000)) : null,
  };
}
