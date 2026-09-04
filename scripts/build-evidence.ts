/**
 * Writes the searchable claim corpus to a static file.
 *
 * Ask needs retrieval, and the static build has no API to retrieve through — so the
 * claims ship with the site and the search runs in the browser. At this corpus size that
 * is not a compromise: 471 claims is a few hundred kilobytes and matching them takes a
 * millisecond, where a round trip would take fifty.
 *
 * Only evidenced claims are included. A claim with no span cannot be cited, and a prompt
 * built from uncitable material is exactly what NORTH exists to avoid.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

const out = resolve(import.meta.dirname, '../apps/web/public');
mkdirSync(out, { recursive: true });

const result = await db().execute(sql`
  select c.id,
         c.text,
         c.claim_type          as "claimType",
         c.evidence_strength   as "evidenceStrength",
         c.quantified,
         s.name                as "sourceName",
         s.perspective,
         rd.title              as "documentTitle",
         rd.url                as "documentUrl",
         rd.published_at       as "publishedAt"
    from claims c
    join claim_evidence ce on ce.claim_id = c.id
    join document_versions dv on dv.id = c.document_version_id
    join raw_documents rd on rd.id = dv.document_id
    join sources s on s.id = c.source_id
   group by c.id, c.text, c.claim_type, c.evidence_strength, c.quantified,
            s.name, s.perspective, rd.title, rd.url, rd.published_at
   order by rd.published_at desc nulls last
`);

const claims = (result.rows ?? []).map((r) => {
  const row = r as Record<string, unknown>;
  return {
    id: row.id,
    text: row.text,
    claimType: row.claimType,
    evidenceStrength: row.evidenceStrength,
    quantified: row.quantified,
    sourceName: row.sourceName,
    perspective: row.perspective,
    documentTitle: row.documentTitle,
    documentUrl: row.documentUrl,
    publishedAt: row.publishedAt
      ? new Date(row.publishedAt as string).toISOString().slice(0, 10)
      : null,
  };
});

const file = resolve(out, 'evidence.json');
const payload = JSON.stringify({ claims, generatedAt: new Date().toISOString() });
writeFileSync(file, payload);
console.log(
  `[evidence] ${claims.length} evidenced claims · ${(payload.length / 1024).toFixed(0)} KB`,
);
process.exit(0);
