import { RateLimitError } from './respond';

/**
 * In-memory sliding-window limiter.
 *
 * The free tiers this project runs on (Gemini, OpenRouteService) have hard
 * request quotas — one runaway loop in the client would burn the day's budget.
 * Per-instance memory is enough for a prototype; a distributed store would be
 * the upgrade path if this ever ran at scale.
 */

type Bucket = { hits: number[] };

const globalForLimiter = globalThis as unknown as { __ygRateLimiter?: Map<string, Bucket> };
const buckets = globalForLimiter.__ygRateLimiter ?? new Map<string, Bucket>();
globalForLimiter.__ygRateLimiter = buckets;

let lastSweep = Date.now();

function sweep(windowMs: number): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Stable identity — user id where available, else IP. */
  key: string;
  limit: number;
  windowMs: number;
}

export function enforceRateLimit({ key, limit, windowMs }: RateLimitOptions): void {
  sweep(windowMs);

  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  const recent = bucket.hits.filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    throw new RateLimitError(Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)));
  }

  recent.push(now);
  buckets.set(key, { hits: recent });
}

/** Quotas per Section 7 route, tuned to stay inside the free AI tier. */
export const LIMITS = {
  ai: { limit: 12, windowMs: 60_000 },
  routing: { limit: 20, windowMs: 60_000 },
  read: { limit: 60, windowMs: 60_000 },
  write: { limit: 30, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
} as const;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}
