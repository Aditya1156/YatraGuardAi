import 'server-only';

import { z } from 'zod';
import { AppError } from '@/lib/api/respond';
import { PILOT_CITY_BBOX, requireOpenRouteService } from '@/lib/config';
import type { RawRoute } from '@/lib/algorithms/safe-route';
import type { RouteStep } from '@/types';

/**
 * OpenRouteService client — directions and geocoding on the free key tier.
 * Chosen over Google Maps because the free key needs no card (Section 3).
 */

const BASE = 'https://api.openrouteservice.org';

export type TravelProfile = 'foot-walking' | 'driving-car' | 'cycling-regular';

async function orsFetch(path: string, init: RequestInit): Promise<unknown> {
  const key = requireOpenRouteService();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/geo+json',
        'Content-Type': 'application/json',
        Authorization: key,
        ...init.headers,
      },
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Route lookup timed out. Try again.'
        : 'Could not reach the routing service.',
      504,
      'ROUTING_UNREACHABLE',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[ors]', response.status, body.slice(0, 300));

    if (response.status === 429) {
      throw new AppError('Routing quota for today is used up. Try again later.', 429, 'ROUTING_QUOTA');
    }
    if (response.status === 403 || response.status === 401) {
      throw new AppError(
        'The routing service rejected the key — check OPENROUTESERVICE_API_KEY.',
        502,
        'ROUTING_AUTH',
      );
    }
    if (response.status === 404) {
      throw new AppError(
        'No route exists between those two points. Try landmarks closer to a road.',
        422,
        'NO_ROUTE',
      );
    }
    throw new AppError('The routing service is unavailable right now.', 502, 'ROUTING_ERROR');
  }

  return response.json();
}

/* ------------------------------ Directions ------------------------------- */

const directionsSchema = z.object({
  routes: z
    .array(
      z.object({
        summary: z.object({ distance: z.number().optional(), duration: z.number().optional() }).default({}),
        /** Encoded polyline5, ORS's default when `geometry_simplify` is off. */
        geometry: z.string(),
        segments: z
          .array(
            z.object({
              steps: z
                .array(
                  z.object({
                    instruction: z.string().default(''),
                    distance: z.number().default(0),
                    duration: z.number().default(0),
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

/** Decodes an ORS/Google polyline5 into [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export async function fetchRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: TravelProfile,
): Promise<RawRoute[]> {
  const body: Record<string, unknown> = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    instructions: true,
    units: 'm',
  };

  // Alternatives are what make a fastest-vs-safest comparison possible at all.
  // ORS rejects them on very short trips, so this is a best-effort request.
  body.alternative_routes = { target_count: 3, share_factor: 0.6, weight_factor: 1.6 };

  let payload: unknown;
  try {
    payload = await orsFetch(`/v2/directions/${profile}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NO_ROUTE') throw error;
    delete body.alternative_routes;
    payload = await orsFetch(`/v2/directions/${profile}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  const parsed = directionsSchema.safeParse(payload);
  if (!parsed.success || parsed.data.routes.length === 0) {
    throw new AppError('No route came back for those points. Try nearby landmarks.', 422, 'NO_ROUTE');
  }

  return parsed.data.routes.map((route) => {
    const steps: RouteStep[] = route.segments
      .flatMap((segment) => segment.steps)
      .filter((step) => step.instruction.trim().length > 0)
      .map((step) => ({
        instruction: step.instruction,
        distanceM: Math.round(step.distance),
        durationS: Math.round(step.duration),
      }));

    return {
      distanceM: route.summary.distance ?? 0,
      durationS: route.summary.duration ?? 0,
      geometry: decodePolyline(route.geometry),
      steps,
    };
  });
}

/* ------------------------------- Geocoding ------------------------------- */

const geocodeSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.array(z.number()).min(2) }),
        properties: z.object({
          label: z.string().optional(),
          name: z.string().optional(),
          locality: z.string().optional(),
        }),
      }),
    )
    .default([]),
});

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

/** Landmark/address search, constrained to the pilot city's bounding box. */
export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    text: query,
    size: String(limit),
    'boundary.rect.min_lon': String(PILOT_CITY_BBOX.minLng),
    'boundary.rect.min_lat': String(PILOT_CITY_BBOX.minLat),
    'boundary.rect.max_lon': String(PILOT_CITY_BBOX.maxLng),
    'boundary.rect.max_lat': String(PILOT_CITY_BBOX.maxLat),
  });

  const payload = await orsFetch(`/geocode/search?${params}`, { method: 'GET' });
  const parsed = geocodeSchema.safeParse(payload);
  if (!parsed.success) return [];

  return parsed.data.features
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return {
        label: feature.properties.label ?? feature.properties.name ?? query,
        lat,
        lng,
      };
    })
    .filter((result): result is GeocodeResult => result !== null);
}
