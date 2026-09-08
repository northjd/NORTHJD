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
 * The hard ceiling, and the one that actually binds.
 *
 * Measured on a 964-document corpus: the static export came to 206.5 MB, so a document
 * costs about 0.214 MB of published site once its evidence pages, event pages and
 * insight are written. Against the 850 MB build budget that is roughly 4,000 documents;
 * 2,500 leaves room for the sections that do not scale with the corpus and for the
 * estimate being wrong in the unhelpful direction.
 *
 * A window without this would work until the day the feeds got busy, and then fail every
 * build — which is worse than not accumulating at all, because a failing build publishes
 * nothing. How many days 2,500 documents buys is not ours to decide; the market index
 * prints the date actually reached rather than a promised one.
 */
const maxDocuments = Number.parseInt(
  args.get('max') ?? process.env.CORPUS_MAX_DOCUMENTS ?? '2500',
  10,
);
const dryRun = args.get('dry-run') === 'true';

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

const [overflow] = (
  await d.execute<{ n: number }>(sql`
    select greatest(0, count(*) - ${maxDocuments})::int as n
      from raw_documents where is_demo = false`)
).rows;

console.log(`\n  Corpus retention — keeping ${days} days, at most ${maxDocuments} documents\n`);
console.log(
  `  before      ${before.rows[0]!.documents} documents · ${before.rows[0]!.claims} claims · ${before.rows[0]!.events} events`,
);
console.log(
  `  expiring    ${expiring!.n} documents${expiring!.oldest ? `, oldest ${expiring!.oldest}` : ''}`,
);
console.log(`  over cap    ${overflow!.n} documents beyond ${maxDocuments}`);

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
 * Then the count, oldest first.
 *
 * Ordered by the same date the window uses, so the two rules agree about what "old"
 * means and the corpus keeps a contiguous stretch ending at now — an archive with holes
 * in the middle would make every count unreadable.
 */
const capped = await d.execute<{ n: number }>(sql`
  with gone as (
    delete from raw_documents
     where id in (
       select id from raw_documents
        where is_demo = false
        order by ${age} desc nulls last
        offset ${maxDocuments}
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
  `  removed     ${expiring!.n} past the window · ${capped.rows[0]!.n} past the cap · ${orphans.rows[0]!.n} orphaned events`,
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
if (expiring!.n > 0 || capped.rows[0]!.n > 0 || orphans.rows[0]!.n > 0) {
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
