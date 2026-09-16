/**
 * Bounds the corpus, so that carrying it between runs stays affordable.
 *
 * Until the publish workflow started caching the PGlite data directory, this script had
 * nothing to do: every run built the database from scratch and threw it away, so the
 * corpus could never be older than whatever the feeds happened to be carrying. Now that
 * it survives, something has to decide when material stops being worth keeping —
 * otherwise the answer is "for ever", and for ever does not fit inside a 1 GB Pages
 * site or a 10 GB Actions cache.
 *
 * Two things are pruned, in this order:
 *
 *   1. Documents whose publication date is older than the window. Deleting a document
 *      cascades to its versions, its claims and their evidence spans, which is where
 *      almost all the weight is.
 *   2. Events left with no documents behind them. An event is a cluster *of* documents;
 *      once the last one is gone the event is an assertion with nothing under it, which
 *      is precisely the thing this product refuses to publish. Insights cascade from
 *      the event.
 *
 * Never pruned: seeded demo material, whichever date it carries. It is deliberately
 * placed reference content and the seed would put it straight back.
 *
 * Two ceilings, because time alone does not bound size. A window says how far back to
 * reach; how much that turns out to be depends on how much the publishers published,
 * which nothing here controls. So there is also a document count, derived from what the
 * published site can carry — see `--max` below.
 *
 *   npm run db:retain               prune to CORPUS_RETENTION_DAYS (default 400)
 *   npm run db:retain -- --days=90  a shorter window
 *   npm run db:retain -- --max=2500 keep at most this many documents, newest first
 *   npm run db:retain -- --dry-run  count what would go, delete nothing
 */

import { sql } from 'drizzle-orm';
import { closeDb, db, pingDb } from '@mios/database';

const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  if (key) args.set(key, value);
}

const days = Number.parseInt(args.get('days') ?? process.env.CORPUS_RETENTION_DAYS ?? '400', 10);

/**
 * The ceiling that actually binds, and the estimate behind it that was wrong.
 *
 * It was set from a single measurement: a 964-document corpus produced a 164.8 MB
 * export, so a document seemed to cost 0.171 MB of published site and 3,500 of them
 * seemed to fit in 600 MB. At 2,700 documents the real export was 940 MB — nearer 0.32
 * MB per document, almost double.
 *
 * The error was extrapolating a straight line from one point. Page weight does not stay
 * flat as the corpus grows: a market page listing five hundred events is not the size of
 * one listing fifty, and the sections that *are* fixed were a much larger share of the
 * total at 964 documents than they are at 2,700.
 *
 * So this number is now a starting point rather than a promise. `--target-mb` below
 * re-derives it from whatever the last build actually weighed, which is the only figure
 * that cannot be wrong about itself.
 */
const maxDocuments = Number.parseInt(
  args.get('max') ?? process.env.CORPUS_MAX_DOCUMENTS ?? '2200',
  10,
);
const dryRun = args.get('dry-run') === 'true';

/**
 * A document cap derived from what the site just weighed.
 *
 * `build:static` writes `BUILD_SIZE.json` next to the export. Given a target, this reads
 * the measured total, divides by the documents that produced it, and caps the corpus at
 * whatever number fits — with a tenth held back, because the relationship is not quite
 * linear and erring small costs a few days of history while erring large costs the whole
 * publication.
 *
 * Only ever lowers the cap. A build that came in under budget is not an invitation to
 * grow past `CORPUS_MAX_DOCUMENTS`.
 */
async function capFromLastBuild(current: number): Promise<number> {
  const targetMb = Number.parseFloat(args.get('target-mb') ?? '');
  const sizeFile = args.get('from-build');
  if (!Number.isFinite(targetMb) || !sizeFile) return maxDocuments;

  const { readFileSync, existsSync } = await import('node:fs');
  if (!existsSync(sizeFile)) {
    console.log(`  no build size at ${sizeFile}; keeping the configured cap`);
    return maxDocuments;
  }
  const { totalMb } = JSON.parse(readFileSync(sizeFile, 'utf8')) as { totalMb: number };
  if (!Number.isFinite(totalMb) || totalMb <= 0 || current <= 0) return maxDocuments;

  const perDocument = totalMb / current;
  const fits = Math.floor((targetMb / perDocument) * 0.9);
  console.log(
    `  measured    ${totalMb.toFixed(0)} MB from ${current} documents · ${perDocument.toFixed(3)} MB each`,
  );
  if (fits >= maxDocuments) {
    console.log(`  cap         ${maxDocuments} (build is within ${targetMb} MB; cap unchanged)`);
    return maxDocuments;
  }
  console.log(
    `  cap         ${fits} — lowered from ${maxDocuments} to come in under ${targetMb} MB`,
  );
  return fits;
}

