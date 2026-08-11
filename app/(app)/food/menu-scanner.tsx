'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UtensilsCrossed } from 'lucide-react';
import { CameraCapture } from '@/components/camera-capture';
import { TrustRing, TrustPill } from '@/components/trust-ring';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, InfoNote, ResultSkeleton } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import { ALLERGEN_LABELS, type FlaggedDish, type FoodCheckResult } from '@/types';

export function MenuScanner() {
  const [file, setFile] = useState<File | null>(null);

  const check = useMutation({
    mutationFn: async (image: File) => {
      const form = new FormData();
      form.append('image', image);
      return apiSend<FoodCheckResult>('/api/food/check', 'POST', form);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <CameraCapture
        subject="the menu"
        hint="One section at a time reads best. Get the dish names in focus — prices do not matter here."
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
        <Button size="lg" block loading={check.isPending} onClick={() => check.mutate(file)}>
          Check this menu
        </Button>
      )}

      {check.isPending && <ResultSkeleton />}

      {check.isError && (
        <ErrorState
          description={errorMessage(check.error)}
          onRetry={file ? () => check.mutate(file) : undefined}
        />
      )}

      {check.data && <FoodResult result={check.data} />}

      {!file && !check.data && (
        <EmptyState
          icon={UtensilsCrossed}
          title="Nothing checked yet"
          description="Dishes are matched against a curated local list, including regional spellings. Anything it does not recognise is marked unknown rather than safe."
        />
      )}
    </div>
  );
}

function FoodResult({ result }: { result: FoodCheckResult }) {
  const flagged = result.items.filter((item) => item.conflicts.length > 0);
  const rest = result.items.filter((item) => item.conflicts.length === 0);

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="No dishes could be read"
        description="Nothing on that photo looked like a menu. Try one section at a time, straight on, in good light."
      />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-live="polite">
      <div className="flex flex-col items-center rounded-card bg-surface px-4 py-6 shadow-card">
        <TrustRing score={result.score} size="lg" />
        <p className="fab-safe mt-4 text-pretty text-center text-sm text-muted-foreground">{result.summary}</p>
      </div>

      {flagged.length > 0 && (
        <div>
          <h2 className="mb-2 text-base">Avoid these</h2>
          <ul className="flex flex-col gap-2">
            {flagged.map((dish, index) => (
              <DishRow key={`${dish.dishName}-${index}`} dish={dish} />
            ))}
          </ul>
        </div>
      )}

      {rest.length > 0 && (
        <details className="rounded-card bg-surface p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-semibold">
            The other {rest.length} dish{rest.length === 1 ? '' : 'es'}
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {rest.map((dish, index) => (
              <DishRow key={`${dish.dishName}-${index}`} dish={dish} bare />
            ))}
          </ul>
        </details>
      )}

      <InfoNote>
        Kitchens change recipes and share fryers. Treat this as a prompt to ask, not a guarantee —
        always tell the staff about a serious allergy.
      </InfoNote>
    </section>
  );
}

function DishRow({ dish, bare = false }: { dish: FlaggedDish; bare?: boolean }) {
  return (
    <li className={bare ? '' : 'rounded-card bg-surface p-3.5 shadow-card'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{dish.dishName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{dish.note}</p>
        </div>
        <TrustPill
          level={dish.verdict}
          label={
            dish.conflicts.length > 0
              ? dish.conflicts.map((a) => ALLERGEN_LABELS[a].split(' / ')[0]).join(', ')
              : dish.matchedDish === null && dish.allergens.length === 0
                ? 'Unknown'
                : 'OK for you'
          }
        />
      </div>
    </li>
  );
}
