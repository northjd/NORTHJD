/**
 * Writes the command palette's contents to a static file.
 *
 * These lists are the same on every page, so passing them as props serialised eighty-five
 * companies and every taxonomy row into all 831 pages of the static export — 161 MB, the
 * overwhelming majority of it one list repeated. One file fetched on first open is a few
 * milliseconds nobody notices.
 *
 * Runs before both builds so the file is present either way.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { asc } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { searchEntities } from '../apps/web/src/lib/entity-search';

const out = resolve(import.meta.dirname, '../apps/web/public');
mkdirSync(out, { recursive: true });

const entities = (await searchEntities('', 500)).map((e) => ({
  slug: e.slug,
  name: e.name,
  events: e.events,
  aliases: e.aliases,
}));

const industries = await db()
  .select({ slug: schema.industries.slug, name: schema.industries.name })
  .from(schema.industries)
  .orderBy(asc(schema.industries.name));

const topics = await db()
  .select({ slug: schema.topics.slug, name: schema.topics.name })
  .from(schema.topics)
  .orderBy(asc(schema.topics.name));

const payload = { entities, industries, topics, generatedAt: new Date().toISOString() };
const file = resolve(out, 'palette.json');
writeFileSync(file, JSON.stringify(payload));

const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
console.log(
  `[palette] ${entities.length} entities · ${industries.length} industries · ${topics.length} topics · ${kb} KB`,
);
process.exit(0);
