import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

/**
 * What the sources actually said, in their own words.
 *
 * The evidence spans show the exact sentence a claim rests on, which is the right unit
 * for checking a claim but a poor one for reading. People reasonably want the passage
 * around it and then the article itself, so this returns the stored text of every
 * document behind an insight along with its link.
 *
 * What is stored is an excerpt, not the article: each source's rights policy decides how
 * much may be kept, and for most feeds that is the summary the publisher chose to
 * syndicate. So "read the full article" means going to the publisher, which is both the
 * honest and the correct behaviour — reproducing their text in full would be exactly the
 * thing the rights gate exists to prevent.
 */
export interface SourcePassage {
  documentId: string;
  title: string;
  url: string;
  sourceName: string;
  perspective: string;
  publishedAt: Date | null;
  /** The stored excerpt, as normalised at ingestion. */
  text: string;
  /** How much of the document the rights policy permitted us to keep. */
  storedScope: string;
  attribution: string | null;
}

export async function sourcePassages(insightId: string): Promise<SourcePassage[]> {
  const result = await db().execute(sql`
    select distinct on (rd.id)
           rd.id            as "documentId",
           rd.title,
           rd.url,
           rd.published_at  as "publishedAt",
           s.name           as "sourceName",
           s.perspective,
           coalesce(nullif(dv.normalized_text, ''), dv.excerpt, '') as text,
           dv.stored_scope  as "storedScope",
           sp.required_attribution as attribution
      from insights i
      join events e on e.id = i.event_id
      join event_claims ec on ec.event_id = e.id
      join claims c on c.id = ec.claim_id
      join document_versions dv on dv.id = c.document_version_id
      join raw_documents rd on rd.id = dv.document_id
      join sources s on s.id = c.source_id
      left join source_policies sp on sp.source_id = s.id
     where i.id = ${sql.param(insightId)}
     order by rd.id, dv.version desc
  `);

  return (result.rows ?? []) as unknown as SourcePassage[];
}

/** How the stored scope reads to someone deciding whether to click through. */
export function scopeLabel(scope: string): string {
  switch (scope) {
    case 'full_text':
      return 'Full text stored';
    case 'excerpt':
      return 'Excerpt stored — the publisher has the rest';
    case 'metadata_only':
      return 'Headline and link only';
    default:
      return 'Excerpt stored';
  }
}
