/**
 * Session handling.
 *
 * A random opaque token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 is
 * stored. No JWT, because a database-backed session can be revoked and a signed token
 * cannot.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { SESSION_TTL_DAYS, createSessionToken, hashSessionToken, verifyPassword } from '@mios/database/auth';
import { isProduction } from '@mios/config';

const COOKIE = 'mios_session';

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  isDemo: boolean;
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  role: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db()
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      isDemo: schema.users.isDemo,
      workspaceId: schema.workspaces.id,
      workspaceName: schema.workspaces.name,
      organizationId: schema.workspaces.organizationId,
      role: schema.memberships.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashSessionToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** Every authenticated page calls this. Redirects rather than returning null. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  // Unauthenticated visitors get the landing page rather than a bare password prompt —
  // /login is reached from "Activate NORTH", so arriving there is always a choice.
  if (!user) redirect('/welcome');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'owner' && user.role !== 'admin') redirect('/');
  return user;
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const user = await db().query.users.findFirst({
    where: eq(schema.users.email, email.trim().toLowerCase()),
  });

  // Same failure message and a comparable amount of work either way, so the response
  // does not reveal whether the address exists.
  const stored = user?.passwordHash ?? '$scrypt$32768$8$1$aaaa$bbbb';
  const valid = await verifyPassword(password, stored);
  if (!user || !valid) return { ok: false, error: 'Email or password is incorrect.' };

  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db().insert(schema.sessions).values({ userId: user.id, tokenHash, expiresAt });
  await db().update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, user.id));

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    expires: expiresAt,
  });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db().delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
  }
  jar.delete(COOKIE);
}

/**
 * When the user was last active, for "what changed since your last visit". Read before
 * the current visit updates it, so the first page of a session shows a real delta.
 */
export async function lastVisitAt(userId: string): Promise<Date | null> {
  const user = await db().query.users.findFirst({ where: eq(schema.users.id, userId) });
  return user?.lastSeenAt ?? null;
}

export async function touchLastSeen(userId: string): Promise<void> {
  await db().update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, userId));
}
