/**
 * Rebuilds the local database from empty.
 *
 * Deleting the PGlite data directory rather than issuing DDL. Dropping ~80 tables in
 * one session — whether as `DROP SCHEMA … CASCADE` or as individual statements —
 * reliably wedges the PGlite WASM backend and kills the connection, so the recreate
 * has to happen at the file level.
 *
 * Requires `npm run db:up` to be stopped, because the server holds the directory open.
 * Against a real PostgreSQL (`DATABASE_URL` pointing elsewhere) this refuses to run:
 * use your own tooling there.
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { closeDb, pingDb } from '@mios/database';
import { config } from '@mios/config';

const env = config();
const port = env.PGLITE_PORT;
const isLocalPglite = new RegExp(`(?:@|//)(?:127\\.0\\.0\\.1|localhost):${port}(?:/|$)`).test(
  env.DATABASE_URL,
);

if (!isLocalPglite) {
  console.error(`
  db:reset only manages the local PGlite database.

  DATABASE_URL points at ${env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}
  Reset that with your own tooling — this script will not touch it.
`);
  process.exit(1);
}

const running = await pingDb();
await closeDb();
if (running.ok) {
  console.error(`
  The local database server is running and holds the data directory open.

  Stop it (Ctrl-C in the "npm run db:up" terminal), then run this again.
`);
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const dataDir = resolve(root, env.PGLITE_DATA_DIR);

if (existsSync(dataDir)) {
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`[reset] removed ${dataDir}`);
} else {
  console.log('[reset] no existing data directory');
}

// Bring a server up just long enough to migrate and seed into the fresh directory.
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs');
const server = spawn(process.execPath, [tsx, 'scripts/db-server.ts'], {
  cwd: root,
  stdio: 'ignore',
  detached: false,
});

// Probe the TCP port rather than opening a PostgreSQL session. PGlite serves one
// backend, and a loop of connect/disconnect cycles against it while it is still
// initialising leaves the next real client unable to connect.
const portOpen = async (): Promise<boolean> =>
  new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port });
    const finish = (ok: boolean) => {
      socket.destroy();
      done(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });

let ready = false;
for (let attempt = 0; attempt < 60 && !ready; attempt++) {
  await sleep(500);
  ready = await portOpen();
}
// Give the backend a moment after the listener binds before the first real session.
if (ready) await sleep(1500);

if (!ready) {
  server.kill('SIGTERM');
  console.error('[reset] the temporary database server did not come up');
  process.exit(1);
}
console.log('[reset] temporary server ready');

try {
  for (const script of ['scripts/db-migrate.ts', 'scripts/db-seed.ts']) {
    execFileSync(process.execPath, [tsx, script], { stdio: 'inherit', cwd: root });
  }
} finally {
  server.kill('SIGTERM');
  await sleep(800);
}

console.log(`
  Database rebuilt. Start it again with:

      npm run db:up
`);
