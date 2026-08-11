'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: null, label: 'Everything' },
  { value: 'hills', label: 'Hills' },
  { value: 'beach', label: 'Beach' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'wildlife', label: 'Wildlife' },
] as const;

export function ThemeFilter({ active }: { active: string | null }) {
  return (
    <nav aria-label="Filter by theme" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        {THEMES.map((theme) => {
          const selected = active === theme.value;
          return (
            <li key={theme.label}>
              <Link
                href={theme.value ? `/discover?theme=${theme.value}` : '/discover'}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap rounded-pill px-3.5 py-2 text-sm font-medium transition-colors',
                  selected ? 'bg-trust-indigo text-white' : 'bg-surface text-muted-foreground',
                )}
              >
                {theme.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
