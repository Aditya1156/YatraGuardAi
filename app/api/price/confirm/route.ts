import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { PriceReferenceModel } from '@/lib/db/models';
import { updateRunningMedian } from '@/lib/algorithms/price-fairness';
import { normalizeName } from '@/lib/utils';
import { PRICE_CATEGORIES } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  itemName: z.string().min(1).max(120),
  fairPrice: z.number().positive().max(1_000_000),
  category: z.enum(PRICE_CATEGORIES).optional(),
});

/**
 * POST /api/price/confirm — 8.1 step 5.
 *
 * A user confirming what an item *should* cost is how the reference list grows
 * beyond the seed. Confirmations fold into a running median so no single
 * outlier can move the reference much.
 */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `price-confirm:${user.id}`, ...LIMITS.write });

  const body = bodySchema.parse(await request.json());
  const normalizedName = normalizeName(body.itemName);

  await connectToDatabase();
  const existing = await PriceReferenceModel.findOne({ city: user.city, normalizedName });

  if (!existing) {
    const created = await PriceReferenceModel.create({
      city: user.city,
      itemName: body.itemName.trim(),
      normalizedName,
      category: body.category ?? 'restaurant',
      medianPrice: body.fairPrice,
      samples: [body.fairPrice],
      sampleCount: 1,
      source: 'user-confirmed',
      aliases: [],
    });

    return ok({
      itemName: created.itemName,
      medianPrice: created.medianPrice,
      sampleCount: created.sampleCount,
      created: true,
    });
  }

  const { samples, median } = updateRunningMedian(existing.samples ?? [], body.fairPrice);
  existing.samples = samples;
  existing.medianPrice = median;
  existing.sampleCount = (existing.sampleCount ?? 0) + 1;
  existing.source = 'user-confirmed';
  await existing.save();

  return ok({
    itemName: existing.itemName,
    medianPrice: existing.medianPrice,
    sampleCount: existing.sampleCount,
    created: false,
  });
});
