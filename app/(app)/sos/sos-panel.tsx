'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { ErrorState, InfoNote } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import type { TrustedContact } from '@/types';

interface SosLink {
  contact: TrustedContact;
  smsUrl: string;
  whatsappUrl: string;
  callUrl: string;
}

interface SosResponse {
  id: string;
  message: string;
  mapsUrl: string | null;
  triggeredAt: string;
  links: SosLink[];
}

/**
 * 8.5. Location is read on the client, then the server composes the message and
 * deep links. The user still taps send — an app that silently messages people
 * on a mis-tap would quickly stop being trusted with the permission at all.
 */
export function SosPanel({ contacts }: { contacts: TrustedContact[] }) {
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const trigger = useMutation({
    mutationFn: async () => {
      const position = await readLocation();
      if (!position) {
        setLocationNote(
          'Your location could not be read, so the message asks your contacts to call you instead.',
        );
      }
      return apiSend<SosResponse>('/api/sos/trigger', 'POST', {
        location: position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null,
        accuracyM: position?.coords.accuracy ?? null,
        note: note.trim(),
      });
    },
  });

  async function readLocation(): Promise<GeolocationPosition | null> {
    if (!('geolocation' in navigator)) return null;
    setLocating(true);
    try {
      return await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8_000, maximumAge: 15_000 },
        );
      });
    } finally {
      setLocating(false);
    }
  }

  if (trigger.data) {
    return (
      <div className="flex flex-col gap-4" aria-live="assertive">
        <div className="rounded-card bg-signal-red/10 p-4">
          <h2 className="text-base">Send it now</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a contact below. Your phone opens the message ready to send — one more tap and it is
            gone.
          </p>
          {locationNote && <p className="mt-2 text-sm text-signal-red">{locationNote}</p>}
        </div>

        <pre className="whitespace-pre-wrap rounded-card bg-surface p-4 font-mono text-xs shadow-card">
          {trigger.data.message}
        </pre>

        <ul className="flex flex-col gap-2">
          {trigger.data.links.map((link) => (
            <li key={link.contact.phone} className="rounded-card bg-surface p-3.5 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{link.contact.name}</span>
                <span className="numeric text-xs text-muted-foreground">{link.contact.phone}</span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <a href={link.whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden />
                    WhatsApp
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <a href={link.smsUrl}>
                    <Send aria-hidden />
                    SMS
                  </a>
                </Button>
                <Button asChild size="sm" variant="danger">
                  <a href={link.callUrl} aria-label={`Call ${link.contact.name}`}>
                    <Phone aria-hidden />
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <Button variant="ghost" block onClick={() => trigger.reset()}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="danger"
        size="lg"
        block
        className="h-20 text-lg"
        loading={trigger.isPending || locating}
        onClick={() => trigger.mutate()}
      >
        Send SOS to {contacts.length} contact{contacts.length === 1 ? '' : 's'}
      </Button>

      <div>
        <label htmlFor="sos-note" className="mb-1.5 block text-sm font-medium">
          Anything to add? (optional)
        </label>
        <Textarea
          id="sos-note"
          className="min-h-20"
          maxLength={300}
          placeholder="e.g. I am outside the metro station, my phone is at 5%."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {trigger.isError && (
        <ErrorState description={errorMessage(trigger.error)} onRetry={() => trigger.mutate()} />
      )}

      <InfoNote>
        Nothing is sent without you tapping again. Your location is read only at the moment you press
        SOS, and it is never shared with anyone but your own contacts.
      </InfoNote>
    </div>
  );
}
