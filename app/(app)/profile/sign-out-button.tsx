'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiSend } from '@/lib/client/api';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await apiSend('/api/auth/session', 'DELETE');
      // Clear the Firebase client session too, or the next visit silently
      // re-authenticates and the user appears never to have signed out.
      try {
        const [{ getFirebaseAuth, isFirebaseConfigured }, { signOut: firebaseSignOut }] =
          await Promise.all([import('@/lib/firebase/client'), import('firebase/auth')]);
        if (isFirebaseConfigured()) await firebaseSignOut(getFirebaseAuth());
      } catch {
        // Not fatal — the app session cookie is already gone.
      }
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Button variant="outline" block loading={pending} onClick={signOut}>
      <LogOut aria-hidden />
      Sign out
    </Button>
  );
}
