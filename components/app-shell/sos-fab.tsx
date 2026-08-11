'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The always-available SOS control.
 *
 * It occupies a fixed ~72px column at the right edge, so anything that scrolls
 * beneath it gets covered — on a result screen that was landing squarely on the
 * verdict sentence and the price badges. Reserving a permanent gutter would
 * cost 56px of a 390px screen on every page, so instead it steps aside while
 * the user is actively scrolling down and reading.
 *
 * The safety property that matters: it is never *gone*. It returns immediately
 * on any upward scroll, and 180ms after scrolling stops. Someone who needs it
 * is not mid-scroll-down, and it is back before a thumb could reach it.
 */
export function SosFab() {
  const [hidden, setHidden] = React.useState(false);
  const lastY = React.useRef(0);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // Only yield past the fold, so it never flickers on short pages.
      setHidden(y > lastY.current && y > 140);
      lastY.current = y;

      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setHidden(false), 180);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <Link
      href="/sos"
      aria-label="Emergency SOS"
      className={cn(
        'fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full',
        'bg-signal-red text-sm font-bold text-white shadow-card-hover',
        'transition-all duration-200 active:scale-95 motion-reduce:transition-none',
        hidden && 'pointer-events-none translate-y-4 opacity-0',
      )}
      style={{ marginBottom: 'var(--safe-area-bottom)' }}
    >
      SOS
    </Link>
  );
}
