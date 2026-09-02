/**
 * Environment configuration.
 *
 * Parsed once, validated with Zod, and exposed as a frozen object. Missing optional
 * credentials are never an error — they produce a `not_configured` capability that the
 * UI reports honestly. Missing *required* configuration in production is a hard failure
 * at boot rather than a surprise at request time.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { IntegrationStatus } from '@mios/domain';

/**
 * Loads the repository-root `.env`.
 *
 * The monorepo keeps one `.env` at the root, but consumers run from different working
 * directories — Next from `apps/web`, scripts and vitest from the root — and each tool
 * has its own idea of where to look. Rather than duplicating the file, this walks up
 * for the repository root and reads it once. Real environment variables always win, so
 * a deployment that injects them needs no file at all.
 */
function loadRootEnv(): void {
  for (const start of searchRoots()) {
    let dir = start;
    for (let depth = 0; depth < 8; depth++) {
      if (existsSync(resolve(dir, '.env')) && existsSync(resolve(dir, 'package-lock.json'))) {
        applyEnvFile(resolve(dir, '.env'));
        return;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
}

/**
 * Where to start walking up from.
 *
 * This module's own location comes first, because it is stable: the repository root is
 * a fixed number of directories above `packages/config/src`, whatever the process was
 * launched from. `process.cwd()` is only a fallback, and is wrapped in try/catch — it
 * throws `EPERM: uv_cwd` in some sandboxed and bundled contexts, and an uncaught throw
 * here would take down every consumer of `config()` at import time. That is not
 * hypothetical: it broke the whole Next server once.
 */
function searchRoots(): string[] {
  const roots: string[] = [];

  try {
    if (typeof import.meta.url === 'string') {
      roots.push(dirname(fileURLToPath(import.meta.url)));
    }
  } catch {
    // No usable module URL (CJS interop). Fall through to cwd.
  }

  try {
    roots.push(process.cwd());
  } catch {
    // cwd unavailable; the module-relative root above is sufficient.
  }

  return roots;
}

function applyEnvFile(path: string): void {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // never override a real variable

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const bool = (dflt: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : v === 'true' || v === '1'));

const int = (dflt: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : Number.parseInt(v, 10)))
    .pipe(z.number().int());

const num = (dflt: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : Number.parseFloat(v)))
    .pipe(z.number());

const str = (dflt: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : v));

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: str('http://localhost:3000'),

  DATABASE_URL: str('postgres://postgres:postgres@127.0.0.1:55432/postgres'),
  PGLITE_DATA_DIR: str('./data/pglite'),
  PGLITE_PORT: int(55432),

  SESSION_SECRET: optionalSecret,

  AI_PROVIDER: z.enum(['deterministic', 'anthropic']).default('deterministic'),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_BASE_URL: str('https://api.anthropic.com'),
  AI_MODEL: str('claude-sonnet-5'),
  AI_MAX_OUTPUT_TOKENS: int(4096),
  AI_MAX_USD_PER_RUN: num(2),

  EMBEDDING_PROVIDER: z.enum(['none', 'voyage']).default('none'),
  VOYAGE_API_KEY: optionalSecret,

  STT_PROVIDER: z.enum(['browser', 'none', 'deepgram']).default('browser'),
  TTS_PROVIDER: z.enum(['browser', 'none', 'elevenlabs']).default('browser'),
  DEEPGRAM_API_KEY: optionalSecret,
  ELEVENLABS_API_KEY: optionalSecret,
  VOICE_PERSIST_AUDIO: bool(false),

  INGEST_USER_AGENT: str('MarketIntelligenceOS/0.1 (+contact: set-your-email)'),
  INGEST_TIMEOUT_MS: int(15_000),
  INGEST_MAX_BYTES: int(5_242_880),
  INGEST_ENABLED: bool(true),
  INGEST_REQUIRE_RIGHTS_REVIEW: bool(true),
  INGEST_DENY_HOSTS: str(''),

  FEATURE_SEMANTIC_SEARCH: bool(false),
  FEATURE_VOICE: bool(true),
  FEATURE_ADMIN: bool(true),
});

export type Env = z.infer<typeof EnvSchema>;

const DEV_SESSION_SECRET = 'dev-only-insecure-session-secret-do-not-use-in-production!!';

function load(): Env {
  loadRootEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
    }
    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      throw new Error('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY');
    }
  }
  return Object.freeze(env);
}

