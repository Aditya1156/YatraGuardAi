import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { RiskZoneModel } from '@/lib/db/models';
import { selectRoutes, type ScoredZone } from '@/lib/algorithms/safe-route';
import { fetchRoutes } from '@/lib/routing/openrouteservice';
import type { RoutePlanResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(160).default(''),
});

const bodySchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  profile: z.enum(['foot-walking', 'driving-car', 'cycling-regular']).default('foot-walking'),
});

/** POST /api/route/plan — fastest and safest options between two points (8.3). */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `route:${user.id}`, ...LIMITS.routing });

  const body = bodySchema.parse(await request.json());

  await connectToDatabase();
  const zoneDocs = await RiskZoneModel.find({ city: user.city }).lean();
  const zones: ScoredZone[] = zoneDocs.map((zone) => ({
    name: zone.name,
    riskLevel: zone.riskLevel,
    notes: [zone.notes, zone.activeHours].filter(Boolean).join(' '),
    polygon: (zone.polygon?.coordinates ?? []) as number[][][],
  }));

  const raws = await fetchRoutes(body.origin, body.destination, body.profile);
  const { fastest, safest } = selectRoutes(raws, zones);

  // When ORS returns a single route, "fastest" and "safest" are the same path —
  // showing a toggle between two identical routes would be a lie.
  const sameRoute = fastest.geometry.length === safest.geometry.length && fastest.durationS === safest.durationS;

  const result: RoutePlanResult = {
    city: user.city,
    origin: body.origin,
    destination: body.destination,
    fastest: sameRoute ? null : fastest,
    safest,
  };

  return ok(result);
});
