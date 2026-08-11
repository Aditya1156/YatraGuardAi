import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Mono, Manrope } from 'next/font/google';
import { APP_NAME, PILOT_CITY } from '@/lib/config';
import { Providers } from './providers';
import { ServiceWorker } from '@/components/service-worker';
import './globals.css';

/* Section 4 typography: Fraunces for display, Manrope for UI, Plex Mono for data. */
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — travel ${PILOT_CITY} without getting played`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Check a bill, a suspicious message, a route or a menu before it costs you. Every answer as one trust score.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#1B2A4A',
  width: 'device-width',
  initialScale: 1,
  // Locked so a double-tap on the SOS button cannot zoom instead of firing.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-trust-indigo focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
