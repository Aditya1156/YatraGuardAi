import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { ScamReportModel } from '@/lib/db/models';
import { patternKey } from '@/lib/algorithms/scam-detector';
import type { ScamAlert, ScamCategory } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  city: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
});

interface AggregateRow {
  _id: string;
  count: number;
  lastSeen: Date;
  category: ScamCategory;
  pattern: string;
  example: string;
}

/**
 * GET /api/scam/alerts — repeated scam patterns reported in a city (8.2 step 4).
 *
 * Grouping happens in MongoDB rather than in Node so the feed stays cheap as
 * the report count grows.
 */
export const GET = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `alerts:${user.id}`, ...LIMITS.read });

  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const city = query.city ?? user.city;
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

  await connectToDatabase();

  const rows = await ScamReportModel.aggregate<AggregateRow>([
    { $match: { city, category: { $in: ['scam', 'suspicious'] }, createdAt: { $gte: since } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $toLower: '$pattern' },
        count: { $sum: 1 },
        lastSeen: { $max: '$createdAt' },
        category: { $first: '$category' },
        pattern: { $first: '$pattern' },
        // A short excerpt is enough to recognise the scam without republishing
        // whatever personal detail happened to be in the original message.
        example: { $first: { $substrCP: ['$explanation', 0, 160] } },
      },
    },
    { $sort: { count: -1, lastSeen: -1 } },
    { $limit: 20 },
  ]);

  const alerts: ScamAlert[] = rows.map((row) => ({
    id: patternKey(row._id),
    city,
    pattern: row.pattern,
    category: row.category,
    reportCount: row.count,
    lastSeen: new Date(row.lastSeen).toISOString(),
    example: row.example,
  }));

  return ok({ city, days: query.days, alerts });
});
