import { NextResponse } from 'next/server';

/**
 * Skip set-up.
 *
 * Every question on the set-up page is optional, so refusing all of them at once has to
 * be possible too — a general brief is a reasonable thing to want.
 *
 * The cookie is set on the redirect response itself rather than through `cookies()`.
 * Mutations made through that helper do not attach to a `NextResponse.redirect`, so the
 * browser followed the redirect without the cookie, the layout saw an unset flag and
 * sent it straight back to set-up. An infinite loop that only appears when you click the
 * one control meant to escape.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('north_setup_seen', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
