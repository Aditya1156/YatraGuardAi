import { NextResponse } from 'next/server';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { readImageFromRequest } from '@/lib/api/upload';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { AllergenItemModel } from '@/lib/db/models';
import { extractDishNames } from '@/lib/ai/extract';
import {
  evaluateDish,
  summarizeFoodCheck,
  type AllergenReference,
} from '@/lib/algorithms/food-safety';
import type { Allergen, FoodCheckResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/food/check — menu photo + allergy profile → flagged dishes (8.4). */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `food:${user.id}`, ...LIMITS.ai });

  const image = await readImageFromRequest(request);

  await connectToDatabase();
  const items = await AllergenItemModel.find({ city: user.city })
    .select('dishName normalizedName aliases allergens note')
    .lean();

  const references: AllergenReference[] = items.map((item) => ({
    dishName: item.dishName,
    normalizedName: item.normalizedName,
    aliases: item.aliases ?? [],
    allergens: (item.allergens ?? []) as Allergen[],
    note: item.note ?? '',
  }));

  const dishNames = await extractDishNames(image);
  const evaluated = dishNames.map((dish) => evaluateDish(dish, references, user.allergyProfile));

  // Flagged dishes first — a user with an allergy should not have to scroll to
  // find the thing that could hurt them.
  evaluated.sort((a, b) => a.score - b.score);

  const result = summarizeFoodCheck(evaluated, user.allergyProfile, user.city);
  return ok<FoodCheckResult>(result);
});
