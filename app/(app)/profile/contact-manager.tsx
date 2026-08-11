'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import type { TrustedContact } from '@/types';

export function ContactManager({ initial }: { initial: TrustedContact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initial);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const add = useMutation({
    mutationFn: (contact: TrustedContact) =>
      apiSend<{ contacts: TrustedContact[] }>('/api/contacts', 'POST', contact),
    onSuccess: (data) => {
      setContacts(data.contacts);
      setName('');
      setPhone('');
      router.refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (contactPhone: string) =>
      apiSend<{ contacts: TrustedContact[] }>(
        `/api/contacts?phone=${encodeURIComponent(contactPhone)}`,
        'DELETE',
      ),
    onSuccess: (data) => {
      setContacts(data.contacts);
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {contacts.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nobody added yet"
          description="Add someone who would actually pick up — a friend in the city, or family back home."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <li
              key={contact.phone}
              className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{contact.name}</p>
                <p className="numeric text-xs text-muted-foreground">{contact.phone}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${contact.name}`}
                loading={remove.isPending && remove.variables === contact.phone}
                onClick={() => remove.mutate(contact.phone)}
              >
                <Trash2 className="text-signal-red" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(add.isError || remove.isError) && (
        <ErrorState description={errorMessage(add.error ?? remove.error)} />
      )}

      <form
        className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ name: name.trim(), phone: phone.trim() });
        }}
      >
        <div>
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Amma"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contact-phone">Mobile number</Label>
          <Input
            id="contact-phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="numeric"
            placeholder="9876543210"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm" className="self-start" loading={add.isPending}>
          <UserPlus aria-hidden />
          Add to TrustCircle
        </Button>
      </form>
    </div>
  );
}
