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

function buildReason(destination: DestinationRecord, month: number): string {
  const peak = destination.peakMonths.map(monthName);
  const base = destination.blurb?.trim();

  const timing =
    peak.length === 0
      ? `Steady year-round, so ${monthName(month)} is as good as any.`
      : `Peaks in ${peak.slice(0, 2).join(' and ')}${peak.length > 2 ? ' and after' : ''}, so ${monthName(month)} is quieter and cheaper.`;

  return base ? `${base} ${timing}` : timing;
}
