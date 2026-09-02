/**
 * Pipeline CLI.
 *
 *   npm run pipeline                    full run against the default workspace
 *   npm run pipeline -- --source=<slug> one source only
 *   npm run pipeline -- --ingest-only   fetch and extract, no insight generation
 *   npm run pipeline -- --rebuild       regenerate insights from stored events
 *   npm run pipeline -- --url=<url>     ingest one URL through the manual connector
 */

import { eq } from 'drizzle-orm';
import { closeDb, db, pingDb, schema } from '@mios/database';
import { runPipeline } from '@mios/intelligence';
import { generationMode } from '@mios/ai';
import { capabilities } from '@mios/config';

const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  if (key) args.set(key, value);
}

const ping = await pingDb();
if (!ping.ok) {
  console.error(`\n  Cannot reach the database.\n  ${ping.error}\n  Start it with:  npm run db:up\n`);
  process.exit(1);
}

const workspace = await db().query.workspaces.findFirst({
  where: eq(schema.workspaces.slug, args.get('workspace') ?? 'personal'),
});
if (!workspace) {
  console.error('\n  No workspace found. Run:  npm run db:seed\n');
  process.exit(1);
}

const mode = generationMode();
console.log(`\n  Pipeline`);
console.log(`  workspace   ${workspace.name}`);
console.log(`  generation  ${mode.label}`);
for (const cap of capabilities().filter((c) => c.status !== 'live')) {
  console.log(`  ${cap.label.padEnd(18)} ${cap.status}`);
}
console.log('');

// Manual URL ingestion: point the manual connector at one page for this run.
if (args.has('url')) {
  const source = await db().query.sources.findFirst({
    where: eq(schema.sources.slug, 'manual-url-ingestion'),
  });
  if (!source) {
    console.error('  Manual URL source is missing. Run: npm run db:seed');
    process.exit(1);
  }
  const connector = await db().query.sourceConnectors.findFirst({
    where: eq(schema.sourceConnectors.sourceId, source.id),
  });
  if (connector) {
    await db()
      .update(schema.sourceConnectors)
      .set({ configuration: { url: args.get('url') } })
      .where(eq(schema.sourceConnectors.id, connector.id));
  }
  args.set('source', 'manual-url-ingestion');
}

const summary = await runPipeline({
  workspaceId: workspace.id,
  sourceSlug: args.get('source'),
  ingestOnly: args.get('ingest-only') === 'true',
  rebuildInsights: args.get('rebuild') === 'true',
  maxItemsPerSource: args.has('max') ? Number.parseInt(args.get('max')!, 10) : 25,
  trigger: 'cli',
  log: (m) => console.log(m),
});

console.log(`
  Done in ${(summary.durationMs / 1000).toFixed(1)}s

  documents   ${summary.documentsFetched} fetched · ${summary.documentsNew} new · ${summary.documentsUpdated} updated · ${summary.documentsSkipped} unchanged
  claims      ${summary.claimsCreated} with ${summary.evidenceSpansCreated} evidence spans
  events      ${summary.eventsCreated} created
  insights    ${summary.insightsCreated} generated
  conflicts   ${summary.contradictionsFound} contradictions surfaced`);

if (summary.sourcesBlocked.length > 0) {
  console.log(`\n  Sources not fetched (${summary.sourcesBlocked.length}):`);
  for (const blocked of summary.sourcesBlocked) {
    console.log(`    ${blocked.source}\n      ${blocked.reason}`);
  }
}
if (summary.errors.length > 0) {
  console.log(`\n  Errors (${summary.errors.length}):`);
  for (const error of summary.errors) console.log(`    ${error}`);
}
console.log('');

await closeDb();
