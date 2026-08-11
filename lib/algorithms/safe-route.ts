import { clamp } from '@/lib/utils';
import { trustLevelFor, type RouteOption, type RouteStep } from '@/types';

/**
 * 8.3 Safe Route Planner.
 *
 * OpenRouteService returns candidate routes; this module scores them against
 * curated RiskZone polygons and picks a fastest and a safest option.
 *
 * `edgeCost = w1 * normalizedTime + w2 * riskScore` from the master prompt is
 * applied at route granularity rather than per-edge: ORS does not expose the
 * underlying graph on the free tier, so we ask it for alternatives and rank
 * those. Same cost function, coarser resolution.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ScoredZone {
  name: string;
  riskLevel: number;
  notes: string;
  polygon: number[][][];
}

/* --------------------------- Geometry helpers ---------------------------- */

/** Ray casting on a GeoJSON ring. Coordinates are [lng, lat]. */
export function pointInRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;

    const [aLng, aLat] = [a[0] ?? 0, a[1] ?? 0];
    const [bLng, bLat] = [b[0] ?? 0, b[1] ?? 0];

    const straddles = aLat > point.lat !== bLat > point.lat;
    if (!straddles) continue;

    const intersectLng = ((bLng - aLng) * (point.lat - aLat)) / (bLat - aLat) + aLng;
    if (point.lng < intersectLng) inside = !inside;
  }
  return inside;
}

/** Outer ring only — the curated zones have no holes. */
export function pointInPolygon(point: LatLng, polygon: number[][][]): boolean {
  const outer = polygon[0];
  return outer ? pointInRing(point, outer) : false;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ---------------------------- Risk scoring ------------------------------- */

export interface RiskAssessment {
  /** 0–1, where 1 is the worst possible exposure. */
  riskScore: number;
  zonesCrossed: { name: string; riskLevel: number; notes: string }[];
  /** Share of the route's length spent inside any risk zone. */
  exposureRatio: number;
}

/**
 * Measures how much of a route sits inside risk zones, weighted by each zone's
 * severity. Length-weighted rather than point-counting so a route that merely
 * clips a corner is not penalised like one that runs through the middle.
 */
export function assessRouteRisk(
  geometry: [number, number][],
  zones: ScoredZone[],
): RiskAssessment {
  if (geometry.length < 2 || zones.length === 0) {
    return { riskScore: 0, zonesCrossed: [], exposureRatio: 0 };
  }

  const crossed = new Map<string, { name: string; riskLevel: number; notes: string }>();
  let totalLength = 0;
  let weightedRisk = 0;
  let exposedLength = 0;

  for (let i = 1; i < geometry.length; i += 1) {
    const prev = geometry[i - 1];
    const current = geometry[i];
    if (!prev || !current) continue;

    const from: LatLng = { lat: prev[0], lng: prev[1] };
    const to: LatLng = { lat: current[0], lng: current[1] };
    const segmentLength = haversineMeters(from, to);
    if (segmentLength === 0) continue;
    totalLength += segmentLength;

    const midpoint: LatLng = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };

    let worstLevel = 0;
    for (const zone of zones) {
      if (!pointInPolygon(midpoint, zone.polygon)) continue;
      crossed.set(zone.name, { name: zone.name, riskLevel: zone.riskLevel, notes: zone.notes });
      worstLevel = Math.max(worstLevel, zone.riskLevel);
    }

    if (worstLevel > 0) {
      exposedLength += segmentLength;
      weightedRisk += segmentLength * (worstLevel / 5);
    }
  }

  const riskScore = totalLength > 0 ? clamp(weightedRisk / totalLength, 0, 1) : 0;
  const exposureRatio = totalLength > 0 ? exposedLength / totalLength : 0;

  return {
    riskScore,
    zonesCrossed: [...crossed.values()].sort((a, b) => b.riskLevel - a.riskLevel),
    exposureRatio,
  };
}

/* ------------------------------ Cost model ------------------------------- */