if (!Number.isFinite(days) || days < 1) {
  console.error(`\n  --days must be a positive number of days; got ${args.get('days')}\n`);
  process.exit(1);
}

const ping = await pingDb();
if (!ping.ok) {
  console.error(
    `\n  Cannot reach the database.\n  ${ping.error}\n  Start it with:  npm run db:up\n`,
  );
  process.exit(1);
}

const d = db();

/**
 * `published_at` when the publisher gave one, `discovered_at` when it did not.
 *
 * A feed item with no date is not evidence that it is old — it is evidence that the
 * publisher omitted the field. Falling back to when we first saw it keeps those items
 * for a full window rather than deleting them on the first run after they arrive.
 */
const age = sql.raw(`coalesce(published_at, discovered_at)`);
const cutoff = sql.raw(`now() - interval '${days} days'`);

const before = await d.execute<{
  documents: number;
  claims: number;
  events: number;
  insights: number;
}>(sql`
  select
    (select count(*)::int from raw_documents) as documents,
    (select count(*)::int from claims)        as claims,
    (select count(*)::int from events)        as events,
    (select count(*)::int from insights)      as insights`);

const [expiring] = (
  await d.execute<{ n: number; oldest: string | null }>(sql`
    select count(*)::int as n, min(${age})::date::text as oldest
    from raw_documents
    where is_demo = false and ${age} < ${cutoff}`)
).rows;

const [live] = (
  await d.execute<{ n: number }>(
    sql`select count(*)::int as n from raw_documents where is_demo = false`,
  )
).rows;
const effectiveMax = await capFromLastBuild(live!.n);

const [overflow] = (
  await d.execute<{ n: number }>(sql`
    select greatest(0, count(*) - ${effectiveMax})::int as n
      from raw_documents where is_demo = false`)
).rows;

console.log(`\n  Corpus retention — keeping ${days} days, at most ${effectiveMax} documents\n`);
console.log(
  `  before      ${before.rows[0]!.documents} documents · ${before.rows[0]!.claims} claims · ${before.rows[0]!.events} events`,
);
console.log(
  `  expiring    ${expiring!.n} documents${expiring!.oldest ? `, oldest ${expiring!.oldest}` : ''}`,
);
console.log(`  over cap    ${overflow!.n} documents beyond ${effectiveMax}`);

if (dryRun) {
  console.log(`\n  --dry-run: nothing deleted.\n`);
  await closeDb();
  process.exit(0);
}

if (expiring!.n > 0) {
  await d.execute(sql`
    delete from raw_documents
    where is_demo = false and ${age} < ${cutoff}`);
}

/*
 * Then the inert ones, whatever their age.
 *
 * A document that has been through clustering and produced no event renders nothing: no
 * market row, no insight, no timeline entry. It still costs storage, and its claims
 * still cost a prerendered evidence page each that nothing on the site links to.
 * Measured before the pipeline was rebalanced: 662 of 958 documents were in this state,
 * and 749 of 1,123 evidence pages were unreachable because of it.
 *
 * The grace period matters. A document ingested in the last two days may simply not have
 * been clustered yet — a run can fail, and one did, nine times. Deleting on the first
 * sight of no event would throw away material that was about to become an event.
 */
const graceDays = Number.parseInt(args.get('grace-days') ?? '2', 10);
const inert = await d.execute<{ n: number }>(sql`
  with gone as (
    delete from raw_documents rd
     where rd.is_demo = false
       and ${age} < now() - (${graceDays} || ' days')::interval
       and not exists (select 1 from event_documents ed where ed.document_id = rd.id)
    returning 1
  )
  select count(*)::int as n from gone`);

