import type { TrustedContact } from '@/types';

/**
 * 8.5 Emergency SOS & TrustCircle.
 *
 * Deliberately built on SMS/WhatsApp deep links rather than push: on iOS a PWA
 * cannot rely on background push, and in an emergency the message has to leave
 * the phone even on a patchy network. The user taps once; the OS does the rest.
 */

export interface SosPayload {
  userName: string;
  location: { lat: number; lng: number } | null;
  accuracyM?: number | null;
  note?: string;
}

export function mapsUrl(location: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
}

/** The SOS text itself — short, unambiguous, and readable in a notification. */
export function buildSosMessage(payload: SosPayload): string {
  const lines = [`SOS from ${payload.userName}. I need help.`];

  if (payload.location) {
    lines.push(`My location: ${mapsUrl(payload.location)}`);
    if (payload.accuracyM && payload.accuracyM > 0) {
      lines.push(`(accurate to about ${Math.round(payload.accuracyM)} m)`);
    }
  } else {
    lines.push('My location could not be read — please call me now.');
  }

  if (payload.note?.trim()) lines.push(payload.note.trim());
  lines.push('Sent via YatraGuard AI.');

  return lines.join('\n');
}

/** Digits only, so `tel:`/`wa.me` links work regardless of how it was typed. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * wa.me needs a country code with no `+`. Indian 10-digit numbers get 91
 * prepended — without this the link silently opens an empty chat.
 */
export function whatsappNumber(phone: string): string {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface SosLink {
  contact: TrustedContact;
  smsUrl: string;
  whatsappUrl: string;
  callUrl: string;
}

export function buildSosLinks(contacts: TrustedContact[], message: string): SosLink[] {
  const encoded = encodeURIComponent(message);

  return contacts.map((contact) => ({
    contact,
    // `?body=` is the cross-platform form; iOS also accepts it since iOS 8.
    smsUrl: `sms:${normalizePhone(contact.phone)}?&body=${encoded}`,
    whatsappUrl: `https://wa.me/${whatsappNumber(contact.phone)}?text=${encoded}`,
    callUrl: `tel:${normalizePhone(contact.phone)}`,
  }));
}

/** Indian emergency numbers, shown alongside the TrustCircle. */
export const EMERGENCY_NUMBERS = [
  { label: 'Police', number: '100' },
  { label: 'All-in-one emergency', number: '112' },
  { label: 'Ambulance', number: '108' },
  { label: 'Women helpline', number: '1091' },
  { label: 'Tourist helpline', number: '1363' },
] as const;

const PHONE_PATTERN = /^\+?\d{10,14}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(phone));
}
