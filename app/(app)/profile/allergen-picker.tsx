'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { ALLERGENS, ALLERGEN_LABELS, type Allergen } from '@/types';

export function AllergenPicker({ initial }: { initial: Allergen[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Allergen[]>(initial);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (allergyProfile: Allergen[]) =>
      apiSend('/api/profile', 'PATCH', { allergyProfile }),
    onSuccess: () => {
      setSaved(true);
      router.refresh();
    },
  });

  const dirty =
    selected.length !== initial.length || selected.some((item) => !initial.includes(item));

  function toggle(allergen: Allergen) {
    setSaved(false);
    setSelected((current) =>
      current.includes(allergen)
        ? current.filter((item) => item !== allergen)
        : [...current, allergen],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ALLERGENS.map((allergen) => {
          const active = selected.includes(allergen);
          return (
            <button
              key={allergen}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(allergen)}
              className={cn(
                'flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-trust-indigo text-white'
                  : 'bg-surface text-muted-foreground hover:bg-muted',
              )}
            >
              {active && <Check className="size-3.5" aria-hidden />}
              {ALLERGEN_LABELS[allergen]}
            </button>
          );
        })}
      </div>

      {save.isError && <ErrorState description={errorMessage(save.error)} />}

      {dirty && (
        <Button size="sm" className="self-start" loading={save.isPending} onClick={() => save.mutate(selected)}>
          Save allergens
        </Button>
      )}

      {saved && !dirty && (
        <p className="text-xs font-medium text-signal-green">Saved.</p>
      )}
    </div>
  );
}
