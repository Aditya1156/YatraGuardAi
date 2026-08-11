'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type TrustLevel, trustLevelFor } from '@/types';

/**
 * The Trust Ring — Section 4's signature element.
 *
 * Every detection module renders its 0–100 verdict through this one component.
 * Do not fork it per module; if a module needs something extra, add a prop here.
 */

export const TRUST_COPY: Record<TrustLevel, { label: string; tone: string }> = {
  safe: { label: 'Looks fair', tone: 'text-signal-green' },
  caution: { label: 'Be careful', tone: 'text-marigold' },
  risk: { label: 'High risk', tone: 'text-signal-red' },
};

const RING_STROKE: Record<TrustLevel, string> = {
  safe: 'stroke-signal-green',
  caution: 'stroke-marigold',
  risk: 'stroke-signal-red',
};

const SIZES = {
  sm: { box: 64, stroke: 6, value: 'text-lg', label: 'text-[10px]' },
  md: { box: 120, stroke: 9, value: 'text-3xl', label: 'text-xs' },
  lg: { box: 184, stroke: 12, value: 'text-5xl', label: 'text-sm' },
} as const;

export type TrustRingSize = keyof typeof SIZES;

interface TrustRingProps {
  /** 0–100. Values outside the range are clamped. */
  score: number;
  size?: TrustRingSize;
  /** Overrides the derived band — only pass when a module has its own rule. */
  level?: TrustLevel;
  label?: string;
  /** Hide the caption under the number (used inside dense cards). */
  hideLabel?: boolean;
  className?: string;
}

export function TrustRing({
  score,
  size = 'md',
  level,
  label,
  hideLabel = false,
  className,
}: TrustRingProps) {
  const reduceMotion = useReducedMotion();
  const safeScore = Math.round(Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0)));
  const band = level ?? trustLevelFor(safeScore);
  const { box, stroke, value, label: labelSize } = SIZES[size];

  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeScore / 100);
  const caption = label ?? TRUST_COPY[band].label;

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={`Trust score ${safeScore} out of 100 — ${caption}`}
    >
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <motion.circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={RING_STROKE[band]}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduceMotion ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
          }
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className={cn('numeric font-semibold leading-none', value, TRUST_COPY[band].tone)}>
          {safeScore}
        </span>
        {!hideLabel && (
          <span className={cn('px-2 text-center font-medium text-muted-foreground', labelSize)}>
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact inline verdict chip, for list rows where a full ring is too heavy. */
export function TrustPill({
  score,
  level,
  label,
  className,
}: {
  score?: number;
  level?: TrustLevel;
  label?: string;
  className?: string;
}) {
  const band = level ?? trustLevelFor(score ?? 0);
  const styles: Record<TrustLevel, string> = {
    safe: 'bg-signal-green/10 text-signal-green',
    caution: 'bg-marigold/15 text-[#9a6410]',
    risk: 'bg-signal-red/10 text-signal-red',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold',
        styles[band],
        className,
      )}
    >
      {typeof score === 'number' && <span className="numeric">{Math.round(score)}</span>}
      {label ?? TRUST_COPY[band].label}
    </span>
  );
}
