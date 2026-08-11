'use client';

import * as React from 'react';
import { AlertTriangle, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Empty, error and loading states. Section 10 (Week 4) requires every screen to
 * have these written in the app's voice — plain, specific, never blaming the user.
 */

export function EmptyState({
  icon: Icon = Info,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-card bg-surface px-6 py-10 text-center', className)}>
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-trust-indigo/10 text-trust-indigo">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-base">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'That did not go through',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-card bg-signal-red/8 px-4 py-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-signal-red" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Shown while a module waits on Gemini/ORS — keeps the Trust Ring slot stable. */
export function ResultSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Skeleton className="size-[184px] rounded-full" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-56" />
      <span className="sr-only">Checking…</span>
    </div>
  );
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-trust-indigo/5 px-3 py-2.5 text-xs text-muted-foreground">
      <Info className="mt-px size-3.5 shrink-0 text-trust-indigo" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
