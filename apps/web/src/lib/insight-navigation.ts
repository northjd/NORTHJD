import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { filterConditions, type ExploreFilters } from '@/lib/filters';

const { events, insights } = schema;

/**
 * Where this insight sits inside the list you came from, and what is either side of it.
 *
 * Opening an insight from a filtered list used to be a one-way trip: the back button
 * worked, but moving to the next result meant returning to Explore, finding your place
 * and clicking again. Carrying the filters in the query string lets the detail page
 * reconstruct the same ordered set and offer previous, next, and a link back.
 *
 * A full split-pane layout would solve this too, at the cost of restructuring a
 * server-rendered page into a client-side one. This gets the part that matters — never
 * losing your place — for a fraction of the risk.
 */
export interface InsightNeighbours {
  position: number;
  total: number;
  previous: { id: string; headline: string } | null;
  next: { id: string; headline: string } | null;
}

export async function insightNeighbours(
  workspaceId: string,
  insightId: string,
  filters: ExploreFilters,
): Promise<InsightNeighbours | null> {
  const rows = await db()
    .select({ id: insights.id, headline: insights.headline })
    .from(insights)
    .innerJoin(events, eq(events.id, insights.eventId))
    .where(
      and(
        eq(insights.workspaceId, workspaceId),
        eq(events.isSuppressed, false),
        ...filterConditions(filters),
      ),
    )
    .orderBy(sql`coalesce(${events.eventAt}, ${events.firstReportedAt}) desc`)
    .limit(300);

  const index = rows.findIndex((r) => r.id === insightId);
  // Not in the set: the filters changed under us, or the link was shared with different
  // ones. Better to show no navigation than navigation that lies about the sequence.
  if (index === -1) return null;

  return {
    position: index + 1,
    total: rows.length,
    previous: rows[index - 1] ?? null,
    next: rows[index + 1] ?? null,
  };
}
