import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { BottomNav } from '@/components/app-shell/bottom-nav';
import { SosFab } from '@/components/app-shell/sos-fab';
import { getSessionUser } from '@/lib/auth/session';
import { ConfigError } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Authenticated shell. Session verification happens here rather than in
 * middleware because verifying a Firebase session cookie needs the Node
 * runtime; middleware only does the cheap cookie-presence redirect.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;

  try {
    signedIn = (await getSessionUser()) !== null;
  } catch (error) {
    // A missing MONGODB_URI should explain itself, not bounce the user to login.
    if (error instanceof ConfigError) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-4 px-4">
          <ShieldAlert className="size-8 text-signal-red" aria-hidden />
          <h1 className="font-display text-xl">This deployment is not finished yet</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <p className="text-sm text-muted-foreground">
            Open <code className="numeric">/api/status</code> to see exactly which keys are missing.
          </p>
        </main>
      );
    }
    throw error;
  }

  if (!signedIn) redirect('/login');

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-canvas">
      <main id="main" className="px-4 pb-28 pt-6">
        {children}
      </main>
      <BottomNav />
      <SosFab />
    </div>
  );
}
