/**
 * Curated risk zones for the pilot city (Bengaluru).
 *
 * These are *crowding and congestion* advisories, not judgements about the
 * people who live or work there. Every zone below is a well-documented
 * high-footfall transit or market area where pickpocketing, aggressive touting
 * or pedestrian traffic risk is commonly reported. `notes` always states the
 * concrete reason so the app can tell the user *why*, never just "avoid this".
 *
 * riskLevel 1–5. Levels 4–5 are reserved for places where the crowd itself is
 * the hazard; 2 means "stay aware", not "danger".
 */

export interface SeedRiskZone {
  name: string;
  riskLevel: number;
  notes: string;
  activeHours: string;
  /** Rough bounding rectangle, [south, west, north, east]. */
  bounds: [number, number, number, number];
}

const ZONES: SeedRiskZone[] = [
  {
    name: 'Kempegowda Bus Station (Majestic)',
    riskLevel: 4,
    notes:
      "The city's busiest transit hub. Dense crowds around the platforms, frequent pickpocketing reports, and touts offering unmetered taxis. Keep bags in front and use the prepaid counter.",
    activeHours: 'Busiest 06:00–10:00 and 17:00–22:00',
    bounds: [12.974, 77.5675, 12.981, 77.5755],
  },
  {
    name: 'KR Market (City Market)',
    riskLevel: 3,
    notes:
      'Wholesale flower and produce market with very narrow, packed lanes and heavy handcart traffic. Easy to get separated from your group; phone snatching is reported at the edges.',
    activeHours: 'Busiest 05:00–11:00',
    bounds: [12.96, 77.5715, 12.967, 77.579],
  },
  {
    name: 'Chickpet Commercial Lanes',
    riskLevel: 3,
    notes:
      'Dense wholesale cloth market. Lanes are barely two people wide during business hours and quoted prices for visitors are often well above the local rate — worth running a price check here.',
    activeHours: 'Busiest 11:00–19:00, closed Sunday',
    bounds: [12.9655, 77.5725, 12.9715, 77.5795],
  },
  {
    name: 'Shivajinagar Bus Stand & Market',
    riskLevel: 3,
    notes:
      'Crowded bus terminus and street market with poor pedestrian separation from moving buses. Watch traffic and keep valuables zipped.',
    activeHours: 'Busiest 08:00–21:00',
    bounds: [12.982, 77.601, 12.9885, 77.6085],
  },
  {
    name: 'MG Road & Brigade Road Junction',
    riskLevel: 2,
    notes:
      'Safe and well-policed by day. Late at night the pub crowd thins out, and inflated auto fares and aggressive street selling are common — agree the fare or use a meter before boarding.',
    activeHours: 'Elevated after 22:30',
    bounds: [12.972, 77.602, 12.978, 77.612],
  },
  {
    name: 'Central Silk Board Junction',
    riskLevel: 3,
    notes:
      'One of the most congested junctions in India, with an active flyover worksite. This is a vehicle-traffic hazard for pedestrians, not a crime concern — do not attempt to cross on foot.',
    activeHours: 'Worst 08:00–11:00 and 17:00–21:00',
    bounds: [12.914, 77.619, 12.9205, 77.627],
  },
];

/** Converts a bounding rectangle to a closed GeoJSON polygon ring ([lng, lat]). */
function boundsToPolygon(bounds: [number, number, number, number]): number[][][] {
  const [south, west, north, east] = bounds;
  return [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ];
}

export const BENGALURU_RISK_ZONES = ZONES.map((zone) => ({
  name: zone.name,
  riskLevel: zone.riskLevel,
  notes: zone.notes,
  activeHours: zone.activeHours,
  polygon: boundsToPolygon(zone.bounds),
}));
