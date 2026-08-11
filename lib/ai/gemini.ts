import 'server-only';

import { requireGemini, serverEnv } from '@/lib/config';
import { AppError } from '@/lib/api/respond';
import type { AiRequest } from './contract';

/**
 * Minimal Gemini client over the REST API. Primary provider — see provider.ts
 * for the failover policy.
 *
 * Deliberately not using an SDK: the REST surface is stable, it adds zero
 * dependencies to the serverless bundle, and it keeps the free-tier request
 * shape completely visible when debugging quota errors.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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

export async function callGemini(request: AiRequest, attempt = 0): Promise<string> {
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
          // Current flash models are thinking models, and reasoning tokens are
          // charged against maxOutputTokens before a single character of JSON
          // is emitted — a 512 budget was spending 484 on thought and
          // truncating the answer mid-object. Thinking cannot be switched off
          // on all of them (gemini-3.6-flash rejects thinkingBudget: 0 with a
          // 400), so the budget is simply kept well clear of the ceiling.
          maxOutputTokens: Math.max(request.maxOutputTokens ?? 0, 4096),
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

  const candidate = body.candidates?.[0];

  // Catch truncation here rather than letting it surface downstream as an
  // unexplained JSON parse failure — the output is cut mid-object, so the
  // parser's complaint points at the wrong thing entirely.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new AppError(
      'The AI ran out of room before it finished answering. Try a photo with fewer items.',
      502,
      'AI_TRUNCATED',
    );
  }

  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new AppError('The AI returned an empty result. Try again.', 502, 'AI_EMPTY');
  }
  return text;
}

