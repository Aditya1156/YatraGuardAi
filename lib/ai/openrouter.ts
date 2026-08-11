import 'server-only';

import { serverEnv } from '@/lib/config';
import { AppError } from '@/lib/api/respond';
import type { AiRequest } from './contract';

/**
 * OpenRouter client, used only as a fallback when Gemini cannot serve a request.
 *
 * Why this exists: Gemini's free tier allows 20 requests/day on the full flash
 * models, which a few demo runs exhaust — that failure interrupted a working
 * session once already. This is a second chance, not a guarantee: OpenRouter's
 * free models carry their own rate limits and will sometimes 429 too.
 *
 * Not an SDK, for the same reasons as the Gemini client: the chat-completions
 * shape is stable and staying on fetch keeps the serverless bundle small.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface ChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string; code?: number };
}

export async function callOpenRouter(request: AiRequest): Promise<string> {
  const apiKey = serverEnv.openRouterApiKey;
  if (!apiKey) {
    throw new AppError('The AI fallback is not configured.', 502, 'AI_ERROR');
  }

  // OpenRouter takes images as data URIs inline in the message content, unlike
  // Gemini's separate inlineData part.
  const content: Record<string, unknown>[] = [{ type: 'text', text: request.prompt }];
  if (request.image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${request.image.mimeType};base64,${request.image.data}` },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter attributes usage to these; they are optional but make the
        // dashboard readable when several projects share a key.
        'X-Title': 'YatraGuard AI',
      },
      body: JSON.stringify({
        model: serverEnv.openRouterModel,
        temperature: request.temperature ?? 0.1,
        max_tokens: Math.max(request.maxOutputTokens ?? 0, 2048),
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content },
        ],
      }),
    });
  } catch (error) {
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

  const body = (await response.json().catch(() => null)) as ChatResponse | null;

  if (!response.ok || body?.error) {
    const detail = body?.error?.message ?? response.statusText;
    console.error('[openrouter]', response.status, detail);
    if (response.status === 429) {
      throw new AppError('The AI quota for today is used up. Try again later.', 429, 'AI_QUOTA');
    }
    throw new AppError('The AI service is unavailable right now.', 502, 'AI_ERROR');
  }

  const choice = body?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new AppError(
      'The AI ran out of room before it finished answering. Try a photo with fewer items.',
      502,
      'AI_TRUNCATED',
    );
  }

  const text = choice?.message?.content ?? '';
  if (!text.trim()) {
    throw new AppError('The AI returned an empty result. Try again.', 502, 'AI_EMPTY');
  }
  return text;
}
