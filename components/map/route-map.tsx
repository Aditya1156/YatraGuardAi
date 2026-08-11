'use client';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { PILOT_CITY_CENTER } from '@/lib/config';
import type { RiskZone, RouteOption } from '@/types';
import 'leaflet/dist/leaflet.css';

/**
 * Leaflet map for 8.3. OpenStreetMap tiles need no key and no card, which is
 * why they were chosen over Google Maps (Section 3).
 *
 * Uses CircleMarker rather than the default pin: Leaflet's marker icons are
 * loaded as relative image assets and break under bundlers, and circles carry
 * the ring colours consistently anyway.
 */

const RISK_COLOURS: Record<number, string> = {
  1: '#F2A93B',
  2: '#F2A93B',
  3: '#E08432',
  4: '#D64545',
  5: '#D64545',
};

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }, [bounds, map]);

  return null;
}

export interface RouteMapProps {
  zones: RiskZone[];
  route: RouteOption | null;
  origin: { lat: number; lng: number; label: string } | null;
  destination: { lat: number; lng: number; label: string } | null;
}

export default function RouteMap({ zones, route, origin, destination }: RouteMapProps) {
  const points: LatLngExpression[] = route?.geometry ?? [];

  const bounds: LatLngBoundsExpression | null =
    points.length > 1
      ? (points as LatLngBoundsExpression)
      : origin && destination
        ? ([
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ] as LatLngBoundsExpression)
        : null;

  return (
    <MapContainer
      center={[PILOT_CITY_CENTER.lat, PILOT_CITY_CENTER.lng]}
      zoom={12}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-card"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {zones.map((zone) => (
        <Polygon
          key={zone.id}
          // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
          positions={(zone.polygon[0] ?? []).map(([lng, lat]) => [lat ?? 0, lng ?? 0] as LatLngExpression)}
          pathOptions={{
            color: RISK_COLOURS[zone.riskLevel] ?? '#F2A93B',
            weight: 1,
            fillOpacity: 0.14,
          }}
        >
          <Popup>
            <strong>{zone.name}</strong>
            <br />
            {zone.notes}
          </Popup>
        </Polygon>
      ))}

      {points.length > 1 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: route?.verdict === 'risk' ? '#D64545' : route?.verdict === 'caution' ? '#F2A93B' : '#2E8B74',
            weight: 5,
            opacity: 0.9,
          }}
        />
      )}

      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={8}
          pathOptions={{ color: '#1B2A4A', fillColor: '#1B2A4A', fillOpacity: 1 }}
        >
          <Popup>{origin.label || 'Start'}</Popup>
        </CircleMarker>
      )}

      {destination && (
        <CircleMarker
          center={[destination.lat, destination.lng]}
          radius={8}
          pathOptions={{ color: '#2E8B74', fillColor: '#2E8B74', fillOpacity: 1 }}
        >
          <Popup>{destination.label || 'Destination'}</Popup>
        </CircleMarker>
      )}

      <FitBounds bounds={bounds} />
    </MapContainer>
  );
}
