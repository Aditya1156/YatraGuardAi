import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app-shell/page-header';
import { MenuScanner } from './menu-scanner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { requireSessionUser } from '@/lib/auth/session';
import { ALLERGEN_LABELS } from '@/types';

export const metadata: Metadata = { title: 'Menu check' };
export const dynamic = 'force-dynamic';

export default async function FoodPage() {
  const user = await requireSessionUser();

  if (user.allergyProfile.length === 0) {
    return (
      <>
        <PageHeader title="Menu check" backHref="/dashboard" />
        <EmptyState
          title="Tell us what you avoid first"
          description="This check compares a menu against your own allergen list. Without it there is nothing to flag, and a green result would be meaningless."
          action={
            <Button asChild>
              <Link href="/profile">Set my allergens</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Menu check"
        description={`Checking against ${user.allergyProfile
          .map((allergen) => ALLERGEN_LABELS[allergen].split(' / ')[0])
          .join(', ')}.`}
      />
      <MenuScanner />
    </>
  );
}
