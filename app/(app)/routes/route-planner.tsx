'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Crosshair, MapPin, TriangleAlert } from 'lucide-react';
import { TrustRing, TrustPill } from '@/components/trust-ring';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { ErrorState, InfoNote, Skeleton } from '@/components/ui/feedback';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import type { RiskZone, RouteOption, RoutePlanResult } from '@/types';

/** Leaflet touches `window` at import time, so the map can only load client-side. */
const RouteMap = dynamic(() => import('@/components/map/route-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-card" />,
});

interface Place {
  label: string;
  lat: number;
  lng: number;
}

type Profile = 'foot-walking' | 'driving-car' | 'cycling-regular';

export function RoutePlanner() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [profile, setProfile] = useState<Profile>('foot-walking');
  const [shown, setShown] = useState<'safest' | 'fastest'>('safest');

  const zones = useQuery({
    queryKey: ['riskzones'],
    queryFn: () => apiGet<{ zones: RiskZone[] }>('/api/riskzones'),
    staleTime: 30 * 60_000,
  });

  const plan = useMutation({
    mutationFn: (input: { origin: Place; destination: Place; profile: Profile }) =>
      apiSend<RoutePlanResult>('/api/route/plan', 'POST', input),
    onSuccess: () => setShown('safest'),
  });

  const result = plan.data;
  const active: RouteOption | null =
    result === undefined ? null : shown === 'fastest' ? (result.fastest ?? result.safest) : result.safest;

  return (
    <div className="flex flex-col gap-4">
      <PlaceField
        id="origin"
        label="From"
        value={origin}
        onChange={setOrigin}
        allowCurrentLocation
      />
      <PlaceField id="destination" label="To" value={destination} onChange={setDestination} />

      <div>
        <Label htmlFor="profile">Travelling by</Label>
        <Select
          id="profile"
          value={profile}
          onChange={(event) => setProfile(event.target.value as Profile)}
        >
          <option value="foot-walking">On foot</option>
          <option value="driving-car">Car or auto</option>
          <option value="cycling-regular">Cycle</option>
        </Select>
      </div>

      <Button
        size="lg"
        block
        disabled={!origin || !destination}
        loading={plan.isPending}
        onClick={() => {
          if (origin && destination) plan.mutate({ origin, destination, profile });
        }}
      >
        Plan the route
      </Button>

      {plan.isError && (
        <ErrorState
          description={errorMessage(plan.error)}
          onRetry={
            origin && destination ? () => plan.mutate({ origin, destination, profile }) : undefined
          }
        />
      )}

      <RouteMap
        zones={zones.data?.zones ?? []}
        route={active}
        origin={origin}
        destination={destination}
      />

      {result && active && (
        <RouteResult
          result={result}
          active={active}
          shown={shown}
          onToggle={setShown}
        />
      )}

      {!result && (
        <InfoNote>
          Flagged areas on the map are crowding and congestion advisories with the reason attached —
          tap one to read why it is marked.
        </InfoNote>
      )}
    </div>
  );
}

function RouteResult({
  result,
  active,
  shown,
  onToggle,
}: {
  result: RoutePlanResult;
  active: RouteOption;
  shown: 'safest' | 'fastest';
  onToggle: (value: 'safest' | 'fastest') => void;
}) {
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      {result.fastest && (
        <div role="tablist" aria-label="Route options" className="flex gap-2 rounded-pill bg-surface p-1">
          {(['safest', 'fastest'] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={shown === option}
              onClick={() => onToggle(option)}
              className={`flex-1 rounded-pill px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                shown === option ? 'bg-trust-indigo text-white' : 'text-muted-foreground'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
        <TrustRing score={active.score} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold capitalize">{active.kind} route</p>
          <p className="mt-1 text-sm text-muted-foreground">{active.summary}</p>
          <p className="numeric mt-2 text-xs text-muted-foreground">
            {(active.distanceM / 1000).toFixed(1)} km · {Math.max(1, Math.round(active.durationS / 60))} min
          </p>
        </div>
      </div>

      {active.zonesCrossed.length > 0 && (
        <div className="rounded-card bg-marigold/10 p-4">
          <h3 className="flex items-center gap-2 text-sm">
            <TriangleAlert className="size-4 text-marigold" aria-hidden />
            Flagged areas on this route
          </h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {active.zonesCrossed.map((zone) => (
              <li key={zone.name}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{zone.name}</span>
                  <TrustPill
                    level={zone.riskLevel >= 4 ? 'risk' : 'caution'}
                    label={`Level ${zone.riskLevel}`}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{zone.notes}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.steps.length > 0 && (
        <details className="rounded-card bg-surface p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-semibold">
            Turn-by-turn ({active.steps.length} steps)
          </summary>
          <ol className="mt-3 flex flex-col gap-2">
            {active.steps.map((step, index) => (
              <li key={`${step.instruction}-${index}`} className="flex gap-2 text-sm">
                <span className="numeric w-6 shrink-0 text-muted-foreground">{index + 1}</span>
                <span className="min-w-0">
                  {step.instruction}
                  <span className="numeric block text-xs text-muted-foreground">
                    {step.distanceM} m
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

/** Landmark search backed by /api/geocode, plus a device-location shortcut. */
function PlaceField({
  id,
  label,
  value,
  onChange,
  allowCurrentLocation = false,
}: {
  id: string;
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  allowCurrentLocation?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const search = useQuery({
    queryKey: ['geocode', query],
    queryFn: () => apiGet<{ results: Place[] }>(`/api/geocode?q=${encodeURIComponent(query)}`),
    enabled: open && query.trim().length >= 3,
    staleTime: 10 * 60_000,
  });

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      setLocationError('This device cannot share its location.');
      return;
    }
    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          label: 'My current location',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setQuery('My current location');
        setOpen(false);
        setLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Type a landmark instead.'
            : 'Could not get your location. Type a landmark instead.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={query}
          autoComplete="off"
          placeholder="Landmark, area or address"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
        />
        {allowCurrentLocation && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Use my current location"
            loading={locating}
            onClick={useCurrentLocation}
          >
            <Crosshair aria-hidden />
          </Button>
        )}
      </div>

      {locationError && <p className="mt-1.5 text-xs text-signal-red">{locationError}</p>}

      {open && query.trim().length >= 3 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-canvas">
          {search.isPending && <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</p>}
          {search.isError && (
            <p className="px-3 py-2.5 text-sm text-signal-red">{errorMessage(search.error)}</p>
          )}
          {search.data?.results.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              Nothing found in the city for that.
            </p>
          )}
          {search.data?.results.map((place) => (
            <button
              key={`${place.lat},${place.lng}`}
              type="button"
              className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-surface"
              onClick={() => {
                onChange(place);
                setQuery(place.label);
                setOpen(false);
              }}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {place.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
