import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, ok, route } from '@/lib/api/respond';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { SosEventModel } from '@/lib/db/models';
import { buildSosLinks, buildSosMessage, mapsUrl } from '@/lib/algorithms/sos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
  accuracyM: z.number().nonnegative().max(100_000).nullable().default(null),
  note: z.string().trim().max(300).default(''),
});

/**
 * POST /api/sos/trigger — 8.5.
 *
 * The server does not send anything itself: it composes the message and the
 * deep links, logs the event, and hands the links back for the client to open.
 * That keeps SOS working with zero paid SMS gateway and no delivery service in
 * the path between the user and their contacts.
 */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  // Deliberately generous: someone in trouble may well tap this several times.
  enforceRateLimit({ key: `sos:${user.id}`, limit: 20, windowMs: 60_000 });

  const body = bodySchema.parse(await request.json());

  if (user.trustedContacts.length === 0) {
    throw new AppError(
      'Add at least one trusted contact before using SOS.',
      409,
      'NO_CONTACTS',
    );
  }

  const message = buildSosMessage({
    userName: user.name,
    location: body.location,
    accuracyM: body.accuracyM,
    note: body.note,
  });

  const links = buildSosLinks(user.trustedContacts, message);

  await connectToDatabase();
  const event = await SosEventModel.create({
    userId: user.id,
    location: body.location ?? undefined,
    accuracyM: body.accuracyM ?? undefined,
    triggeredAt: new Date(),
    contactsNotified: user.trustedContacts.map((contact) => contact.phone),
    note: body.note,
  });

  return ok({
    id: String(event._id),
    message,
    mapsUrl: body.location ? mapsUrl(body.location) : null,
    triggeredAt: event.triggeredAt.toISOString(),
    links,
  });
});

/** GET /api/sos/trigger — the user's own SOS history. */
export const GET = route(async (): Promise<NextResponse> => {
  const user = await requireSessionUser();

  await connectToDatabase();
  const events = await SosEventModel.find({ userId: user.id })
    .sort({ triggeredAt: -1 })
    .limit(20)
    .lean();

  return ok({
    events: events.map((event) => ({
      id: String(event._id),
      location:
        typeof event.location?.lat === 'number' && typeof event.location?.lng === 'number'
          ? { lat: event.location.lat, lng: event.location.lng }
          : null,
      triggeredAt: (event.triggeredAt ?? new Date()).toISOString(),
      contactsNotified: event.contactsNotified ?? [],
      note: event.note ?? '',
    })),
  });
});
