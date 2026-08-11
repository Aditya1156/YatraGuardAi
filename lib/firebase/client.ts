'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { publicEnv } from '@/lib/config';

/**
 * Browser-side Firebase. Only ever used to obtain an ID token — the app's own
 * session lives in an httpOnly cookie minted by /api/auth/session.
 */

let cachedAuth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(publicEnv.firebase.apiKey && publicEnv.firebase.projectId);
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* keys to .env.local.',
    );
  }
  const config = {
    apiKey: publicEnv.firebase.apiKey!,
    authDomain: publicEnv.firebase.authDomain,
    projectId: publicEnv.firebase.projectId!,
    storageBucket: publicEnv.firebase.storageBucket,
    messagingSenderId: publicEnv.firebase.messagingSenderId,
    appId: publicEnv.firebase.appId,
  };
  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(getFirebaseApp());
  // Persist locally so an installed PWA does not sign the user out on relaunch.
  void setPersistence(auth, browserLocalPersistence);
  cachedAuth = auth;
  return auth;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
