import { normalizeName } from '@/lib/utils';

/**
 * Shared fuzzy matching for 8.1 (bill items) and 8.4 (dish names).
 *
 * OCR output and menu spellings vary wildly — "masala dosa", "Masaala Dose",
 * "MSL DOSA" all have to land on the same reference row — so an exact lookup
 * is useless here. Levenshtein plus token overlap handles both misspellings
 * and word-order differences without needing a search service.
 */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Only two rows are ever needed, which keeps this O(min(a,b)) in memory.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length] ?? 0;
}

/** 0–1 similarity combining edit distance, token overlap and substring hits. */
export function similarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const editScore = 1 - distance / Math.max(left.length, right.length);

  const leftTokens = new Set(left.split(' ').filter((t) => t.length > 2));
  const rightTokens = new Set(right.split(' ').filter((t) => t.length > 2));
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union > 0 ? shared / union : 0;

  // "dosa" inside "masala dosa" is a strong signal edit distance alone misses.
  const containment =
    left.includes(right) || right.includes(left)
      ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
      : 0;

  return Math.max(editScore * 0.55 + tokenScore * 0.45, containment * 0.9);
}

export interface Matchable {
  normalizedName: string;
  aliases?: string[];
}

export interface MatchResult<T> {
  candidate: T;
  confidence: number;
}

/** Minimum confidence before a match is reported rather than left unknown. */
export const MATCH_THRESHOLD = 0.62;

export function bestMatch<T extends Matchable>(
  query: string,
  candidates: T[],
  threshold = MATCH_THRESHOLD,
): MatchResult<T> | null {
  let best: MatchResult<T> | null = null;

  for (const candidate of candidates) {
    const names = [candidate.normalizedName, ...(candidate.aliases ?? [])];
    let confidence = 0;
    for (const name of names) {
      confidence = Math.max(confidence, similarity(query, name));
      if (confidence === 1) break;
    }
    if (confidence > (best?.confidence ?? 0)) best = { candidate, confidence };
  }

  return best && best.confidence >= threshold ? best : null;
}
