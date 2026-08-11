import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { PageHeader } from '@/components/app-shell/page-header';
import { TrustPill } from '@/components/trust-ring';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { ScamReportModel } from '@/lib/db/models';
import { formatRelativeTime } from '@/lib/utils';
import type { ScamCategory } from '@/types';

export const metadata: Metadata = { title: 'Alerts' };
export const dynamic = 'force-dynamic';

interface AlertRow {
  _id: string;
  pattern: string;
  category: ScamCategory;
  count: number;
  lastSeen: Date;
  example: string;
}

/**
 * City scam feed (8.2 step 4). Rendered on the server so the list is present in
 * the first paint — this screen is read, not interacted with.
 */
export default async function AlertsPage() {
  const user = await requireSessionUser();
  await connectToDatabase();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await ScamReportModel.aggregate<AlertRow>([
    { $match: { city: user.city, category: { $in: ['scam', 'suspicious'] }, createdAt: { $gte: since } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $toLower: '$pattern' },
        pattern: { $first: '$pattern' },
        category: { $first: '$category' },
        count: { $sum: 1 },
        lastSeen: { $max: '$createdAt' },
        example: { $first: '$explanation' },
      },
    },
    { $sort: { count: -1, lastSeen: -1 } },
    { $limit: 20 },
  ]);

  return (
    <>
      <PageHeader
        title="Scam alerts"
        description={`Patterns other travellers reported in ${user.city} over the last 30 days.`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No reports yet this month"
          description={`Nothing has been flagged in ${user.city} in the last 30 days. When someone checks a message and it comes back as a scam, the pattern shows up here.`}
          action={
            <Button asChild size="sm">
              <Link href="/scam">Check a message</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row._id} className="rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base leading-snug">{row.pattern}</h2>
                <TrustPill
                  level={row.category === 'scam' ? 'risk' : 'caution'}
                  label={row.category === 'scam' ? 'Scam' : 'Suspicious'}
                />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{row.example}</p>
              <p className="mt-2.5 numeric text-xs text-muted-foreground">
                {row.count} report{row.count === 1 ? '' : 's'} · last seen{' '}
                {formatRelativeTime(row.lastSeen)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Reports are anonymous and aggregated. The original message text is never shown here.
      </p>
    </>
  );
}
