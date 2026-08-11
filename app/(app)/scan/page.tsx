import type { Metadata } from 'next';
import { PageHeader } from '@/components/app-shell/page-header';
import { PriceScanner } from './price-scanner';
import { requireSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Price check' };
export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  const user = await requireSessionUser();

  return (
    <>
      <PageHeader
        title="Price check"
        description={`Photograph a bill or a price board and see how it compares with typical ${user.city} rates.`}
      />
      <PriceScanner city={user.city} />
    </>
  );
}
