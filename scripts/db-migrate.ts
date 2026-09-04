/**
 * Applies SQL migrations, then the hand-written search objects.
 *
 * Drizzle-generated migrations cover the tables; `packages/database/sql/*.sql` holds
 * things drizzle-kit does not model (generated tsvector columns, GIN indexes, the
 * search view). Both are idempotent and safe to re-run.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { closeDb, db, pingDb } from '@mios/database';

const root = resolve(import.meta.dirname, '..');

const ping = await pingDb();
if (!ping.ok) {
  console.error(`\n  Cannot reach the database at DATABASE_URL.`);
  console.error(`  ${ping.error}`);
  console.error(`\n  Start it first:  npm run db:up\n`);
  process.exit(1);
}
console.log(`[migrate] connected — ${ping.version.split(' on ')[0]}`);

await migrate(db(), { migrationsFolder: resolve(root, 'packages/database/migrations') });
console.log('[migrate] table migrations applied');

const sqlDir = resolve(root, 'packages/database/sql');
for (const file of readdirSync(sqlDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  const text = readFileSync(resolve(sqlDir, file), 'utf8');
  await db().execute(sql.raw(text));
  console.log(`[migrate] applied ${file}`);
}

console.log('[migrate] done');
await closeDb();
