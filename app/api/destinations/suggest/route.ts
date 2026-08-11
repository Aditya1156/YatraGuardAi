import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { DestinationModel } from '@/lib/db/models';
import { suggestOffPeak, type DestinationRecord } from '@/lib/algorithms/seasonal-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  region: z.string().max(60).optional(),
  theme: z.enum(['hills', 'beach', 'heritage', 'wildlife']).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

/** GET /api/destinations/suggest — off-peak alternatives (8.6). */
export const GET = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `destinations:${user.id}`, ...LIMITS.read });

  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const month = query.month ?? new Date().getMonth() + 1;

  await connectToDatabase();
  const docs = await DestinationModel.find(query.region ? { region: query.region } : {}).lean();

  const records: DestinationRecord[] = docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    region: doc.region,
    theme: doc.theme as DestinationRecord['theme'],
    peakMonths: doc.peakMonths ?? [],
    distanceKm: doc.distanceKm ?? null,
    blurb: doc.blurb ?? '',
  }));

  const suggestions = suggestOffPeak(records, month, {
    theme: query.theme,
    region: query.region,
    limit: query.limit,
  });

  return ok({ month, theme: query.theme ?? null, suggestions });
});
