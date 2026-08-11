import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { geocode } from '@/lib/routing/openrouteservice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().trim().min(2).max(120) });

/**
 * GET /api/geocode — landmark search for the route planner's inputs.
 * Results are constrained to the pilot city's bounding box.
 */
export const GET = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `geocode:${user.id}`, ...LIMITS.routing });

  const { q } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const results = await geocode(q);

  return ok({ query: q, results });
});
