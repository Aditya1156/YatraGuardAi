import type { Metadata } from 'next';
import { PageHeader } from '@/components/app-shell/page-header';
import { RoutePlanner } from './route-planner';
import { requireSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Safe route' };
export const dynamic = 'force-dynamic';

export default async function RoutesPage() {
  const user = await requireSessionUser();

  return (
    <>
      <PageHeader
        title="Safe route"
        description={`Compare the quickest way there with the way that avoids ${user.city}'s flagged areas.`}
      />
      <RoutePlanner />
    </>
  );
}
