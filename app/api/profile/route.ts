import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser, toPublicProfile } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { UserModel } from '@/lib/db/models';
import { isValidPhone, normalizePhone } from '@/lib/algorithms/sos';
import { ALLERGENS } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidPhone(value), 'Enter a valid mobile number.')
    .optional(),
  allergyProfile: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).optional(),
});

/** GET /api/profile */
export const GET = route(async (): Promise<NextResponse> => {
  const user = await requireSessionUser();
  return ok({ profile: toPublicProfile(user) });
});

/** PATCH /api/profile — name, phone and the allergy profile used by 8.4. */
export const PATCH = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `profile:${user.id}`, ...LIMITS.write });

  const body = patchSchema.parse(await request.json());

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone ? normalizePhone(body.phone) : undefined;
  if (body.allergyProfile !== undefined) {
    update.allergyProfile = Array.from(new Set(body.allergyProfile));
  }

  await connectToDatabase();
  const updated = await UserModel.findByIdAndUpdate(user.id, { $set: update }, { new: true }).lean();

  return ok({
    profile: toPublicProfile({
      ...user,
      name: updated?.name ?? user.name,
      phone: updated?.phone ?? null,
      allergyProfile: (updated?.allergyProfile ?? user.allergyProfile) as typeof user.allergyProfile,
    }),
  });
});
