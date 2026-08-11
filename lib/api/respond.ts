import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConfigError } from '@/lib/config';
import { UnauthorizedError } from '@/lib/auth/session';
import type { ApiResponse } from '@/types';

/**
 * One response envelope and one error funnel for every route in Section 7.
 * Clients can rely on `{ ok }` being present on every single response.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  error: string,
  status = 400,
  code?: string,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });
}

/** Raised by handlers for expected, user-facing failures. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterS: number) {
    super(`Too many requests. Try again in ${retryAfterS}s.`, 429, 'RATE_LIMITED');
  }
}

/**
 * Wraps a route handler so no unexpected throw ever leaks a stack trace to the
 * client, while still logging the real cause on the server.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return fail(error.message, 401, error.code);
      }
      if (error instanceof ConfigError) {
        console.error('[config]', error.message);
        return fail(error.message, 503, error.code);
      }
      if (error instanceof ZodError) {
        const first = error.errors[0];
        return fail(first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request', 422);
      }
      if (error instanceof AppError) {
        return fail(error.message, error.status, error.code);
      }

      console.error('[unhandled]', error);
      return fail('Something broke on our side. Try again in a moment.', 500, 'INTERNAL');
    }
  };
}