/*
 * Then the count — oldest first, but not impact-blind.
 *
 * Pure recency treats a regulator's decision and a product announcement as the same
 * thing, so the first question this archive exists to answer — what actually mattered in
 * this market last quarter — degrades at exactly the same rate as the noise around it.
 *
 * So a document behind a high-impact event carries a bonus on its effective date and
 * survives roughly six months longer than a routine one from the same week. Expressed as
 * a date bonus rather than a sort tier on purpose: a tier would let a large enough pile
 * of old high-impact material evict everything recent, which is a worse failure than the
 * one being fixed. Measured on this corpus, 28 of 587 events are high or very high, so
 * the bonus reshapes the tail without touching the bulk.
 *
 * Within a tier the order is still the date the window uses, so the two rules agree
 * about what "old" means and the corpus keeps a contiguous stretch ending at now.
 */
const impactBonusDays = Number.parseInt(args.get('impact-bonus-days') ?? '180', 10);
const capped = await d.execute<{ n: number }>(sql`
  with ranked as (
    select rd.id,
           ${age} + (
             case when exists (
               select 1 from event_documents ed
                 join events e on e.id = ed.event_id
                where ed.document_id = rd.id
                  and e.strategic_impact in ('high', 'very_high')
             ) then (${impactBonusDays} || ' days')::interval
             else '0 days'::interval end
           ) as effective_at
      from raw_documents rd
     where rd.is_demo = false
  ),
  gone as (
    delete from raw_documents
     where id in (
       select id from ranked order by effective_at desc nulls last offset ${effectiveMax}
     )
    returning 1
  )
  select count(*)::int as n from gone`);

/*
 * Events are not reached by that cascade — `event_documents` is, but the event row
 * itself survives its last document. An event with no documents cannot show its
 * evidence, and `npm run eval` is entitled to fail the build over exactly that, so it
 * goes too. Demo events stay for the same reason demo documents do.
 */
const orphans = await d.execute<{ n: number }>(sql`
  with gone as (
    delete from events e
    where e.is_demo = false
      and not exists (select 1 from event_documents ed where ed.event_id = e.id)
    returning 1
  )
  select count(*)::int as n from gone`);

const after = await d.execute<{
  documents: number;
  claims: number;
  events: number;
  insights: number;
}>(sql`
  select
    (select count(*)::int from raw_documents) as documents,
    (select count(*)::int from claims)        as claims,
    (select count(*)::int from events)        as events,
    (select count(*)::int from insights)      as insights`);

console.log(
  `  removed     ${expiring!.n} past the window · ${inert.rows[0]!.n} inert · ${capped.rows[0]!.n} past the cap · ${orphans.rows[0]!.n} orphaned events`,
);
console.log(
  `  after       ${after.rows[0]!.documents} documents · ${after.rows[0]!.claims} claims · ${after.rows[0]!.events} events · ${after.rows[0]!.insights} insights`,
);

/*
 * Reclaim the space rather than leaving it as free pages inside the files.
 *
 * A plain VACUUM would mark the pages reusable but not return them, and the whole point
 * here is the size of the directory that gets carried to the next run. FULL rewrites
 * the tables, which on a corpus this size costs a second or two.
 */
if (expiring!.n > 0 || inert.rows[0]!.n > 0 || capped.rows[0]!.n > 0 || orphans.rows[0]!.n > 0) {
  await d.execute(sql.raw('vacuum (full, analyze)'));
  console.log(`  vacuumed    tables rewritten, free space returned to the filesystem`);
} else {
  await d.execute(sql.raw('analyze'));
}

/*
 * Flush before anyone archives the directory.
 *
 * The workflow tars `data/pglite` immediately after this and hands it to the cache.
 * Dirty buffers still in shared memory would not be in that tar, and the next run would
 * restore a database referencing a WAL that half-exists. CHECKPOINT makes what is on
 * disk equal to what has been committed.
 */
await d.execute(sql.raw('checkpoint'));

const [size] = (
  await d.execute<{ size: string }>(
    sql`select pg_size_pretty(pg_database_size(current_database())) as size`,
  )
).rows;
console.log(`  checkpoint  written · database now ${size!.size}\n`);

await closeDb();
