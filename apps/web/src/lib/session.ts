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
import {
  SESSION_TTL_DAYS,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '@mios/database/auth';
import { config, isProduction } from '@mios/config';

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

/**
 * The shared account used when `AUTH_MODE=open`.
 *
 * Everyone who walks in past the landing page is this user. Preferences, reading state
 * and saved insights therefore belong to the workspace rather than to an individual —
 * which is the trade open mode makes, and the reason it is not the default.
 */
async function sharedWorkspaceUser(): Promise<SessionUser | null> {
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
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .orderBy(schema.users.createdAt)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * True while building the static export.
 *
 * `cookies()` cannot be called during a static build — there is no request — so every
 * path that touches one has to be skipped. The static build is open-access by
 * construction: there is no server to check a session against.
 */
export const IS_STATIC_EXPORT = process.env.STATIC_EXPORT === '1';

export async function currentUser(): Promise<SessionUser | null> {
  // No request, no cookie to read. The static build has one shared identity.
  if (IS_STATIC_EXPORT) return sharedWorkspaceUser();
  // Open mode: no cookie, no session, no password. The landing page is the door.
  if (config().AUTH_MODE === 'open') return sharedWorkspaceUser();

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

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
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
  await db()
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, user.id));

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    expires: expiresAt,
  });
  return { ok: true };
}

/**
 * Creates an account against an invite code.
 *
 * Invite codes rather than open sign-up: this is a product being shown to named
 * colleagues for feedback, not a public service, and an open form on a URL that gets
 * forwarded is how you end up with strangers in your workspace. The code lives in
 * `SIGNUP_INVITE_CODE`, so rotating it is a deployment setting rather than a migration.
 *
 * Each person gets their own user row, so their reading history, saved insights and
 * knowledge state are genuinely theirs. They join the shared workspace as a member,
 * which is what makes the corpus common and the experience individual.
 */
export async function signUp(input: {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
}): Promise<{ ok: boolean; error?: string }> {
  const expected = config().SIGNUP_INVITE_CODE;
  if (!expected) {
    return { ok: false, error: 'Sign-up is not enabled on this deployment.' };
  }
  // Compared after trimming only: a code the user pasted with a trailing space should
  // still work, but case and content must match.
  if (input.inviteCode.trim() !== expected) {
    return { ok: false, error: 'That invite code is not valid.' };
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }
  if (input.password.length < 12) {
    return { ok: false, error: 'Use at least 12 characters — this is a shared deployment.' };
  }

  const existing = await db().query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { ok: false, error: 'An account already exists for that address.' };

  // Join the workspace that already holds the corpus. Creating a second workspace would
  // give the new user an empty product and no way to see why.
  const workspace = await db().query.workspaces.findFirst();
  if (!workspace) return { ok: false, error: 'No workspace is configured. Run the seed first.' };

  const [user] = await db()
    .insert(schema.users)
    .values({
      email,
      name: input.name.trim().slice(0, 120) || email.split('@')[0]!,
      passwordHash: await hashPassword(input.password),
      isDemo: false,
    })
    .returning();

  await db()
    .insert(schema.memberships)
    .values({ userId: user!.id, workspaceId: workspace.id, role: 'member' })
    .onConflictDoNothing();

  // A profile with sensible defaults, so the product is usable before onboarding exists.
  await db()
    .insert(schema.userProfiles)
    .values({
      userId: user!.id,
      workspaceId: workspace.id,
      role: 'Consultant',
      industrySlugs: [],
      topicSlugs: [],
      technologySlugs: [],
      dailyReadingMinutes: 12,
      preferredDepth: 'executive',
    })
    .onConflictDoNothing();

  return signIn(email, input.password);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db()
      .delete(schema.sessions)
      .where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
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
  await db()
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, userId));
}
