import 'server-only';

import type { z } from 'zod';
import { serverEnv } from '@/lib/config';
import { AppError } from '@/lib/api/respond';
import { FAILOVER_CODES, extractJson, type AiRequest } from './contract';
import { callGemini } from './gemini';
import { callOpenRouter } from './openrouter';

export type { AiRequest, ImagePart } from './contract';

/**
 * Runs an AI request and validates the JSON it returns.
 *
 * Gemini is the primary provider — Section 3 of the master prompt locks the
 * stack to it, and its vision OCR is the verified path. OpenRouter is a
 * fallback for availability failures only, because Gemini's free tier allows
 * 20 requests/day on the full flash models and running out mid-demo is a real
 * scenario, not a hypothetical one.
 *
 * The schema's input type is pinned to `unknown` so `T` is always inferred from
 * the *parsed* shape — otherwise fields with `.default()` come back optional.
 */
export async function generateJson<T>(
  request: AiRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  let raw: string;
  let source = 'gemini';

  try {
    raw = await callGemini(request);
  } catch (error) {
    const code = error instanceof AppError ? error.code : undefined;
    const canFailover =
      serverEnv.openRouterApiKey !== undefined && code !== undefined && FAILOVER_CODES.has(code);

    if (!canFailover) throw error;

    console.warn(`[ai] gemini failed with ${code}; falling back to openrouter`);
    source = 'openrouter';
    raw = await callOpenRouter(request);
  }

  const parsed = schema.safeParse(extractJson(raw));
  if (!parsed.success) {
    console.error(`[ai:${source}] schema mismatch`, parsed.error.issues.slice(0, 3), raw.slice(0, 400));
    throw new AppError('The AI returned an unexpected result. Try again.', 502, 'AI_SHAPE');
  }
  return parsed.data;
}
