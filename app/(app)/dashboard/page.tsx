import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Compass, MapPin, Receipt, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/components/app-shell/page-header';
import { TrustRing } from '@/components/trust-ring';
import { InfoNote } from '@/components/ui/feedback';
import { requireSessionUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongoose';
import { PriceCheckModel, ScamReportModel } from '@/lib/db/models';
import { formatRelativeTime } from '@/lib/utils';
import { PILOT_CITY } from '@/lib/config';
import type { TrustLevel } from '@/types';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

interface ModuleCard {
  href: string;
  title: string;
  blurb: string;
  icon: typeof Receipt;
  recent: { score: number; verdict: TrustLevel; when: string } | null;
}

export default async function DashboardPage() {
  const user = await requireSessionUser();
  await connectToDatabase();

  // Section 4: a module card shows its own Trust Ring if a check ran recently.
  const [lastPriceCheck, lastScamReport] = await Promise.all([
    PriceCheckModel.findOne({ userId: user.id }).sort({ createdAt: -1 }).lean(),
    ScamReportModel.findOne({ userId: user.id }).sort({ createdAt: -1 }).lean(),
  ]);

  const modules: ModuleCard[] = [
    {
      href: '/scan',
      title: 'Price check',
      blurb: 'Photograph a bill or price board.',
      icon: Receipt,
      recent: lastPriceCheck
        ? {
            score: lastPriceCheck.score,
            verdict: lastPriceCheck.verdict as TrustLevel,
            when: formatRelativeTime(lastPriceCheck.createdAt ?? new Date()),
          }
        : null,
    },
    {
      href: '/scam',
      title: 'Scam check',
      blurb: 'Paste a message you are unsure about.',
      icon: AlertTriangle,
      recent: lastScamReport
        ? {
            score: lastScamReport.score,
            verdict: lastScamReport.score >= 70 ? 'safe' : lastScamReport.score >= 40 ? 'caution' : 'risk',
            when: formatRelativeTime(lastScamReport.createdAt ?? new Date()),
          }
        : null,
    },
    {
      href: '/routes',
      title: 'Safe route',
      blurb: 'Compare the fastest and the safest way there.',
      icon: MapPin,
      recent: null,
    },
    {
      href: '/food',
      title: 'Menu check',
      blurb: 'Flag dishes that carry your allergens.',
      icon: UtensilsCrossed,
      recent: null,
    },
  ];

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description={`You are set up for ${user.city}. Pick a check below.`}
      />

      {user.allergyProfile.length === 0 && (
        <div className="mb-4">
          <InfoNote>
            The menu check needs to know what you avoid.{' '}
            <Link href="/profile" className="font-semibold text-trust-indigo underline">
              Set your allergens
            </Link>
            .
          </InfoNote>
        </div>
      )}

      {user.trustedContacts.length === 0 && (
        <div className="mb-4">
          <InfoNote>
            SOS has nobody to reach yet.{' '}
            <Link href="/profile" className="font-semibold text-trust-indigo underline">
              Add a trusted contact
            </Link>
            .
          </InfoNote>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <li key={module.href}>
              <Link
                href={module.href}
                className="flex h-full flex-col rounded-card bg-surface p-4 shadow-card transition-shadow active:shadow-card-hover"
              >
                <span className="grid size-9 place-items-center rounded-full bg-trust-indigo/10 text-trust-indigo">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <h2 className="mt-3 text-[15px]">{module.title}</h2>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{module.blurb}</p>

                {module.recent && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <TrustRing score={module.recent.score} size="sm" hideLabel />
                    <span className="text-[11px] text-muted-foreground">
                      Last check
                      <br />
                      {module.recent.when}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/discover"
        className="mt-3 flex items-center gap-3 rounded-card bg-surface p-4 shadow-card"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-marigold/20 text-[#9a6410]">
          <Compass className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">Go somewhere quieter</span>
          <span className="block text-xs text-muted-foreground">
            Off-peak alternatives near {PILOT_CITY} for this month.
          </span>
        </span>
      </Link>
    </>
  );
}
