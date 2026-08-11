import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'yg_session';

/**
 * Cheap gate only.
 *
 * Middleware runs on the edge runtime, which cannot verify a Firebase session
 * cookie (that needs Node crypto and the Admin SDK). So this only checks the
 * cookie's *presence* to avoid a pointless render, and redirects signed-in
 * users away from /login. Real verification happens in app/(app)/layout.tsx.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!hasSession && PROTECTED.some((prefix) => pathname.startsWith(prefix))) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

const PROTECTED = [
  '/dashboard',
  '/scan',
  '/scam',
  '/routes',
  '/food',
  '/alerts',
  '/profile',
  '/sos',
  '/discover',
];

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/scan/:path*',
    '/scam/:path*',
    '/routes/:path*',
    '/food/:path*',
    '/alerts/:path*',
    '/profile/:path*',
    '/sos/:path*',
    '/discover/:path*',
  ],
};
