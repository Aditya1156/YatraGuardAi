import 'server-only';

import type { z } from 'zod';
import { requireGemini, serverEnv } from '@/lib/config';
import { AppError } from '@/lib/api/respond';

/**
 * Minimal Gemini client over the REST API.
 *
 * Deliberately not using an SDK: the REST surface is stable, it adds zero
 * dependencies to the serverless bundle, and it keeps the free-tier request
 * shape completely visible when debugging quota errors.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ImagePart {
  mimeType: string;
  /** Raw base64 — no `data:` prefix. */
  data: string;
}

interface GeminiRequest {
  systemInstruction: string;
  prompt: string;
  image?: ImagePart;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function callGemini(request: GeminiRequest, attempt = 0): Promise<string> {
  const apiKey = requireGemini();
  const model = serverEnv.geminiModel;

  const parts: Record<string, unknown>[] = [{ text: request.prompt }];
  if (request.image) {
    parts.push({ inlineData: { mimeType: request.image.mimeType, data: request.image.data } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          // Always ask for JSON so parsing never depends on prose formatting.
          responseMimeType: 'application/json',
          temperature: request.temperature ?? 0.1,
          maxOutputTokens: request.maxOutputTokens ?? 2048,
        },
        safetySettings: [
          // Scam messages quote abusive text; blocking them would break the
          // one feature whose whole job is to read hostile content.
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    });
  } catch (error) {
    clearTimeout(timeout);
    if (attempt < 2) return callGemini(request, attempt + 1);
    throw new AppError(
      error instanceof Error && error.name === 'AbortError'
        ? 'The AI check timed out. Try again with a clearer photo.'
        : 'Could not reach the AI service. Check your connection and retry.',
      504,
      'AI_UNREACHABLE',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (RETRYABLE.has(response.status) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      return callGemini(request, attempt + 1);
    }
    const body = (await response.json().catch(() => null)) as GeminiResponse | null;
    const detail = body?.error?.message ?? response.statusText;
    console.error('[gemini]', response.status, detail);

    if (response.status === 429) {
      throw new AppError(
        'The free AI quota for today is used up. Try again later.',
        429,
        'AI_QUOTA',
      );
    }
    if (response.status === 400 || response.status === 403) {
      throw new AppError('The AI service rejected the request — check GEMINI_API_KEY.', 502, 'AI_AUTH');
    }
    if (response.status === 404) {
      // Google retires model ids periodically; say so plainly instead of
      // leaving someone to guess why a working app stopped working.
      throw new AppError(
        `The AI model "${model}" is not available on this key. Set GEMINI_MODEL to a current one — list them with: curl "https://generativelanguage.googleapis.com/v1beta/models" -H "x-goog-api-key: $GEMINI_API_KEY"`,
        502,
        'AI_MODEL_GONE',
      );
    }
    throw new AppError('The AI service is unavailable right now.', 502, 'AI_ERROR');
  }

  const body = (await response.json()) as GeminiResponse;

  if (body.promptFeedback?.blockReason) {
    throw new AppError('The AI declined to analyse that content.', 422, 'AI_BLOCKED');
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new AppError('The AI returned an empty result. Try again.', 502, 'AI_EMPTY');
  }
  return text;
}

/** Strips ``` fences the model occasionally adds despite responseMimeType. */
function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
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

/**
 * Calls Gemini and validates the JSON it returns against `schema`.
 *
 * The schema's input type is pinned to `unknown` so `T` is always inferred from
 * the *parsed* shape — otherwise fields with `.default()` come back optional.
 */
export async function generateJson<T>(
  request: GeminiRequest,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  const raw = await callGemini(request);
  const parsed = schema.safeParse(extractJson(raw));

  if (!parsed.success) {
    console.error('[gemini] schema mismatch', parsed.error.issues.slice(0, 3), raw.slice(0, 400));
    throw new AppError('The AI returned an unexpected result. Try again.', 502, 'AI_SHAPE');
  }
  return parsed.data;
}
