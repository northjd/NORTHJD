/**
 * Re-runs entity resolution over claims that already exist.
 *
 * Resolution happens once, during claim extraction. That is the right place for it —
 * the text is in hand and the work is done exactly once per claim — but it means the
 * registry is only ever applied to documents that arrive *after* a company is added.
 *
 * Which is a problem the moment a coverage gap is closed. Adding Primark, Tesco and
 * thirty-odd others turned five existing claims about Tesco into five claims that still
 * mention nothing the product knows about, and since those documents already have
 * claims, no future run will look at them again. The corpus rolls over inside a month,
 * so it would heal on its own — but a colleague asking why Primark's page is empty the
 * day after it was added deserves better than "wait four weeks".
 *
 * Deliberately additive: this only ever inserts links that are missing. It does not
 * remove existing ones, because a link written at extraction time saw the full document
 * text and this sees only the claim.
 *
 *   npm run db:relink                 link every claim the registry now recognises
 *   npm run db:relink -- --dry-run    report what would be linked
 */

import { sql } from 'drizzle-orm';
import { closeDb, db, pingDb } from '@mios/database';
import { loadEntityCandidates, resolveEntities } from '@mios/intelligence';

const dryRun = process.argv.includes('--dry-run');

const ping = await pingDb();
if (!ping.ok) {
  console.error(`\n  Cannot reach the database.\n  ${ping.error}\n`);
  process.exit(1);
}

const d = db();
const candidates = await loadEntityCandidates();
console.log(`\n  Relinking against ${candidates.length} known entities\n`);

const claims = (
  await d.execute<{ id: string; text: string; title: string | null }>(sql`
    select c.id, c.text, rd.title
      from claims c
      join document_versions v on v.id = c.document_version_id
      join raw_documents rd on rd.id = v.document_id
     order by c.created_at desc
     limit 20000`)
).rows;

let linked = 0;
const byEntity = new Map<string, number>();

for (const claim of claims) {
  /*
   * The claim and its document title, which is what extraction had.
   *
   * Not the whole document body: a claim is a sentence, and resolving it against the
   * full text would attach every company named anywhere in the article to every claim
   * in it. The title is included because a headline naming the company is exactly the
   * corroboration `requiresContext` aliases need.
   */
  const mentions = resolveEntities(candidates, {
    title: claim.title ?? '',
    body: claim.text,
    sourceSubjectEntityId: null,
  });
  for (const mention of mentions.slice(0, 6)) {
    const result = await d.execute(sql`
      insert into claim_entities (claim_id, entity_id, role)
      values (${sql.param(claim.id)}, ${sql.param(mention.entityId)}, ${sql.param(mention.role)})
      on conflict do nothing
      returning 1`);
    if ((result.rows ?? []).length > 0) {
      linked += 1;
      byEntity.set(mention.entityId, (byEntity.get(mention.entityId) ?? 0) + 1);
    }
  }
  if (dryRun) break;
}

if (dryRun) {
  console.log(`  --dry-run: stopped after one claim. Remove the flag to run.\n`);
  await closeDb();
  process.exit(0);
}

const named = byEntity.size
  ? (
      await d.execute<{ name: string; n: number }>(sql`
        select name, 0 as n from entities where id in (${sql.join(
          [...byEntity.keys()].map((id) => sql`${sql.param(id)}`),
          sql`, `,
        )})`)
    ).rows
  : [];

console.log(
  `  ${linked} new links across ${byEntity.size} companies, from ${claims.length} claims`,
);
if (named.length) console.log(`  ${named.map((r) => r.name).join(' · ')}`);
console.log('');
await closeDb();
