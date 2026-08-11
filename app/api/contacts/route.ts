import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { UserModel } from '@/lib/db/models';
import { isValidPhone, normalizePhone } from '@/lib/algorithms/sos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTACTS = 5;

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Give the contact a name.').max(80),
  phone: z
    .string()
    .trim()
    .refine((value) => isValidPhone(value), 'Enter a 10-digit mobile number or a +country number.'),
});

/** GET /api/contacts — the user's TrustCircle. */
export const GET = route(async (): Promise<NextResponse> => {
  const user = await requireSessionUser();
  return ok({ contacts: user.trustedContacts, max: MAX_CONTACTS });
});

/** POST /api/contacts — add one contact (8.5). */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `contacts:${user.id}`, ...LIMITS.write });

  const contact = contactSchema.parse(await request.json());
  const phone = normalizePhone(contact.phone);

  if (user.trustedContacts.length >= MAX_CONTACTS) {
    throw new AppError(`You can keep up to ${MAX_CONTACTS} trusted contacts.`, 409, 'TOO_MANY');
  }
  if (user.trustedContacts.some((existing) => normalizePhone(existing.phone) === phone)) {
    throw new AppError('That number is already in your TrustCircle.', 409, 'DUPLICATE');
  }

  await connectToDatabase();
  const updated = await UserModel.findByIdAndUpdate(
    user.id,
    { $push: { trustedContacts: { name: contact.name, phone } } },
    { new: true },
  )
    .select('trustedContacts')
    .lean();

  return ok({ contacts: updated?.trustedContacts ?? [], max: MAX_CONTACTS });
});

/** DELETE /api/contacts?phone=… — remove one contact. */
export const DELETE = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `contacts:${user.id}`, ...LIMITS.write });

  const phoneParam = new URL(request.url).searchParams.get('phone');
  if (!phoneParam) throw new AppError('Which contact should be removed?', 400, 'NO_PHONE');
  const phone = normalizePhone(phoneParam);

  await connectToDatabase();
  const updated = await UserModel.findByIdAndUpdate(
    user.id,
    { $pull: { trustedContacts: { phone } } },
    { new: true },
  )
    .select('trustedContacts')
    .lean();

  return ok({ contacts: updated?.trustedContacts ?? [], max: MAX_CONTACTS });
});
