/**
 * Writes an Atom feed of the most recent insights.
 *
 * The point is delivery. A site people have to remember to visit is a site they stop
 * visiting, and the competitors that beat NORTH on adoption mostly beat it on this one
 * axis — they arrive, and it does not.
 *
 * A feed rather than email, deliberately. Email means storing colleagues' addresses,
 * which on a public repository with no server means either a third-party processor or a
 * subscriber list anyone can read. A feed stores nothing about anybody, needs no account,
 * costs nothing, and is readable in Outlook, Slack, Teams and every reader — which is
 * where these people already are.
 *
 * It carries the *generic* stream, not a personalised brief. Personalisation happens in
 * the reader's own browser from their own localStorage; a file on a CDN has no idea who
 * is fetching it, and pretending otherwise would be the same mistake as the seeded
 * watchlist. What the feed promises is "what is new", which it can honestly deliver.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

const out = resolve(import.meta.dirname, '../apps/web/public');
mkdirSync(out, { recursive: true });

/** Absolute URLs are not optional in a feed: a reader has no page to resolve against. */
const site = (process.env.SITE_URL ?? 'https://northjd.github.io/NORTHJD').replace(/\/$/, '');

const escape = (s: string): string =>
  s.replace(
    /[<>&'"]/g,
    (c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`,
  );

const result = await db().execute(sql`
  select e.id                                    as "eventId",
         e.title,
         coalesce(e.event_at, e.first_reported_at) as "at",
         e.case_maturity                         as "maturity",
         e.evidence_strength                     as "evidence",
         e.source_count                          as "sourceCount",
         e.independent_source_count              as "independentCount",
         i.id                                    as "insightId",
         i.takeaway,
         (select string_agg(t.slug, ', ') from event_taxonomy t
           where t.event_id = e.id and t.kind = 'industry') as "industries",
         (select rd.url from event_documents ed
            join raw_documents rd on rd.id = ed.document_id
           where ed.event_id = e.id and rd.url <> '' limit 1) as "sourceUrl",
         (select s.name from event_documents ed
            join raw_documents rd on rd.id = ed.document_id
            join sources s on s.id = rd.source_id
           where ed.event_id = e.id limit 1) as "sourceName"
    from events e
    left join insights i on i.event_id = e.id
   where e.is_suppressed = false
   /*
    * Substance first, then recency.
    *
    * Ordering purely by date made the feed a chronological dump, and the newest thing in
    * a corpus that includes two national broadcasters is as likely to be palace opening
    * hours as a market move. Three tie-breakers fix it without excluding any source:
    * an insight was generated for it (generation is selective, so it is a quality
    * signal), it carries an industry classification, and its strategic impact. A general
    * news item about nothing in particular loses all three and sinks.
    */
   order by (i.id is null),
            not exists (select 1 from event_taxonomy t
                         where t.event_id = e.id and t.kind = 'industry'),
            case e.strategic_impact
              when 'very_high' then 0 when 'high' then 1
              when 'moderate' then 2 else 3 end,
            coalesce(e.event_at, e.first_reported_at) desc nulls last
   limit 30
`);

type Row = {
  eventId: string;
  title: string;
  at: string | Date | null;
  maturity: string;
  evidence: string;
  sourceCount: number;
  independentCount: number;
  insightId: string | null;
  takeaway: string | null;
  industries: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
};

const rows = (result.rows ?? []) as Row[];
const now = new Date().toISOString();

const humanise = (s: string) => s.replace(/_/g, ' ').toLowerCase();

const entries = rows
  .map((r) => {
    // An insight has a page; an event without one only has the publisher's article.
    const link = r.insightId ? `${site}/insights/${r.insightId}/` : (r.sourceUrl ?? `${site}/`);
    const at = r.at ? new Date(r.at).toISOString() : now;

    /*
     * The badges, in words.
     *
     * A feed reader renders no components, so the maturity and evidence labels that carry
     * the whole trust argument on the site would simply vanish. Spelled out here, an item
     * still says whether it is an announcement or a measured outcome before it is read.
     */
    const provenance = [
      `Maturity: ${humanise(r.maturity)}`,
      `Evidence: ${humanise(r.evidence)}`,
      `${r.sourceCount} source${r.sourceCount === 1 ? '' : 's'}${
        r.independentCount > 0 ? `, ${r.independentCount} independent` : ''
      }`,
      r.sourceName ? `Via ${r.sourceName}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const body = [r.takeaway?.trim(), provenance].filter(Boolean).join('\n\n');

    const categories = (r.industries ?? '')
      .split(', ')
      .filter(Boolean)
      .map((slug) => `    <category term="${escape(slug)}" />`)
      .join('\n');

    return `  <entry>
    <title>${escape(r.title)}</title>
    <link href="${escape(link)}" />
    <id>urn:north:event:${r.eventId}</id>
    <updated>${at}</updated>
${categories}
    <summary type="text">${escape(body)}</summary>
  </entry>`;
  })
  .join('\n');

const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>NORTH — what changed</title>
  <subtitle>Know what changed. Understand what matters. Be ready for what's next.</subtitle>
  <link href="${site}/" />
  <link rel="self" href="${site}/feed.xml" />
  <id>${site}/</id>
  <updated>${now}</updated>
  <rights>Headlines and summaries from monitored public sources, linked to the publisher.</rights>
${entries}
</feed>
`;

const file = resolve(out, 'feed.xml');
writeFileSync(file, feed);
console.log(
  `[feed] ${rows.length} entries · ${(feed.length / 1024).toFixed(0)} KB · ${site}/feed.xml`,
);
process.exit(0);
