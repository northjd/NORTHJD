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

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dataDir = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? './data/pglite');
const port = Number.parseInt(process.env.PGLITE_PORT ?? '55432', 10);
const host = process.env.PGLITE_HOST ?? '127.0.0.1';

mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host });

await server.start();

const { rows } = await db.query<{ version: string }>('select version() as version');
console.log(`\n  PostgreSQL ready  ${rows[0]?.version?.split(' on ')[0] ?? ''}`);
console.log(`  listening         postgres://postgres@${host}:${port}/postgres`);
console.log(`  data directory    ${dataDir}`);
console.log(`\n  Single-connection WASM PostgreSQL for local development only.`);
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
