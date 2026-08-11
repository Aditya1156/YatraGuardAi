import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { PriceReferenceModel } from '@/lib/db/models';
import { bestMatch } from '@/lib/algorithms/fuzzy-match';
import { normalizeName } from '@/lib/utils';
import type { PriceCategory } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  city: z.string().min(1).optional(),
  item: z.string().max(120).optional(),
  category: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
});

/** GET /api/price/reference — look up stored reference prices for a city. */
export const GET = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `price-ref:${user.id}`, ...LIMITS.read });

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));
  const city = query.city ?? user.city;

  await connectToDatabase();
  const filter: Record<string, unknown> = { city };
  if (query.category) filter.category = query.category;

  const references = await PriceReferenceModel.find(filter)
    .select('itemName normalizedName aliases medianPrice category unit sampleCount source updatedAt')
    .sort({ category: 1, itemName: 1 })
    .limit(query.limit)
    .lean();

  const rows = references.map((reference) => ({
    itemName: reference.itemName,
    normalizedName: reference.normalizedName,
    aliases: reference.aliases ?? [],
    medianPrice: reference.medianPrice,
    category: reference.category as PriceCategory,
    unit: reference.unit ?? 'each',
    sampleCount: reference.sampleCount ?? 1,
    source: reference.source ?? 'seed',
  }));

  // With `item`, answer the single best fuzzy match rather than the whole list.
  if (query.item) {
    const match = bestMatch(normalizeName(query.item), rows);
    return ok({
      city,
      query: query.item,
      match: match ? { ...match.candidate, confidence: Math.round(match.confidence * 100) / 100 } : null,
      results: rows.slice(0, 8),
    });
  }

  return ok({ city, match: null, results: rows });
});
