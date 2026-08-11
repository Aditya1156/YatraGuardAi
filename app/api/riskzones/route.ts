import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { RiskZoneModel } from '@/lib/db/models';
import type { RiskZone } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({ city: z.string().min(1).optional() });

/** GET /api/riskzones — polygons for the map overlay (8.3). */
export const GET = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `riskzones:${user.id}`, ...LIMITS.read });

  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const city = query.city ?? user.city;

  await connectToDatabase();
  const zones = await RiskZoneModel.find({ city }).lean();

  const payload: RiskZone[] = zones.map((zone) => ({
    id: String(zone._id),
    city: zone.city,
    name: zone.name,
    riskLevel: zone.riskLevel,
    source: (zone.source ?? 'curated') as 'curated' | 'user-report',
    notes: [zone.notes, zone.activeHours].filter(Boolean).join(' '),
    polygon: (zone.polygon?.coordinates ?? []) as number[][][],
  }));

  return ok({ city, zones: payload });
});
