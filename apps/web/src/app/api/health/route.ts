import { NextResponse } from 'next/server';
import { pingDb } from '@mios/database';

export const dynamic = 'force-dynamic';

/**
 * Liveness and readiness in one endpoint.
 *
 * Every orchestrator wants somewhere to poll, and "the process is up" is not the same
 * question as "the process can serve requests" — an app with a dead database connection
 * answers HTTP fine and fails every page. This checks the thing that actually breaks.
 *
 * Deliberately unauthenticated and deliberately quiet: it reports reachability and the
 * server version, never row counts, connection strings or anything else that would be
 * worth scraping.
 */
export async function GET() {
  const started = Date.now();
  const ping = await pingDb();

  if (!ping.ok) {
    return NextResponse.json(
      { status: 'unhealthy', database: 'unreachable', error: ping.error },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: 'healthy',
    database: ping.version.split(' on ')[0],
    latencyMs: Date.now() - started,
  });
}
