'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ErrorState, InfoNote } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';

type Mode = 'choose' | 'email-sent';

/**
 * Sign-in against Firebase, then exchange the ID token for the app's own
 * httpOnly session cookie. Two methods, per Section 3: Google, and a passwordless
 * email link (Firebase's free-plan stand-in for email OTP — an actual SMS OTP
 * needs a billing-enabled project, which this build refuses to require).
 */
export function LoginForm({
  firebaseReady,
  guestAllowed,
}: {
  firebaseReady: boolean;
  guestAllowed: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<'google' | 'email' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exchangeToken(idToken: string) {
    await apiSend('/api/auth/session', 'POST', { idToken });
    router.replace(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setPending('google');
    setError(null);
    try {
      const [{ getFirebaseAuth, googleProvider }, { signInWithPopup }] = await Promise.all([
        import('@/lib/firebase/client'),
        import('firebase/auth'),
      ]);
      const credential = await signInWithPopup(getFirebaseAuth(), googleProvider());
      await exchangeToken(await credential.user.getIdToken());
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(null);
    }
  }

  async function sendEmailLink(event: React.FormEvent) {
    event.preventDefault();
    setPending('email');
    setError(null);
    try {
      const [{ getFirebaseAuth }, { sendSignInLinkToEmail }] = await Promise.all([
        import('@/lib/firebase/client'),
        import('firebase/auth'),
      ]);

      await sendSignInLinkToEmail(getFirebaseAuth(), email.trim(), {
        url: `${window.location.origin}/login/verify?next=${encodeURIComponent(next)}`,
        handleCodeInApp: true,
      });
      // Firebase needs the address back when the link opens, possibly in a
      // different tab, so it has to survive the round trip.
      window.localStorage.setItem('yg:pendingEmail', email.trim());
      setMode('email-sent');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  async function continueAsGuest() {
    setPending('guest');
    setError(null);
    try {
      await apiSend('/api/auth/session', 'POST', { guest: true });
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(null);
    }
  }

  if (mode === 'email-sent') {
    return (
      <div className="rounded-card bg-surface p-5 text-center shadow-card">
        <Mail className="mx-auto size-6 text-trust-indigo" aria-hidden />
        <h2 className="mt-3 text-base">Check your inbox</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We sent a sign-in link to <span className="numeric">{email}</span>. Open it on this phone
          to finish.
        </p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setMode('choose')}>
          Use a different method
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorState title="Sign-in failed" description={error} />}

      {!firebaseReady ? (
        <InfoNote>
          Firebase sign-in is not configured on this deployment. Add the{' '}
          <code>NEXT_PUBLIC_FIREBASE_*</code> keys from <code>.env.example</code> to enable Google
          and email sign-in.
        </InfoNote>
      ) : (
        <>
          <Button
            size="lg"
            block
            variant="outline"
            loading={pending === 'google'}
            onClick={signInWithGoogle}
          >
            <GoogleMark />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={sendEmailLink} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" size="lg" block loading={pending === 'email'}>
              Email me a sign-in link
            </Button>
          </form>
        </>
      )}

      {guestAllowed && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            demo
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="ghost" block loading={pending === 'guest'} onClick={continueAsGuest}>
            Continue as a guest
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Guest sessions are for demos. Data is stored, but you cannot sign back into the same
            account later.
          </p>
        </>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3a12 12 0 0 0 10.2 6.3z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8z" />
    </svg>
  );
}
