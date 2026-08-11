import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { PILOT_CITY, serverEnv } from '@/lib/config';
import { connectToDatabase } from '@/lib/db/mongoose';
import { UserModel } from '@/lib/db/models';
import type { Allergen, TrustedContact, UserProfile } from '@/types';

/**
 * Session handling.
 *
 * Firebase verifies *who* the user is; this module owns the app's own session.
 * The session is an httpOnly cookie so no token is reachable from JavaScript.
 */

export const SESSION_COOKIE = 'yg_session';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 14; // 14 days

export interface SessionUser {
  id: string;
  authId: string;
  name: string;
  email: string;
  phone: string | null;
  city: string;
  allergyProfile: Allergen[];
  trustedContacts: TrustedContact[];
  isGuest: boolean;
}

const cookieOptions = {
  httpOnly: true,
  secure: serverEnv.isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_S,
};

/* -------------------------------------------------------------------------- */
/* Guest sessions (demo only, disabled unless ALLOW_GUEST_LOGIN=true)          */
/* -------------------------------------------------------------------------- */

function guestSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'Guest login needs SESSION_SECRET (32+ characters) so guest cookies can be signed.',
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', guestSecret()).update(value).digest('base64url');
}

export function mintGuestSession(): { cookie: string; authId: string } {
  const authId = `guest:${randomUUID()}`;
  return { cookie: `${authId}.${sign(authId)}`, authId };
}

function verifyGuestCookie(cookie: string): string | null {
  const separator = cookie.lastIndexOf('.');
  if (separator <= 0) return null;

  const authId = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  if (!authId.startsWith('guest:')) return null;

  const expected = Buffer.from(sign(authId));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return null;
  return timingSafeEqual(expected, provided) ? authId : null;
}

/* -------------------------------------------------------------------------- */
/* Cookie read/write                                                           */
/* -------------------------------------------------------------------------- */

export function setSessionCookie(value: string): void {
  cookies().set(SESSION_COOKIE, value, cookieOptions);
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}

export { SESSION_MAX_AGE_S };

/** Resolves the cookie to a Firebase UID or a signed guest id. */
async function resolveAuthId(): Promise<string | null> {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  if (raw.startsWith('guest:')) {
    if (!serverEnv.allowGuestLogin) return null;
    try {
      return verifyGuestCookie(raw);
    } catch {
      return null;
    }
  }

  try {
    const { adminAuth } = await import('@/lib/firebase/admin');
    // checkRevoked=true so a signed-out or disabled account loses access at once.
    const decoded = await adminAuth().verifySessionCookie(raw, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

function toSessionUser(doc: {
  _id: unknown;
  authId: string;
  name: string;
  email: string;
  phone?: string | null;
  city: string;
  allergyProfile: string[];
  trustedContacts: { name: string; phone: string }[];
}): SessionUser {
  return {
    id: String(doc._id),
    authId: doc.authId,
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? null,
    city: doc.city,
    allergyProfile: doc.allergyProfile as Allergen[],
    trustedContacts: doc.trustedContacts.map((c) => ({ name: c.name, phone: c.phone })),
    isGuest: doc.authId.startsWith('guest:'),
  };
}

/** Current user, or null when signed out. Never throws on a bad cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const authId = await resolveAuthId();
  if (!authId) return null;

  await connectToDatabase();
  const user = await UserModel.findOne({ authId }).lean();
  if (!user) return null;

  return toSessionUser({
    _id: user._id,
    authId: user.authId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    allergyProfile: user.allergyProfile ?? [],
    trustedContacts: user.trustedContacts ?? [],
  });
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED';
  constructor() {
    super('Sign in to use this.');
    this.name = 'UnauthorizedError';
  }
}

/** Use inside API routes that Section 7 marks "Auth: Required". */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Creates the user row on first sign-in, refreshes `lastSeenAt` after that. */
export async function upsertUser(input: {
  authId: string;
  name: string;
  email: string;
  phone?: string | null;
}): Promise<SessionUser> {
  await connectToDatabase();

  const user = await UserModel.findOneAndUpdate(
    { authId: input.authId },
    {
      $set: { lastSeenAt: new Date() },
      $setOnInsert: {
        authId: input.authId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? undefined,
        city: PILOT_CITY,
        allergyProfile: [],
        trustedContacts: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (!user) throw new Error('Could not create the user profile.');

  return toSessionUser({
    _id: user._id,
    authId: user.authId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    allergyProfile: user.allergyProfile ?? [],
    trustedContacts: user.trustedContacts ?? [],
  });
}

export function toPublicProfile(user: SessionUser, createdAt = new Date()): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    city: user.city,
    allergyProfile: user.allergyProfile,
    trustedContacts: user.trustedContacts,
    createdAt: createdAt.toISOString(),
  };
}
