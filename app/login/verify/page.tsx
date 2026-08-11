import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailLink } from './verify-client';

export const metadata: Metadata = { title: 'Finishing sign-in' };
export const dynamic = 'force-dynamic';

/** Landing page for the Firebase passwordless email link. */
export default function VerifyPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5">
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
        <VerifyEmailLink />
      </Suspense>
    </main>
  );
}
