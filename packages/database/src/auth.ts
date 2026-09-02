/**
 * Password hashing and session tokens.
 *
 * scrypt from the Node standard library — no dependency, memory-hard, and adequate
 * for this. Parameters are stored inside the hash string so they can be raised later
 * without invalidating existing passwords.
 *
 * Session tokens are random 32-byte values; only their SHA-256 is stored, so a
 * database disclosure does not hand over usable sessions.
 */

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64!, 'base64');
  const expected = Buffer.from(keyB64!, 'base64');

  let actual: Buffer;
  try {
    actual = await scrypt(password, salt, expected.length, {
      N: Number.parseInt(n!, 10),
      r: Number.parseInt(r!, 10),
      p: Number.parseInt(p!, 10),
      maxmem: PARAMS.maxmem,
    });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const SESSION_TTL_DAYS = 30;
