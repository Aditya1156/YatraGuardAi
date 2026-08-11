import 'server-only';

import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { ConfigError, integrations, serverEnv } from '@/lib/config';

/**
 * Firebase Admin, used only to verify tokens and mint session cookies.
 * Credentials come from a service account on the free Spark plan.
 */

const ADMIN_APP_NAME = 'yatraguard-admin';

function getAdminApp(): App {
  if (!integrations.firebaseAdmin) {
    throw new ConfigError('Firebase Admin', [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ]);
  }

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert({
        projectId: serverEnv.firebaseProjectId!,
        clientEmail: serverEnv.firebaseClientEmail!,
        privateKey: serverEnv.firebasePrivateKey!,
      }),
    },
    ADMIN_APP_NAME,
  );
}

export function adminAuth(): Auth {
  try {
    return getAuth(getApp(ADMIN_APP_NAME));
  } catch {
    return getAuth(getAdminApp());
  }
}
