import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, fail, ok, route } from '@/lib/api/respond';
import { LIMITS, clientIp, enforceRateLimit } from '@/lib/api/rate-limit';
import { serverEnv } from '@/lib/config';
import {
  SESSION_MAX_AGE_S,
  clearSessionCookie,
  getSessionUser,
  mintGuestSession,
  setSessionCookie,
  upsertUser,
} from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.union([
  z.object({ idToken: z.string().min(20) }),
  z.object({ guest: z.literal(true), name: z.string().min(1).max(60).optional() }),
]);

/** POST /api/auth/session — exchange a Firebase ID token for an app session. */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  enforceRateLimit({ key: `auth:${clientIp(request)}`, ...LIMITS.auth });

  const body = bodySchema.parse(await request.json());

  if ('guest' in body) {
    if (!serverEnv.allowGuestLogin) {
      throw new AppError('Guest sign-in is disabled on this deployment.', 403, 'GUEST_DISABLED');
    }

    const { cookie, authId } = mintGuestSession();
    const user = await upsertUser({
      authId,
      name: body.name?.trim() || 'Guest traveller',
      email: `${authId.replace('guest:', 'guest-')}@yatraguard.local`,
    });

    setSessionCookie(cookie);
    return ok({ user });
  }

  const { adminAuth } = await import('@/lib/firebase/admin');
  const auth = adminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(body.idToken, true);
  } catch {
    throw new AppError('That sign-in could not be verified. Try again.', 401, 'BAD_TOKEN');
  }

  // Firebase issues the session cookie; it is httpOnly and revocable server-side.
  const sessionCookie = await auth.createSessionCookie(body.idToken, {
    expiresIn: SESSION_MAX_AGE_S * 1000,
  });

  const user = await upsertUser({
    authId: decoded.uid,
    name: decoded.name ?? decoded.email?.split('@')[0] ?? 'Traveller',
    email: decoded.email ?? `${decoded.uid}@yatraguard.local`,
    phone: decoded.phone_number ?? null,
  });

  setSessionCookie(sessionCookie);
  return ok({ user });
});

/** GET /api/auth/session — who am I? */
export const GET = route(async (): Promise<NextResponse> => {
  const user = await getSessionUser();
  return user ? ok({ user }) : fail('Not signed in.', 401, 'UNAUTHORIZED');
});

/** DELETE /api/auth/session — sign out. */
export const DELETE = route(async (): Promise<NextResponse> => {
  clearSessionCookie();
  return ok({ signedOut: true });
});
