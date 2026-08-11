'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-center">
      <AlertTriangle className="mx-auto size-8 text-signal-red" aria-hidden />
      <h1 className="mt-4 font-display text-xl">That screen did not load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something broke on our side, not yours. Try again — if it keeps happening, the deployment may
        be missing a key.
      </p>
      {error.digest && (
        <p className="numeric mt-3 text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <Button className="mt-6 self-center" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
