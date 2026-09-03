import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Skip set-up.
 *
 * Every question on the set-up page is optional, so refusing all of them at once has to
 * be possible too. Marks the browser as having seen it and lets them in — a general
 * brief is a perfectly reasonable thing to want.
 */
export async function GET(request: Request) {
  (await cookies()).set('north_setup_seen', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.redirect(new URL('/', request.url));
}
