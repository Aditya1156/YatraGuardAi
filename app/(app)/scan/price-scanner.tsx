'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Check, Receipt } from 'lucide-react';
import { CameraCapture } from '@/components/camera-capture';
import { TrustRing, TrustPill } from '@/components/trust-ring';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, InfoNote, ResultSkeleton } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import { formatRupees } from '@/lib/utils';
import type { PriceCheckResult, PriceLineItem } from '@/types';

export function PriceScanner({ city }: { city: string }) {
  const [file, setFile] = useState<File | null>(null);

  const check = useMutation({
    mutationFn: async (image: File) => {
      const form = new FormData();
      form.append('image', image);
      return apiSend<PriceCheckResult>('/api/price/check', 'POST', form);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <CameraCapture
        subject="the bill"
        hint="Flatten it, fill the frame, and keep the item names and prices in shot."
        disabled={check.isPending}
        onCapture={(captured) => {
          setFile(captured);
          check.reset();
        }}
        onClear={() => {
          setFile(null);
          check.reset();
        }}
      />

      {file && !check.data && (
        <Button
          size="lg"
          block
          loading={check.isPending}
          onClick={() => check.mutate(file)}
        >
          Check this bill
        </Button>
      )}

      {check.isPending && <ResultSkeleton />}

      {check.isError && (
        <ErrorState
          description={errorMessage(check.error)}
          onRetry={file ? () => check.mutate(file) : undefined}
        />
      )}

      {check.data && <PriceResult result={check.data} city={city} />}

      {!file && !check.data && (
        <EmptyState
          icon={Receipt}
          title="Nothing checked yet"
          description={`Reference prices come from a seeded ${city} list that grows every time someone confirms a fair price.`}
        />
      )}
    </div>
  );
}

function PriceResult({ result, city }: { result: PriceCheckResult; city: string }) {
  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No items could be read"
        description="Nothing on that photo looked like a bill line. Try a straighter, brighter shot with the prices in frame."
      />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-live="polite">
      <div className="flex flex-col items-center rounded-card bg-surface px-4 py-6 shadow-card">
        <TrustRing score={result.score} size="lg" />
        <p className="fab-safe mt-4 text-pretty text-center text-sm text-muted-foreground">
          {result.summary}
        </p>

        <dl className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Charged</dt>
            <dd className="numeric mt-0.5 text-base font-semibold">
              {formatRupees(result.chargedTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Typical</dt>
            <dd className="numeric mt-0.5 text-base font-semibold">
              {formatRupees(result.referenceTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Extra</dt>
            <dd
              className={`numeric mt-0.5 text-base font-semibold ${
                result.overpaidBy > 0 ? 'text-signal-red' : 'text-signal-green'
              }`}
            >
              {result.overpaidBy > 0 ? formatRupees(result.overpaidBy) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="flex flex-col gap-2">
        {result.items.map((item, index) => (
          <LineItemRow key={`${item.itemName}-${index}`} item={item} />
        ))}
      </ul>

      {result.unmatchedCount > 0 && (
        <InfoNote>
          {result.unmatchedCount} item{result.unmatchedCount === 1 ? '' : 's'} had no {city}{' '}
          reference price. Confirm what they should cost and the next traveller gets a real answer.
        </InfoNote>
      )}

      <Button asChild variant="outline" block>
        <Link href="/alerts">See what else is being reported in {city}</Link>
      </Button>
    </section>
  );
}

function LineItemRow({ item }: { item: PriceLineItem }) {
  const [confirmed, setConfirmed] = useState(false);
  const [fairPrice, setFairPrice] = useState('');
  const [open, setOpen] = useState(false);

  const confirm = useMutation({
    mutationFn: (price: number) =>
      apiSend('/api/price/confirm', 'POST', { itemName: item.itemName, fairPrice: price }),
    onSuccess: () => {
      setConfirmed(true);
      setOpen(false);
    },
  });

  return (
    <li className="rounded-card bg-surface p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.itemName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
          {item.matchedItem && item.matchConfidence < 0.85 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Matched to “{item.matchedItem}” — correct it below if that is wrong.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="numeric text-sm font-semibold">{formatRupees(item.chargedPrice)}</span>
          <TrustPill
            level={item.verdict}
            label={
              item.deviationPct === null
                ? 'Unknown'
                : item.deviationPct <= 5
                  ? 'Fair'
                  : `+${Math.round(item.deviationPct)}%`
            }
          />
        </div>
      </div>

      {confirmed ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-signal-green">
          <Check className="size-3.5" aria-hidden />
          Thanks — added to the local reference list.
        </p>
      ) : open ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(fairPrice);
            if (Number.isFinite(value) && value > 0) confirm.mutate(value);
          }}
        >
          <div className="flex-1">
            <label htmlFor={`fair-${item.itemName}`} className="mb-1 block text-xs text-muted-foreground">
              What should this cost?
            </label>
            <Input
              id={`fair-${item.itemName}`}
              inputMode="decimal"
              className="h-10 numeric"
              placeholder="₹"
              value={fairPrice}
              onChange={(event) => setFairPrice(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" loading={confirm.isPending}>
            Save
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2.5 text-xs font-medium text-trust-indigo underline underline-offset-2"
        >
          {item.referencePrice === null ? 'Add the fair price' : 'Correct this price'}
        </button>
      )}

      {confirm.isError && (
        <p role="alert" className="mt-2 text-xs text-signal-red">
          {errorMessage(confirm.error)}
        </p>
      )}
    </li>
  );
}