/**
 * `safest` weights risk heavily enough to actually dominate.
 *
 * An earlier 0.35/0.65 split looked reasonable but failed in practice: because
 * time is normalised across the candidates, the slowest option always pays the
 * full time penalty, so a detour that genuinely halved risk still lost. If the
 * "safest" option can come back as the risky one, the toggle is a lie — risk
 * has to outweigh time by enough that a real detour wins.
 */
export const WEIGHTS = {
  fastest: { time: 1, risk: 0 },
  safest: { time: 0.15, risk: 0.85 },
} as const;

/** `edgeCost = w1 * normalizedTime + w2 * riskScore` (master prompt 8.3 step 2). */
export function routeCost(
  normalizedTime: number,
  riskScore: number,
  weights: { time: number; risk: number },
): number {
  return weights.time * normalizedTime + weights.risk * riskScore;
}

/** Trust Ring score for a route: pure risk exposure, independent of duration. */
export function routeTrustScore(riskScore: number): number {
  return clamp(Math.round(100 - riskScore * 100), 0, 100);
}

export interface RawRoute {
  distanceM: number;
  durationS: number;
  geometry: [number, number][];
  steps: RouteStep[];
}

function summarize(kind: 'fastest' | 'safest', assessment: RiskAssessment, durationS: number): string {
  const minutes = Math.max(1, Math.round(durationS / 60));

  if (assessment.zonesCrossed.length === 0) {
    return kind === 'fastest'
      ? `${minutes} min, and it avoids every flagged area.`
      : `${minutes} min with no flagged areas on the way.`;
  }

  const worst = assessment.zonesCrossed[0]!;
  const percent = Math.round(assessment.exposureRatio * 100);
  return `${minutes} min, with about ${percent}% of the way through flagged areas — ${worst.name} is the main one.`;
}

export function toRouteOption(
  kind: 'fastest' | 'safest',
  raw: RawRoute,
  zones: ScoredZone[],
): RouteOption {
  const assessment = assessRouteRisk(raw.geometry, zones);
  const score = routeTrustScore(assessment.riskScore);

  return {
    kind,
    distanceM: Math.round(raw.distanceM),
    durationS: Math.round(raw.durationS),
    geometry: raw.geometry,
    riskScore: Math.round(assessment.riskScore * 1000) / 1000,
    score,
    verdict: trustLevelFor(score),
    zonesCrossed: assessment.zonesCrossed,
    steps: raw.steps,
    summary: summarize(kind, assessment, raw.durationS),
  };
}

/**
 * Ranks the alternatives ORS returned and returns the fastest and the safest.
 * Time is normalised against the quickest candidate so the two terms of the
 * cost function are on the same 0–1 scale.
 */
export function selectRoutes(
  raws: RawRoute[],
  zones: ScoredZone[],
): { fastest: RouteOption; safest: RouteOption } {
  if (raws.length === 0) throw new Error('selectRoutes needs at least one route');

  const quickest = Math.min(...raws.map((r) => r.durationS)) || 1;
  const slowest = Math.max(...raws.map((r) => r.durationS));
  const span = Math.max(slowest - quickest, 1);

  const scored = raws.map((raw) => {
    const assessment = assessRouteRisk(raw.geometry, zones);
    const normalizedTime = (raw.durationS - quickest) / span;
    return {
      raw,
      riskScore: assessment.riskScore,
      fastestCost: routeCost(normalizedTime, assessment.riskScore, WEIGHTS.fastest),
      safestCost: routeCost(normalizedTime, assessment.riskScore, WEIGHTS.safest),
    };
  });

  const fastestPick = scored.reduce((best, item) =>
    item.fastestCost < best.fastestCost ? item : best,
  );
  const safestPick = scored.reduce((best, item) => (item.safestCost < best.safestCost ? item : best));

  return {
    fastest: toRouteOption('fastest', fastestPick.raw, zones),
    safest: toRouteOption('safest', safestPick.raw, zones),
  };
}
