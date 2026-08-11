import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, route } from '@/lib/api/respond';
import { LIMITS, enforceRateLimit } from '@/lib/api/rate-limit';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { ScamReportModel } from '@/lib/db/models';
import { classifyMessage } from '@/lib/ai/extract';
import type { ScamCheckResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().trim().min(3, 'Paste the message first.').max(5000),
});

/** POST /api/scam/check — classify a pasted message (8.2). */
export const POST = route(async (request: Request): Promise<NextResponse> => {
  const user = await requireSessionUser();
  enforceRateLimit({ key: `scam:${user.id}`, ...LIMITS.ai });

  const { text } = bodySchema.parse(await request.json());
  const { result, pattern, patternKey } = await classifyMessage(text);

  // Only suspicious/scam verdicts are kept — a safe message is not evidence of
  // anything, and storing every pasted text would be needless data collection.
  if (result.category !== 'safe') {
    await connectToDatabase();
    const saved = await ScamReportModel.create({
      userId: user.id,
      city: user.city,
      rawText: text.slice(0, 5000),
      category: result.category,
      confidence: result.confidence,
      score: result.score,
      explanation: result.explanation,
      signals: result.signals,
      pattern,
      patternKey,
    });
    result.id = String(saved._id);
  }

  return ok<ScamCheckResult>(result);
});
