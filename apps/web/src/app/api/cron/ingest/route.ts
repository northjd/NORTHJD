import { NextResponse } from 'next/server';
import { db } from '@mios/database';
import { runPipeline } from '@mios/intelligence';
import { config } from '@mios/config';

/**
 * Scheduled ingestion.
 *
 * Called by Vercel Cron on the schedule in `vercel.json`. The pipeline takes 6–8 seconds
 * against the current source set, which sits comfortably inside any function limit —
 * measured, not assumed, because a cron that silently times out looks exactly like a
 * cron that found nothing.
 *
 * Every three hours rather than nightly: the monitored sources publish 3–27 documents a
 * day, and a product whose first tab is called "Today" should not be a day behind. Three
 * hours is indistinguishable from live at that publication rate.
 *
 * The interval is set by the database rather than by the sources. Neon sleeps when idle
 * and stays warm about five minutes after each query, so every wake-up costs roughly five
 * minutes of compute against a 100 compute-hour monthly allowance. Hourly would spend
 * ~60 of those before anyone opened the app; three-hourly spends ~20 and leaves the rest
 * for actual readers.
 */

export const dynamic = 'force-dynamic';
// Well above the measured 6–8s, so a slow source cannot take the run down with it.
export const maxDuration = 120;

/**
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set. Without
 * it the route would be a public button that makes the server fetch arbitrary
 * registered sources, so an unset secret refuses rather than defaults to open.
 */
function authorised(request: Request): boolean {
  const secret = config().CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const workspace = await db().query.workspaces.findFirst();
  if (!workspace) {
    return NextResponse.json({ error: 'No workspace configured' }, { status: 500 });
  }

  try {
    const summary = await runPipeline({
      workspaceId: workspace.id,
      trigger: 'vercel_cron',
    });

    return NextResponse.json({
      ok: true,
      documentsFetched: summary.documentsFetched,
      claimsCreated: summary.claimsCreated,
      eventsCreated: summary.eventsCreated,
      insightsCreated: summary.insightsCreated,
      sourcesBlocked: summary.sourcesBlocked.length,
      errors: summary.errors.length,
      durationMs: summary.durationMs,
    });
  } catch (error) {
    // Reported rather than swallowed: a failing cron that returns 200 is invisible.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Lets an admin trigger a run by hand with the same secret. */
export const POST = GET;
