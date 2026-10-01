/**
 * What retention leaves behind, checked against the live local database.
 *
 * The publish workflow failed twice in eight days on `Check the evidence invariants`,
 * and the cause was not in the diff of either run: deleting documents can strip an
 * event's last claim while a surviving document keeps the event itself alive, and the
 * insight on that event is then our interpretation tracing back to nothing.
 *
 * It cannot be unit-tested, because the whole problem is a cascade — what Postgres
 * deletes on its own and what it therefore leaves standing. So this exercises the real
 * statement against real rows, inside a transaction that is always rolled back. Every
 * write here is undone; an earlier version of this kind of check was not scoped that
 * way and quietly deleted demo fixtures, which then presented as an unrelated test
 * failure with no cause in the diff.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pingDb } from '@mios/database';
import {
  countUnevidencedInsights,
  deleteUnevidencedInsights,
} from '../../scripts/lib/retention-cleanup';

let reachable = false;

beforeAll(async () => {
  const ping = await pingDb();
  reachable = ping.ok;
  if (!reachable) console.warn('\n  Retention tests skipped: no database. Run `npm run db:up`.\n');
});

const count = async (tx: {
  execute: (s: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
}) => ((await tx.execute(countUnevidencedInsights())).rows[0] as { n: number }).n;

describe('retention leaves the evidence chain intact', () => {
  it('holds the invariant the publish gate checks', async () => {
    if (!reachable) return;
    expect(await count(db())).toBe(0);
  });

  it('removes an insight whose event has lost its last claim', async () => {
    if (!reachable) return;

    const rolledBack = new Error('rollback');
    let observed: { before: number; after: number; insightGone: boolean } | null = null;

    await db()
      .transaction(async (tx) => {
        /*
         * A real event that an insight reads, and that currently has evidenced claims —
         * cloning one would mean enumerating every column and going stale at the next
         * migration, so this borrows one and puts it back by rolling back.
         */
        const [picked] = (
          await tx.execute(sql`
            select i.id as insight_id, e.id as event_id
              from insights i
              join events e on e.id = i.event_id
             where e.is_demo = false
               and exists (
                 select 1 from event_claims ec
                   join claim_evidence ce on ce.claim_id = ec.claim_id
                  where ec.event_id = e.id
               )
             limit 1`)
        ).rows as { insight_id: string; event_id: string }[];
        expect(picked, 'no evidenced insight to borrow — has the pipeline run?').toBeDefined();

        // Exactly what a document deletion does to this event, and nothing else: the
        // cascade empties event_claims while event_documents keeps the event alive.
        await tx.execute(sql`delete from event_claims where event_id = ${picked!.event_id}`);

        const before = await count(tx);
        await tx.execute(deleteUnevidencedInsights());
        const after = await count(tx);

        const [gone] = (
          await tx.execute(sql`
            select count(*)::int as n from insights where id = ${picked!.insight_id}`)
        ).rows as { n: number }[];

        observed = { before, after, insightGone: gone!.n === 0 };
        throw rolledBack;
      })
      .catch((error: unknown) => {
        if (error !== rolledBack) throw error;
      });

    expect(observed).not.toBeNull();
    expect(observed!.before).toBeGreaterThan(0);
    expect(observed!.after).toBe(0);
    expect(observed!.insightGone).toBe(true);
  });

  it('leaves the demo fixtures alone', async () => {
    if (!reachable) return;
    const rolledBack = new Error('rollback');
    let demoInsightsAfter = -1;

    await db()
      .transaction(async (tx) => {
        // Strip every demo event's claims, which would make each of them a candidate if
        // the rule looked at insights alone rather than at the event behind them.
        await tx.execute(sql`
          delete from event_claims
           where event_id in (select id from events where is_demo = true)`);
        await tx.execute(deleteUnevidencedInsights());
        const [row] = (
          await tx.execute(sql`
            select count(*)::int as n from insights i
              join events e on e.id = i.event_id
             where e.is_demo = true`)
        ).rows as { n: number }[];
        demoInsightsAfter = row!.n;
        throw rolledBack;
      })
      .catch((error: unknown) => {
        if (error !== rolledBack) throw error;
      });

    expect(demoInsightsAfter).toBeGreaterThan(0);
  });
});
