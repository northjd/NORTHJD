/**
 * Local PostgreSQL for development.
 *
 * Starts PGlite (real PostgreSQL 18, compiled to WASM) and exposes it on the
 * PostgreSQL wire protocol so `pg`, drizzle-kit, the worker and Playwright can all
 * connect with a normal `postgres://` URL. See ADR 0001 for why this rather than
 * Docker.
 *
 * Leave it running in its own terminal: `npm run db:up`.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dataDir = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? './data/pglite');
const port = Number.parseInt(process.env.PGLITE_PORT ?? '55432', 10);
const host = process.env.PGLITE_HOST ?? '127.0.0.1';

mkdirSync(dataDir, { recursive: true });

/**
 * A data directory that will not open must not stop the site publishing.
 *
 * Since the publish workflow began carrying `data/pglite` between runs, the directory
 * this opens is usually one restored from a cache rather than one this machine wrote.
 * That is a new failure mode: a truncated archive, a directory written by a different
 * PostgreSQL major version, or a run cancelled mid-checkpoint all produce a directory
 * PGlite refuses.
 *
 * Refusing back would freeze the published site at its last good build until somebody
 * noticed — the same slow, quiet failure the keep-alive workflow exists to prevent. So
 * when `PGLITE_RESET_ON_CORRUPT` is set, a directory that will not open is moved out of
 * the way and rebuilt from empty. The run then ingests whatever the feeds are carrying,
 * which is a worse day than usual and a great deal better than a frozen one.
 *
 * Deliberately opt-in. On a laptop, silently deleting a database you were working with
 * is not a recovery, and the right response is the error.
 */
async function open(): Promise<PGlite> {
  try {
    return await PGlite.create({ dataDir });
  } catch (err) {
    if (process.env.PGLITE_RESET_ON_CORRUPT !== '1') throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n  The data directory would not open: ${message}`);
    console.error(`  PGLITE_RESET_ON_CORRUPT=1 — rebuilding from empty at ${dataDir}`);
    // Announced where CI will surface it, so a run that quietly lost its history is
    // visible in the log rather than only in the event counts.
    console.error(
      `::warning title=Corpus reset::Restored data directory was unreadable; rebuilt empty. Accumulated history for this run is lost.`,
    );
    rmSync(dataDir, { recursive: true, force: true });
    mkdirSync(dataDir, { recursive: true });
    return await PGlite.create({ dataDir });
  }
}

const db = await open();

/**
 * `maxConnections` defaults to 1, and that default caused every "Connection terminated
 * unexpectedly" failure in this project.
 *
 * Next.js runs page renders and route handlers as separate module instances, so each
 * gets its own `@mios/database` client and therefore its own connection. With a ceiling
 * of one, the API route's connection displaced the page renderer's, which is why the
 * Companion 500ed on its very first query while pages rendered fine moments earlier.
 *
 * The socket server queues at the query level, so several connections are safe: PGlite
 * itself is still single-threaded, but callers no longer evict each other.
 */
const maxConnections = Number.parseInt(process.env.PGLITE_MAX_CONNECTIONS ?? '20', 10);
const server = new PGLiteSocketServer({ db, port, host, maxConnections });

await server.start();

const { rows } = await db.query<{ version: string }>('select version() as version');
console.log(`\n  PostgreSQL ready  ${rows[0]?.version?.split(' on ')[0] ?? ''}`);
console.log(`  listening         postgres://postgres@${host}:${port}/postgres`);
console.log(`  data directory    ${dataDir}`);
console.log(`  max connections   ${maxConnections}`);
console.log(`\n  WASM PostgreSQL for local development only — single-threaded, no replication.`);
console.log(`  Point DATABASE_URL at a managed PostgreSQL for anything else.\n`);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[db] ${signal} — stopping`);
  await server.stop();
  await db.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
