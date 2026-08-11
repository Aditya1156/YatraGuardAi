/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // firebase-admin and mongoose must stay real Node modules — bundling them
  // into the RSC graph breaks their dynamic requires.
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'mongoose'],
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'tile.openstreetmap.org' }],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // The app legitimately needs camera (bill/menu scan) and geolocation (SOS, routing).
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
        ],
      },
      {
        // The service worker must never be served from a stale cache, or users
        // get stuck on an old app shell forever.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
