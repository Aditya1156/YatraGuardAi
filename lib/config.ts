/**
 * Single place that reads environment variables.
 *
 * Nothing else in the app touches `process.env` directly, so a missing key
 * produces one clear, actionable error instead of a cryptic runtime crash —
 * and every integration can be feature-detected before it is called.
 */

/** Section 5 decision: pilot city is Bengaluru (see PROGRESS.md). */
export const PILOT_CITY = 'Bengaluru';

export const PILOT_CITY_CENTER = { lat: 12.9716, lng: 77.5946 } as const;

/** Bounding box used to keep geocoding results inside the pilot city. */
export const PILOT_CITY_BBOX = {
  minLng: 77.45,
  minLat: 12.83,
  maxLng: 77.78,
  maxLat: 13.14,
} as const;

export const APP_NAME = 'YatraGuard AI';

function read(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const serverEnv = {
  mongodbUri: read('MONGODB_URI'),
  mongodbDb: read('MONGODB_DB') ?? 'yatraguard',

  geminiApiKey: read('GEMINI_API_KEY'),
  /**
   * Pinned deliberately, and to a *lite* model on purpose.
   *
   * Google retires model ids on a schedule — the `gemini-2.0-flash` this
   * project was specified against is already gone, and `gemini-2.5-flash` is
   * closed to new API projects — so the id lives in one place and a 404 gives a
   * clear message instead of a mystery.
   *
   * Lite because free-tier quota is per-model and the full flash models are
   * capped at 20 requests/day, which one demo run of five AI calls exhausts in
   * four passes. On this workload — reading a printed bill or menu, classifying
   * a message — flash-lite returned byte-identical extractions to
   * gemini-3.6-flash, so the larger model buys nothing but a smaller quota.
   */
  geminiModel: read('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite',

  openRouteServiceKey: read('OPENROUTESERVICE_API_KEY'),

  firebaseProjectId: read('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: read('FIREBASE_CLIENT_EMAIL'),
  // Vercel env vars cannot hold real newlines, so the key is stored escaped.
  firebasePrivateKey: read('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),

  /**
   * Demo sign-in for judging/offline demos, off unless explicitly enabled.
   * It creates a real user row; it just skips the Firebase identity check.
   */
  allowGuestLogin: read('ALLOW_GUEST_LOGIN') === 'true',

  isProduction: process.env.NODE_ENV === 'production',
} as const;

export const publicEnv = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  allowGuestLogin: process.env.NEXT_PUBLIC_ALLOW_GUEST_LOGIN === 'true',
  pilotCity: PILOT_CITY,
} as const;

export const integrations = {
  get database() {
    return Boolean(serverEnv.mongodbUri);
  },
  get gemini() {
    return Boolean(serverEnv.geminiApiKey);
  },
  get routing() {
    return Boolean(serverEnv.openRouteServiceKey);
  },
  get firebaseAdmin() {
    return Boolean(
      serverEnv.firebaseProjectId && serverEnv.firebaseClientEmail && serverEnv.firebasePrivateKey,
    );
  },
  get firebaseClient() {
    return Boolean(publicEnv.firebase.apiKey && publicEnv.firebase.projectId);
  },
} as const;

/** Thrown when a route needs an integration the deployment has not configured. */
export class ConfigError extends Error {
  readonly code = 'NOT_CONFIGURED';

  constructor(
    readonly integration: string,
    readonly envKeys: string[],
  ) {
    super(
      `${integration} is not configured. Set ${envKeys.join(', ')} in .env.local (see .env.example).`,
    );
    this.name = 'ConfigError';
  }
}

export function requireGemini(): string {
  if (!serverEnv.geminiApiKey) throw new ConfigError('Gemini AI', ['GEMINI_API_KEY']);
  return serverEnv.geminiApiKey;
}

export function requireOpenRouteService(): string {
  if (!serverEnv.openRouteServiceKey) {
    throw new ConfigError('OpenRouteService routing', ['OPENROUTESERVICE_API_KEY']);
  }
  return serverEnv.openRouteServiceKey;
}
