/**
 * Database client.
 *
 * Two modes, chosen by `DATABASE_POOL_MAX`:
 *
 *   - **pooled** (`DATABASE_POOL_MAX > 1`): an ordinary `pg.Pool`. What production
 *     against a managed PostgreSQL uses.
 *   - **serialised** (the default, `1`): one connection, with queries queued through a
 *     promise chain and the connection re-established after a transport failure.
 *
 * The serialised mode exists because local development runs against PGlite, which is a
 * *single* PostgreSQL backend behind a socket server (ADR 0001). Two concurrent
 * clients do not queue politely there — the backend drops the connection mid-query,
 * and a `pg.Pool` then hands the same dead client to the next caller. Queueing at the
 * client makes the failure mode disappear rather than papering over it with retries.
 *
 * Everything above this file sees a normal drizzle instance either way.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '@mios/config';
import * as schema from './schema/index';

export type Database = NodePgDatabase<typeof schema>;

/** Errors that mean the connection went away, as opposed to a bad query. */
const TRANSIENT = [
  'Connection terminated unexpectedly',
  'Client has encountered a connection error',
  'ECONNRESET',
  'Connection terminated due to connection timeout',
  'server closed the connection unexpectedly',
  'Client was closed and is not queryable',
];

function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return TRANSIENT.some((t) => message.includes(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One connection, queries serialised, reconnects on transport failure.
 *
 * Exposes only `query`, which is all drizzle's node-postgres driver requires.
 */
class SerialClient {
  #client: pg.Client | null = null;
  #connecting: Promise<pg.Client> | null = null;
  /** Tail of the queue: every query awaits the previous one. */
  #tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly connectionString: string) {}

  async #connect(): Promise<pg.Client> {
    if (this.#client) return this.#client;
    this.#connecting ??= (async () => {
      const client = new pg.Client({ connectionString: this.connectionString });
      // A connection-level error must not become an unhandled rejection; the next
      // query re-establishes the connection.
      client.on('error', () => {
        this.#client = null;
      });
      await client.connect();
      this.#client = client;
      this.#connecting = null;
      return client;
    })();
    return this.#connecting;
  }

  async #discard(): Promise<void> {
    const dying = this.#client;
    this.#client = null;
    this.#connecting = null;
    try {
      await dying?.end();
    } catch {
      // Already broken; a failed close changes nothing.
    }
  }

  query(...args: any[]): Promise<any> {
    const run = async (): Promise<unknown> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const client = await this.#connect();
          return await (client.query as (...a: any[]) => Promise<unknown>)(...args);
        } catch (err) {
          if (!isTransient(err)) throw err;
          lastError = err;
          await this.#discard();
          await sleep(120 * (attempt + 1));
        }
      }
      throw lastError;
    };

    // Chain onto the queue tail so only one query is in flight at a time. The catch
    // keeps one failure from poisoning every subsequent query in the chain.
    const result = this.#tail.then(run, run);
    this.#tail = result.catch(() => undefined);
    return result;
  }

  async end(): Promise<void> {
    await this.#tail.catch(() => undefined);
    await this.#discard();
  }
}

type Client = pg.Pool | SerialClient;

let client: Client | null = null;
let database: Database | null = null;

function createClient(): Client {
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '1', 10);
  const connectionString = config().DATABASE_URL;

  if (max > 1) {
    const pool = new pg.Pool({
      connectionString,
      max,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (err) => {
      if (!isTransient(err)) console.error('[db] idle client error', err.message);
    });
    return pool;
  }

  return new SerialClient(connectionString);
}

export function db(): Database {
  if (!database) {
    client = createClient();
    database = drizzle(client as any, { schema, casing: 'snake_case' });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  await client?.end();
  client = null;
  database = null;
}

/** Cheap liveness probe used by the admin surface and by scripts before they start. */
export async function pingDb(): Promise<{ ok: boolean; version: string; error?: string }> {
  try {
    db();
    const res = (await (client as Client).query('select version() as version')) as {
      rows: { version: string }[];
    };
    return { ok: true, version: res.rows[0]?.version ?? 'unknown' };
  } catch (err) {
    return { ok: false, version: '', error: err instanceof Error ? err.message : String(err) };
  }
}

export { schema };
