import 'server-only';

import { AppError } from '@/lib/api/respond';

/**
 * The shape every AI provider speaks, and the JSON handling they share.
 *
 * Kept separate from any one provider so adding a fallback did not mean
 * duplicating the fence-stripping and brace-recovery logic, which is where
 * subtle differences between providers would otherwise creep in.
 */

export interface ImagePart {
  mimeType: string;
  /** Base64, no data: prefix. */
  data: string;
}

export interface AiRequest {
  systemInstruction: string;
  prompt: string;
  image?: ImagePart;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Returns raw model text; throws AppError with an `AI_*` code on failure. */
export type AiProvider = (request: AiRequest) => Promise<string>;

/**
 * Failures that mean "this provider cannot serve the request right now" and so
 * are worth retrying elsewhere.
 *
 * `AI_BLOCKED` is deliberately absent: that is a content decision, not an
 * availability problem, and shopping it to another provider would be working
 * around a refusal rather than around an outage.
 */
export const FAILOVER_CODES = new Set(['AI_QUOTA', 'AI_UNREACHABLE', 'AI_MODEL_GONE', 'AI_ERROR']);

/** Strips ``` fences models add despite being asked for raw JSON. */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Some models wrap the object in a sentence. Recover the outermost
    // bracketed span rather than failing on the prose around it.
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through to the shared error below */
      }
    }
    throw new AppError('The AI response could not be read. Try again.', 502, 'AI_PARSE');
  }
}
