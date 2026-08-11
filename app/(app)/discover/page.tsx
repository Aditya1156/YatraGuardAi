import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { PageHeader } from '@/components/app-shell/page-header';
import { ThemeFilter } from './theme-filter';
import { EmptyState } from '@/components/ui/feedback';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { DestinationModel } from '@/lib/db/models';
import {
  monthName,
  suggestOffPeak,
  type DestinationRecord,
} from '@/lib/algorithms/seasonal-discovery';

export const metadata: Metadata = { title: 'Discover' };
export const dynamic = 'force-dynamic';

const THEMES = ['hills', 'beach', 'heritage', 'wildlife'] as const;

/** 8.6 Seasonal Discovery — off-peak alternatives, no ML, just a filter. */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: { theme?: string };
}) {
  await requireSessionUser();
  await connectToDatabase();

  const theme = THEMES.find((option) => option === searchParams.theme);
  const month = new Date().getMonth() + 1;

  const docs = await DestinationModel.find({}).lean();
  const records: DestinationRecord[] = docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    region: doc.region,
    theme: doc.theme as DestinationRecord['theme'],
    peakMonths: doc.peakMonths ?? [],
    distanceKm: doc.distanceKm ?? null,
    blurb: doc.blurb ?? '',
  }));

  const suggestions = suggestOffPeak(records, month, { theme, limit: 6 });

  return (
    <>
      <PageHeader
        title="Go somewhere quieter"
        description={`Places near you that are not at peak in ${monthName(month)} — the same kind of trip, minus the crowd and the peak-season pricing.`}
        backHref="/dashboard"
      />

      <ThemeFilter active={theme ?? null} />

      {suggestions.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Everything is peak right now"
          description={`Every ${theme ?? 'destination'} on the list is at its busiest in ${monthName(month)}. Try another theme, or go anyway and check prices before you pay.`}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base">{suggestion.name}</h2>
                {suggestion.distanceKm !== null && (
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {suggestion.distanceKm} km
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                {suggestion.theme}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{suggestion.why}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
