import type { Metadata } from 'next';
import { PageHeader } from '@/components/app-shell/page-header';
import { AllergenPicker } from './allergen-picker';
import { ContactManager } from './contact-manager';
import { SignOutButton } from './sign-out-button';
import { requireSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireSessionUser();

  return (
    <>
      <PageHeader title="Profile" description={`Signed in as ${user.email}`} />

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-1 text-base">Allergens</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            The menu check flags only what you pick here, by name.
          </p>
          <AllergenPicker initial={user.allergyProfile} />
        </section>

        <section>
          <h2 className="mb-1 text-base">TrustCircle</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Who SOS reaches. A name and a mobile number is all it needs.
          </p>
          <ContactManager initial={user.trustedContacts} />
        </section>

        <section>
          <h2 className="mb-1 text-base">City</h2>
          <p className="text-sm text-muted-foreground">
            This prototype covers <strong>{user.city}</strong> only. Reference prices, flagged areas
            and the dish list are all local to it.
          </p>
        </section>

        {user.isGuest && (
          <p className="rounded-card bg-marigold/10 p-4 text-sm">
            You are signed in as a guest. This account cannot be recovered once you sign out — use
            Google or email sign-in if you want to keep your history.
          </p>
        )}

        <SignOutButton />
      </div>
    </>
  );
}
