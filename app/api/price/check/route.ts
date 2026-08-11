import { NextResponse } from 'next/server';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { readImageFromRequest } from '@/lib/api/upload';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { PriceCheckModel, PriceReferenceModel } from '@/lib/db/models';
import { extractBillItems } from '@/lib/ai/extract';
import {
  matchAndScoreItems,
  summarizeCheck,
  type ReferencePrice,
} from '@/lib/algorithms/price-fairness';
import type { PriceCategory, PriceCheckResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/price/check — bill photo → OCR → deviation verdict (8.1). */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `price:${user.id}`, ...LIMITS.ai });

  const image = await readImageFromRequest(request);

  await connectToDatabase();
  const references = await PriceReferenceModel.find({ city: user.city })
    .select('itemName normalizedName aliases medianPrice category sampleCount')
    .lean();

  const referencePrices: ReferencePrice[] = references.map((reference) => ({
    itemName: reference.itemName,
    normalizedName: reference.normalizedName,
    aliases: reference.aliases ?? [],
    medianPrice: reference.medianPrice,
    category: reference.category as PriceCategory,
    sampleCount: reference.sampleCount ?? 1,
  }));

  const extracted = await extractBillItems(image);
  const items = matchAndScoreItems(extracted, referencePrices);
  const result = summarizeCheck(items, user.city);

  // An unreadable photo is not a result worth storing in the user's history.
  if (items.length > 0) {
    const saved = await PriceCheckModel.create({
      userId: user.id,
      city: user.city,
      items: items.map((item) => ({
        itemName: item.itemName,
        matchedItem: item.matchedItem,
        chargedPrice: item.chargedPrice,
        referencePrice: item.referencePrice,
        deviationPct: item.deviationPct,
        verdict: item.verdict,
      })),
      chargedTotal: result.chargedTotal,
      referenceTotal: result.referenceTotal,
      score: result.score,
      verdict: result.verdict,
    });
    result.id = String(saved._id);
  }

  return ok<PriceCheckResult>(result);
});
