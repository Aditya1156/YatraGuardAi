import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { TrustRing } from '@/components/trust-ring';
import { APP_NAME, PILOT_CITY, integrations, publicEnv } from '@/lib/config';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <TrustRing score={92} size="md" label="Welcome" />
        <h1 className="mt-6 font-display text-2xl">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to check prices, messages, routes and menus across {PILOT_CITY}.
        </p>
      </div>

      <Suspense fallback={<div className="skeleton h-40 rounded-card" />}>
        <LoginForm
          firebaseReady={integrations.firebaseClient}
          guestAllowed={publicEnv.allowGuestLogin}
        />
      </Suspense>
    </main>
  );
}