let cached: Env | null = null;
export function config(): Env {
  cached ??= load();
  return cached;
}

/** Test seam — resets the memoised config after mutating process.env. */
export function resetConfigForTests(): void {
  cached = null;
}

export function sessionSecret(): string {
  const env = config();
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.NODE_ENV === 'production') throw new Error('SESSION_SECRET missing in production');
  return DEV_SESSION_SECRET;
}

export const isProduction = (): boolean => config().NODE_ENV === 'production';
export const isTest = (): boolean => config().NODE_ENV === 'test';

// ── Capability reporting ─────────────────────────────────────────────────────

export interface Capability {
  key: string;
  label: string;
  status: IntegrationStatus;
  /** One sentence the UI can show verbatim. No marketing, no hedging. */
  detail: string;
}

/**
 * The honest-status contract in one function. Every optional integration resolves to a
 * capability with a status the UI renders as-is, so nothing can appear available when
 * it is not.
 */
export function capabilities(): Capability[] {
  const env = config();
  const out: Capability[] = [];

  if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
    out.push({
      key: 'ai',
      label: 'Language model',
      status: 'live',
      detail: `Anthropic ${env.AI_MODEL}. Outputs are schema-validated and evidence-checked before display.`,
    });
  } else if (env.AI_PROVIDER === 'anthropic') {
    out.push({
      key: 'ai',
      label: 'Language model',
      status: 'blocked_by_credentials',
      detail:
        'AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. Falling back to extractive generation.',
    });
  } else {
    out.push({
      key: 'ai',
      label: 'Language model',
      status: 'fallback_active',
      detail:
        'No model configured. Insights and answers are generated extractively: sentences are selected from stored evidence and never rewritten or invented.',
    });
  }

  out.push({
    key: 'embeddings',
    label: 'Semantic search',
    status: env.EMBEDDING_PROVIDER === 'none' ? 'not_configured' : 'live',
    detail:
      env.EMBEDDING_PROVIDER === 'none'
        ? 'No embedding provider. Search uses PostgreSQL full-text search only; the semantic retrieval interface exists but is not wired to a model.'
        : `Embeddings via ${env.EMBEDDING_PROVIDER}.`,
  });

  out.push({
    key: 'stt',
    label: 'Speech to text',
    status:
      env.STT_PROVIDER === 'none'
        ? 'not_configured'
        : env.STT_PROVIDER === 'browser'
          ? 'live'
          : env.DEEPGRAM_API_KEY
            ? 'live'
            : 'blocked_by_credentials',
    detail:
      env.STT_PROVIDER === 'browser'
        ? 'Uses the browser Web Speech API on the user’s own device. No audio is sent to this server. Availability depends on the browser and is detected at runtime.'
        : env.STT_PROVIDER === 'none'
          ? 'Voice input disabled. The Companion accepts text only.'
          : env.DEEPGRAM_API_KEY
            ? 'Server-side transcription configured.'
            : 'STT_PROVIDER set but no API key provided.',
  });

  out.push({
    key: 'tts',
    label: 'Spoken responses',
    status:
      env.TTS_PROVIDER === 'none'
        ? 'not_configured'
        : env.TTS_PROVIDER === 'browser'
          ? 'live'
          : env.ELEVENLABS_API_KEY
            ? 'live'
            : 'blocked_by_credentials',
    detail:
      env.TTS_PROVIDER === 'browser'
        ? 'Uses the browser speech synthesis API on the user’s own device.'
        : env.TTS_PROVIDER === 'none'
          ? 'Spoken responses disabled.'
          : env.ELEVENLABS_API_KEY
            ? 'Server-side speech synthesis configured.'
            : 'TTS_PROVIDER set but no API key provided.',
  });

  out.push({
    key: 'ingestion',
    label: 'Source ingestion',
    status: env.INGEST_ENABLED ? 'live' : 'disabled',
    detail: env.INGEST_ENABLED
      ? `Outbound fetching enabled${env.INGEST_REQUIRE_RIGHTS_REVIEW ? '; sources without a completed rights review are refused' : '; RIGHTS REVIEW ENFORCEMENT IS OFF'}.`
      : 'INGEST_ENABLED=false — no outbound requests are made.',
  });

  return out;
}

/** Hosts the URL fetcher must never reach, beyond the automatic private-range block. */
export function ingestDenyHosts(): string[] {
  return config()
    .INGEST_DENY_HOSTS.split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}
