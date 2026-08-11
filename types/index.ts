/**
 * Shared domain types. Mongoose models in lib/db/models mirror these; API
 * responses are typed against them so the client and server cannot drift.
 */

/** Section 4: the single verdict vocabulary every module speaks. */
export type TrustLevel = 'safe' | 'caution' | 'risk';

export const TRUST_THRESHOLDS = {
  safe: 70,
  caution: 40,
} as const;

export function trustLevelFor(score: number): TrustLevel {
  if (score >= TRUST_THRESHOLDS.safe) return 'safe';
  if (score >= TRUST_THRESHOLDS.caution) return 'caution';
  return 'risk';
}

export const ALLERGENS = [
  'peanuts',
  'dairy',
  'gluten',
  'shellfish',
  'eggs',
  'soy',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  peanuts: 'Peanuts / groundnut',
  dairy: 'Dairy / milk',
  gluten: 'Gluten / wheat',
  shellfish: 'Shellfish',
  eggs: 'Eggs',
  soy: 'Soy',
};

export const PRICE_CATEGORIES = [
  'street-food',
  'restaurant',
  'transport',
  'water-beverage',
  'souvenir',
  'entry-ticket',
  'essentials',
] as const;
export type PriceCategory = (typeof PRICE_CATEGORIES)[number];

export const PRICE_CATEGORY_LABELS: Record<PriceCategory, string> = {
  'street-food': 'Street food',
  restaurant: 'Restaurant',
  transport: 'Transport',
  'water-beverage': 'Water & drinks',
  souvenir: 'Souvenirs',
  'entry-ticket': 'Entry tickets',
  essentials: 'Essentials',
};

export type ScamCategory = 'safe' | 'suspicious' | 'scam';

export interface TrustedContact {
  name: string;
  phone: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city: string;
  allergyProfile: Allergen[];
  trustedContacts: TrustedContact[];
  createdAt: string;
}

/** 8.1 — one line item on a scanned bill, after reference matching. */
export interface PriceLineItem {
  itemName: string;
  matchedItem: string | null;
  category: PriceCategory | null;
  chargedPrice: number;
  referencePrice: number | null;
  deviationPct: number | null;
  score: number;
  verdict: TrustLevel;
  note: string;
  /** 0–1 fuzzy-match confidence; low values mean "we guessed, confirm this". */
  matchConfidence: number;
}

export interface PriceCheckResult {
  id: string | null;
  city: string;
  items: PriceLineItem[];
  chargedTotal: number;
  referenceTotal: number;
  overpaidBy: number;
  score: number;
  verdict: TrustLevel;
  summary: string;
  unmatchedCount: number;
}

/** 8.2 */
export interface ScamCheckResult {
  id: string | null;
  category: ScamCategory;
  confidence: number;
  score: number;
  verdict: TrustLevel;
  explanation: string;
  signals: string[];
  recommendedAction: string;
}

export interface ScamAlert {
  id: string;
  city: string;
  pattern: string;
  category: ScamCategory;
  reportCount: number;
  lastSeen: string;
  example: string;
}

/** 8.3 */
export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface RouteOption {
  kind: 'fastest' | 'safest';
  distanceM: number;
  durationS: number;
  /** [lat, lng] pairs, ready for Leaflet. */
  geometry: [number, number][];
  riskScore: number;
  score: number;
  verdict: TrustLevel;
  zonesCrossed: { name: string; riskLevel: number; notes: string }[];
  steps: RouteStep[];
  summary: string;
}

export interface RoutePlanResult {
  city: string;
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  fastest: RouteOption | null;
  safest: RouteOption;
}

export interface RiskZone {
  id: string;
  city: string;
  name: string;
  riskLevel: number;
  source: 'curated' | 'user-report';
  notes: string;
  /** GeoJSON Polygon coordinates: [[[lng, lat], ...]] */
  polygon: number[][][];
}

/** 8.4 */
export interface FlaggedDish {
  dishName: string;
  matchedDish: string | null;
  allergens: Allergen[];
  /** Only the allergens that intersect this user's profile. */
  conflicts: Allergen[];
  verdict: TrustLevel;
  score: number;
  matchConfidence: number;
  note: string;
}

export interface FoodCheckResult {
  city: string;
  items: FlaggedDish[];
  score: number;
  verdict: TrustLevel;
  summary: string;
  checkedAgainst: Allergen[];
  unknownCount: number;
}

/** 8.5 */
export interface SosEvent {
  id: string;
  location: { lat: number; lng: number } | null;
  accuracyM: number | null;
  triggeredAt: string;
  contactsNotified: string[];
  mapsUrl: string;
  message: string;
}

/** 8.6 */
export interface DestinationSuggestion {
  id: string;
  name: string;
  region: string;
  theme: 'hills' | 'beach' | 'heritage' | 'wildlife';
  peakMonths: number[];
  distanceKm: number | null;
  why: string;
}

/** Every API route answers in this envelope. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
