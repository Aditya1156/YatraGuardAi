import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { PageHeader } from '@/components/app-shell/page-header';
import { SosPanel } from './sos-panel';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { requireSessionUser } from '@/lib/auth/session';
import { EMERGENCY_NUMBERS } from '@/lib/algorithms/sos';

export const metadata: Metadata = { title: 'Emergency SOS' };
export const dynamic = 'force-dynamic';

export default async function SosPage() {
  const user = await requireSessionUser();

  return (
    <>
      <PageHeader
        title="Emergency SOS"
        description="Sends your live location to your TrustCircle as a ready-to-send message."
        backHref="/dashboard"
      />

      {user.trustedContacts.length === 0 ? (
        <EmptyState
          title="Your TrustCircle is empty"
          description="SOS opens a pre-filled message to people you choose. Add at least one before you need it."
          action={
            <Button asChild>
              <Link href="/profile">Add a contact</Link>
            </Button>
          }
        />
      ) : (
        <SosPanel contacts={user.trustedContacts} />
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-base">Official emergency numbers</h2>
        <ul className="grid gap-2">
          {EMERGENCY_NUMBERS.map((entry) => (
            <li key={entry.number}>
              <a
                href={`tel:${entry.number}`}
                className="flex items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card"
              >
                <span className="text-sm font-medium">{entry.label}</span>
                <span className="numeric flex items-center gap-1.5 text-sm font-semibold text-trust-indigo">
                  <Phone className="size-3.5" aria-hidden />
                  {entry.number}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
