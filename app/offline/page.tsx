import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Offline' };

/** Served by the service worker when a navigation fails with no network. */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-center">
      <WifiOff className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 font-display text-xl">You are offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Price, scam, route and menu checks all need a connection — they read live data rather than a
        cached answer, because a stale verdict is worse than none.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Your emergency numbers still work: dial <span className="numeric font-semibold">112</span>.
      </p>
    </main>
  );
}
