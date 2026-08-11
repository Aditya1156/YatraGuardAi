# YatraGuard AI

A tourist safety and trust platform for India, built as an installable Progressive Web App.

A visitor in an unfamiliar city faces the same four problems over and over: getting overcharged,
falling for a scam, taking an unsafe route, and eating something that triggers an allergy — with
nowhere to check any of it *before* it goes wrong. YatraGuard answers all four, and every answer
comes back as the same 0–100 **Trust Ring**.

**Pilot city: Bengaluru.** Reference prices, flagged areas and the dish list are all real and local
to it. This is depth over breadth by design — one city that genuinely works beats ten that are
half-seeded.

> Team 05 · PESITM, Dept. of CSE — Aditya Kumar, Aishwarya K R, Nandan S P, Nandini Hosamani

---

## What it does

| Module | What you do | What you get |
|---|---|---|
| **Price check** (8.1) | Photograph a bill or price board | Each line item compared against typical Bengaluru rates, with the rupee amount you were overcharged |
| **Scam check** (8.2) | Paste a message | `safe` / `suspicious` / `scam`, the signals that gave it away, and what to do next |
| **Safe route** (8.3) | Pick two points | Fastest vs. safest route, scored by how much of it runs through flagged areas |
| **Menu check** (8.4) | Photograph a menu | Dishes that carry *your* allergens, named specifically — never just "risky" |
| **SOS** (8.5) | One tap | Your live location as a ready-to-send WhatsApp/SMS message to your TrustCircle |
| **Discover** (8.6) | Pick a theme | Places near you that are *not* at peak this month |

Every module renders the same Trust Ring component. Green 70–100, amber 40–69, red 0–39.

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · MongoDB Atlas (M0) · Firebase Auth (Spark)
· Google Gemini · OpenRouteService + Leaflet + OpenStreetMap · Vercel Hobby.

Every one of those has a free tier that needs no credit card. Nothing in this repo requires a paid
plan to run.

---

## Getting it running

```bash
npm install
cp .env.example .env.local     # then fill in the keys — see below
npm run seed                   # loads the Bengaluru reference data
npm run dev
```

Open <http://localhost:3000>. Visit `/api/status` at any point to see exactly which integrations are
configured and whether the seed has run.

### The five accounts you need

All free, none need a card. `.env.example` has the direct signup link and the exact variable for each.

1. **MongoDB Atlas** — free M0 cluster. Allow network access from `0.0.0.0/0` so Vercel can reach it.
2. **Google AI Studio** — a Gemini API key.
3. **OpenRouteService** — a free developer key for directions and geocoding.
4. **Firebase** — Authentication with Google and Email-link providers enabled, plus a service
   account for the admin SDK.
5. **Vercel** — Hobby plan, connected to this repo.

If any of those asks for a card during signup, stop and say so before continuing. There is a free
route for all five.

### Seeding

`npm run seed` is idempotent — it upserts on `(city, normalizedName)`, so running it again refreshes
the seed rows without duplicating anything or overwriting prices users have already confirmed.

It loads roughly 55 reference prices, 6 flagged areas, 48 dishes with allergen data, and 24
destinations.

## Deploying

1. Push to GitHub.
2. Import the repo on Vercel (Hobby plan).
3. Add every variable from `.env.example` under Settings → Environment Variables. `FIREBASE_PRIVATE_KEY`
   keeps its `\n` escapes exactly as they appear in the service-account JSON.
4. Add your Vercel domain to Firebase Console → Authentication → Settings → Authorised domains,
   or Google sign-in will fail with `auth/unauthorized-domain`.
5. Run `npm run seed` locally against the production `MONGODB_URI` once.

## Installing it as an app

- **Android/Chrome** — open the site, then menu → *Install app*.
- **iOS/Safari** — Share → *Add to Home Screen*.

The service worker caches the app shell and static assets. It deliberately never caches `/api/*`:
a stale price or scam verdict would be worse than no answer, so those always hit the network.

---

## How it is laid out

```
app/
  (app)/          authenticated screens — dashboard, scan, scam, routes, food, sos, profile, discover
  api/            Section 7 route map; every route answers { ok: true, data } | { ok: false, error }
  login/          Firebase sign-in and the email-link callback
components/
  trust-ring.tsx  the signature component every module renders
  ui/             buttons, fields, empty/error states
  map/            Leaflet map (client-only)
lib/
  algorithms/     one file per Section 8 algorithm — pure functions, no I/O
  ai/gemini.ts    Gemini REST client with schema validation
  routing/        OpenRouteService client
  data/           the seeded Bengaluru reference data
  db/             Mongoose connection and models
  api/            response envelope, rate limiting, upload handling
types/            shared domain types
scripts/          seed and icon generation
```

The algorithms are deliberately separated from the routes: scoring, matching and risk assessment are
pure functions, so they can be reasoned about (and tested) without a database or an API key.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run seed` | Load Bengaluru reference data |
| `npm run check` | Typecheck + lint |
| `node scripts/generate-icons.mjs` | Regenerate the PWA icons |

---

## Honest limits

This is a student prototype, and it is worth being clear about what that means.

- **Reference prices are researched typical rates**, not a survey. They are the starting floor;
  every confirmed user correction folds into a running median, so the list gets more accurate with
  use. Treat a verdict as a prompt to ask, not proof.
- **Flagged areas are crowding and congestion advisories** with the reason attached — busy transit
  hubs, packed market lanes, a dangerous junction. They are not statements about the people who live
  or work there.
- **The allergen list errs toward flagging.** "Usually contains" is treated as "contains", and
  standard accompaniments count (South Indian chutney is normally thickened with groundnut). A
  missed flag is dangerous; an extra one is only inconvenient. It is not a substitute for telling
  the kitchen about a serious allergy.
- **The AI can be wrong.** OCR misreads handwriting, and classification is a judgement call. Every
  result screen says so.
- **Not hardened for production traffic.** There is per-user rate limiting to protect the free-tier
  quotas, but no pen-testing, no abuse detection, and no moderation of user-submitted prices.

## Licence

Built for academic coursework. No licence granted for commercial use.
