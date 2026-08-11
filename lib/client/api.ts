'use client';

import type { ApiResponse } from '@/types';

/**
 * Client-side fetch wrapper.
 *
 * Every API route answers `{ ok }`, so failures surface as a thrown ApiError
 * with the server's own wording — the UI never has to invent an error message.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the deployment is missing an API key rather than being broken. */
  get isSetupIssue(): boolean {
    return this.code === 'NOT_CONFIGURED';
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('The server sent a response we could not read.', response.status);
  }

  if (!payload.ok) {
    throw new ApiError(payload.error, response.status, payload.code);
  }
  return payload.data;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: 'GET', signal, credentials: 'same-origin' });
  return unwrap<T>(response);
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const isFormData = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: isFormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(response);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}
