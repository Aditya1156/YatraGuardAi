'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';

type State = 'working' | 'needs-email' | 'error';

export function VerifyEmailLink() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [state, setState] = useState<State>('working');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  // React 18 StrictMode double-invokes effects; Firebase link codes are
  // single-use, so a second attempt would fail on a perfectly good link.
  const attempted = useRef(false);

  async function complete(address: string) {
    setState('working');
    setError(null);
    try {
      const [{ getFirebaseAuth }, { isSignInWithEmailLink, signInWithEmailLink }] =
        await Promise.all([import('@/lib/firebase/client'), import('firebase/auth')]);

      const auth = getFirebaseAuth();
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error('This link is not a valid sign-in link. Request a new one.');
      }

      const credential = await signInWithEmailLink(auth, address, window.location.href);
      window.localStorage.removeItem('yg:pendingEmail');

      await apiSend('/api/auth/session', 'POST', {
        idToken: await credential.user.getIdToken(),
      });
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
    }
  }

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const stored = window.localStorage.getItem('yg:pendingEmail');
    if (stored) void complete(stored);
    else setState('needs-email');
    // `complete` is stable for this one-shot flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'working') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-trust-indigo" aria-hidden />
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState title="That link did not work" description={error ?? 'Try signing in again.'} />
        <Button asChild block>
          <Link href="/login">Back to sign-in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void complete(email.trim());
      }}
    >
      <h1 className="font-display text-xl">Confirm your email</h1>
      <p className="text-sm text-muted-foreground">
        You opened the link on a different device, so we need the address it was sent to.
      </p>
      <div>
        <Label htmlFor="verify-email">Email address</Label>
        <Input
          id="verify-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" block>
        Finish sign-in
      </Button>
    </form>
  );
}
