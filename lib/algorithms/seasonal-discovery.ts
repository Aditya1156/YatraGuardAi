import type { DestinationSuggestion } from '@/types';

/**
 * 8.6 Seasonal Discovery (Week 4 stretch).
 *
 * Rule-based by design — the master prompt is explicit that a filter query is
 * enough here and that no ML belongs in this prototype.
 */

export interface DestinationRecord {
  id: string;
  name: string;
  region: string;
  theme: 'hills' | 'beach' | 'heritage' | 'wildlife';
  peakMonths: number[];
  distanceKm?: number | null;
  blurb?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? 'this month';
}

/**
 * Picks same-theme destinations that are *not* at peak this month — the point
 * is a comparable trip without the crowd and the crowd's prices.
 */
export function suggestOffPeak(
  destinations: DestinationRecord[],
  month: number,
  options: { theme?: DestinationRecord['theme']; region?: string; limit?: number } = {},
): DestinationSuggestion[] {
  const { theme, region, limit = 3 } = options;

  return destinations
    .filter((destination) => {
      if (theme && destination.theme !== theme) return false;
      if (region && destination.region.toLowerCase() !== region.toLowerCase()) return false;
      return !destination.peakMonths.includes(month);
    })
    .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit)
    .map((destination) => ({
      id: destination.id,
      name: destination.name,
      region: destination.region,
      theme: destination.theme,
      peakMonths: destination.peakMonths,
      distanceKm: destination.distanceKm ?? null,
      why: buildReason(destination, month),
    }));
}

/**
 * Renders a set of peak months readably.
 *
 * Peak seasons are usually a contiguous run that wraps the year end
 * (October–January), so those collapse to a range. Anything genuinely split —
 * Mysuru peaks for Dasara and again in winter — stays an explicit list rather
 * than being flattened into a range that would misstate it.
 */
export function formatMonths(months: number[]): string {
  const unique = Array.from(new Set(months)).sort((a, b) => a - b);
  if (unique.length === 0) return '';
  if (unique.length === 1) return monthName(unique[0]!);
  if (unique.length === 12) return 'all year';

  // Rotate so the list starts at the beginning of a run. Without this a
  // December–January season would be split across the ends of the array.
  let start = 0;
  for (let i = 0; i < unique.length; i += 1) {
    const previous = unique[(i - 1 + unique.length) % unique.length]!;
    if ((unique[i]! - previous + 12) % 12 !== 1) start = i;
  }
  const rotated = [...unique.slice(start), ...unique.slice(0, start)];

  // Split into contiguous runs, so a genuinely two-season place reads as two
  // ranges rather than one long comma list.
  const runs: number[][] = [];
  for (const month of rotated) {
    const current = runs.at(-1);
    if (current && (month - current.at(-1)! + 12) % 12 === 1) current.push(month);
    else runs.push([month]);
  }

  const parts = runs.map((run) =>
    run.length === 1 ? monthName(run[0]!) : `${monthName(run[0]!)} to ${monthName(run.at(-1)!)}`,
  );

  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function buildReason(destination: DestinationRecord, month: number): string {
  const base = destination.blurb?.trim();

  const timing =
    destination.peakMonths.length === 0
      ? `Steady year-round, so ${monthName(month)} is as good as any.`
      : `Peaks ${formatMonths(destination.peakMonths)}, so ${monthName(month)} is quieter and cheaper.`;

  return base ? `${base} ${timing}` : timing;
}
