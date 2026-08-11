'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Home, Map, ScanLine, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Section 4: five thumb-reachable tabs, fixed to the bottom of the viewport. */
const TABS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/scan', label: 'Scan', icon: ScanLine },
  { href: '/routes', label: 'Routes', icon: Map },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/95 backdrop-blur"
      style={{ paddingBottom: 'var(--safe-area-bottom)' }}
    >
      <ul className="mx-auto flex max-w-[480px] items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-trust-indigo' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-12 place-items-center rounded-pill transition-colors',
                    active && 'bg-trust-indigo/10',
                  )}
                >
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
