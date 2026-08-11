import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, MapPin, Receipt, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrustRing } from '@/components/trust-ring';
import { getSessionUser } from '@/lib/auth/session';
import { APP_NAME, PILOT_CITY } from '@/lib/config';

export const dynamic = 'force-dynamic';

const MODULES = [
  { icon: Receipt, title: 'Is this bill fair?', body: `Photograph it and compare against real ${PILOT_CITY} rates.` },
  { icon: AlertTriangle, title: 'Is this message a scam?', body: 'Paste it and get a plain-English verdict.' },
  { icon: MapPin, title: 'Is this route safe?', body: 'See the safest way there, not just the fastest.' },
  { icon: UtensilsCrossed, title: 'Can I eat this?', body: 'Photograph the menu; it flags your allergens by name.' },
];

export default async function LandingPage() {
  // Signed-in users never need the pitch.
  let signedIn = false;
  try {
    signedIn = (await getSessionUser()) !== null;
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect('/dashboard');

  return (
    <main id="main" className="mx-auto max-w-[480px] px-5 pb-16 pt-14">
      <div className="flex flex-col items-center text-center">
        <TrustRing score={86} size="lg" label="Trust score" />
        <h1 className="mt-7 font-display text-3xl leading-tight">
          {APP_NAME}
        </h1>
        <p className="mt-3 text-pretty text-base text-muted-foreground">
          Four checks a traveller in {PILOT_CITY} actually needs — price, scam, route and food — each
          answered as one score you can read in a second.
        </p>
      </div>

      <ul className="mt-10 grid gap-3">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <li key={module.title} className="flex gap-3 rounded-card bg-surface p-4 shadow-card">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-trust-indigo/10 text-trust-indigo">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base">{module.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{module.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-col gap-3">
        <Button asChild size="lg" block>
          <Link href="/login">Get started</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Built for {PILOT_CITY}. A student prototype from PESITM, Dept. of CSE — Team 05.
        </p>
      </div>
    </main>
  );
}
