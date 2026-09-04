/**
 * The bits every Market search view needs.
 *
 * Market search is three pages — the market index, one market, one company — and each
 * carries the same search box and the same shortcut row. These were duplicated inside a
 * single file when all three were branches of one route; they are shared properly now
 * that each has a URL of its own.
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { searchEntities } from '@/lib/entity-search';

export interface CompanyOption {
  slug: string;
  name: string;
  events: number;
}

/**
 * Every entity, including the ones with no coverage.
 *
 * A company you cannot search for is a question you cannot ask. The zero-coverage ones
 * are the point: the company page has an honest answer for an empty one, and naming what
 * would change it is more useful than pretending the company does not exist.
 */
export async function listAllCompanies(): Promise<CompanyOption[]> {
  const entities = await searchEntities('', 200);
  return entities.map((e) => ({ slug: e.slug, name: e.name, events: e.events }));
}

export async function listWatchlistShortcuts(
  workspaceId: string,
): Promise<{ slug: string; name: string }[]> {
  const rows = await db()
    .select({ slug: schema.entities.slug, name: schema.entities.name })
    .from(schema.watchlistItems)
    .innerJoin(schema.watchlists, eq(schema.watchlists.id, schema.watchlistItems.watchlistId))
    .innerJoin(schema.entities, eq(schema.entities.id, schema.watchlistItems.entityId))
    .where(eq(schema.watchlists.workspaceId, workspaceId));
  return rows.slice(0, 6);
}
