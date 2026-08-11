# YatraGuard AI — Master Prompt for Claude Code

**Purpose of this file:** this is the single source of truth for building YatraGuard AI. Paste this whole file to Claude Code as your first message in the repo (or keep it as `PROJECT_MASTER_PROMPT.md` at the repo root and reference it every session). It replaces back-and-forth explanation — Claude Code should read it fully before writing any code.

**Team:** Aditya Kumar, Aishwarya K R, Nandan S P, Nandini Hosamani — PESITM, Dept. of CSE, Team 05
**Timeline:** 4 weeks to a working prototype
**Budget:** ₹0 — every service used must have a genuinely free tier that does not require a credit card

---

## 0. How Claude Code Should Use This Document

- [ ] Read Sections 1–9 fully before writing any code.
- [ ] Build in the week order given in Section 10. Do not start Week 2 work until Week 1's Definition of Done is met.
- [ ] Every module reuses the **Trust Ring** component (Section 4) — do not invent a new visual pattern per module.
- [ ] If a decision is marked `[NEEDS TEAM INPUT]`, stop and ask rather than assuming.
- [ ] If a step needs a paid tier or a credit card, stop and flag it — do not silently substitute a paid service.
- [ ] Keep a `PROGRESS.md` in the repo, updated at the end of each work session: what got built, what's blocked, what's next.

---

## 1. Project Snapshot

YatraGuard AI is a tourist safety and trust platform for India. A visitor to an unfamiliar city faces four recurring problems: getting overcharged, falling for scams, taking unsafe routes, and eating something that triggers an allergy — with no single place to check any of it before something goes wrong. This prototype is a **Next.js Progressive Web App** that lets a traveller scan a bill, paste a suspicious message, plan a route, or check a menu, and get an instant, colour-coded trust verdict.

**Prototype scope, explicitly:** one pilot town/city, not a national rollout. Depth over breadth — a handful of features that genuinely work beats ten that are half-seeded.

---

## 2. Hard Constraints & Non-Goals

**Constraints**
- Every paid feature must have a free-tier equivalent with no card required (see Section 3 for the exact substitution made vs. the earlier plan).
- Must be demoable as an installed PWA on a phone.
- Must work end-to-end for **one** real town — not a stub with fake data everywhere.
- UI must feel modern and trustworthy, not like a generic admin template (see Section 4 — this is a hard requirement, not a nice-to-have).

**Explicit non-goals for this prototype** (say no to these if scope creep starts)
- No payments, no bookings, no multi-city launch.
- No native iOS/Android build — PWA only.
- No production-grade security hardening (rate limiting, pen-testing) — student prototype, not a live product.
- No training of custom ML models — use the Gemini API for all classification/OCR.

---

## 3. Tech Stack (Locked)

| Layer | Technology | Why / free-tier note |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | One codebase, PWA-capable |
| Styling/UI | Tailwind CSS + shadcn/ui | No license cost, fully customizable tokens |
| PWA | `next-pwa` / Workbox | Installable, offline shell |
| Animation | Framer Motion (used sparingly — see Section 4) | Free, npm |
| State/data | React Query (TanStack Query) | Free |
| Backend | Next.js API Routes (Node.js) | No separate server to host |
| Database | MongoDB Atlas, M0 free cluster | 512 MB, no card required |
| Auth | Firebase Authentication, Spark (free) plan | Email-OTP + Google sign-in, no card |
| AI (OCR + classification) | Google Gemini API (`gemini-2.0-flash` or current free-tier flash model) | Free tier via Google AI Studio, no card in most regions |
| **Maps & routing** | **Leaflet.js + OpenStreetMap tiles + OpenRouteService API** | **Changed from the earlier Google Maps recommendation** — Google Maps' free credit still requires a card on file. Leaflet/OSM tiles are free with no key at all; OpenRouteService gives free directions/routing with just an API-key signup, no card. |
| Notifications | Web Push (VAPID keys) + Firebase Cloud Messaging | Free; SMS/WhatsApp deep-link used as the reliable SOS fallback (Section 8.5) |
| Hosting | Vercel (Hobby plan) | Free, no card required for Hobby |
| Source control | GitHub | Free private repos |

`[NEEDS TEAM INPUT]` — confirm Gemini API free-tier availability/rate limits for your Google account region before Week 2; if it ever asks for billing, stop and tell me before proceeding.

---

## 4. Design System — "Trust Ring"

Modern and aesthetic isn't a vibe, it's a spec. Use exactly this token system so every screen looks like one product, not four bolted-together modules.

**Signature element:** every detection module (price check, scam check, route check, allergen check) outputs a score from 0–100 shown as the same circular radial gauge — the **Trust Ring**. Green (70–100, safe), amber (40–69, caution), red (0–39, risk). This single reused component is what ties four very different features into one visual identity — do not redesign it per module.

**Colour tokens**
| Token | Hex | Use |
|---|---|---|
| `ink` | `#14181F` | Primary text |
| `canvas` | `#FFFFFF` | Page background |
| `surface` | `#F7F7F5` | Cards, panels |
| `trust-indigo` | `#1B2A4A` | Brand primary, nav, headers |
| `marigold` | `#F2A93B` | Accent, caution ring state |
| `signal-green` | `#2E8B74` | Safe ring state, success |
| `signal-red` | `#D64545` | Risk ring state, alerts |

**Typography**
| Role | Typeface | Notes |
|---|---|---|
| Display (headers, hero) | Fraunces (variable) | Adds warmth/gravitas — use semi-bold, restrained |
| Body/UI | Manrope | Clean, highly legible on small screens |
| Data/numeric (prices, scores, coordinates) | IBM Plex Mono | Gives scanned data a "verified" feel |

**Layout**
- Mobile-first, single column, bottom tab bar (Home / Scan / Routes / Alerts / Profile) — thumb-reachable.
- Dashboard home = a grid of module cards, each showing its own Trust Ring if a check was run recently.
- Motion: one deliberate load-in for the Trust Ring animating from 0 to its score on result — no other decorative animation. Respect `prefers-reduced-motion`.
- No cream/beige backgrounds, no accent-line-under-title clichés, no edge stripes on cards — use `surface` fill + soft shadow to differentiate cards instead.

---

## 5. Decisions the Team Must Make Before Week 1 `[NEEDS TEAM INPUT]`

- [ ] **PILOT_CITY** — pick one real town/city you can genuinely gather ~20–30 reference prices and a rough mental map of unsafe/crowded areas for. Your own city (e.g. Shivamogga) is the lowest-effort, most credible choice for a demo.
- [ ] Which 4–6 allergens to support in the food-safety module (e.g. peanuts, dairy, gluten, shellfish, soy, eggs) — keep the list short and real.
- [ ] What "trusted contact" needs at minimum for SOS — just a phone number is enough for the prototype.

---

## 6. Data Models

```ts
// User
{ _id, name, email, phone, allergyProfile: string[], trustedContacts: [{ name, phone }], createdAt }

// PriceReference
{ _id, city, category, itemName, medianPrice, sampleCount, updatedAt }

// PriceCheck (user-submitted result, also enriches PriceReference)
{ _id, userId, city, itemName, chargedPrice, referencePrice, deviationPct, verdict, createdAt }

// ScamReport
{ _id, userId, rawText, category /* safe | suspicious | scam */, confidence, explanation, createdAt }

// RiskZone
{ _id, city, polygon /* GeoJSON */, riskLevel /* 1-5 */, source /* "curated" | "user-report" */, notes }

// AllergenItem
{ _id, dishName, city, allergens: string[], aliases: string[] }

// Destination (for Seasonal Discovery — Week 4 stretch)
{ _id, name, region, theme /* hills | beach | heritage | wildlife */, peakMonths: number[] }

// SOSEvent
{ _id, userId, location: { lat, lng }, triggeredAt, contactsNotified: string[] }
```

---

## 7. API Route Map

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/session` | Exchange Firebase token for app session | Public |
| POST | `/api/price/check` | Upload bill/menu image → OCR → deviation verdict | Required |
| GET | `/api/price/reference?city&item` | Look up stored reference price | Required |
| POST | `/api/scam/check` | Classify pasted message text | Required |
| GET | `/api/scam/alerts?city` | Recent confirmed scam patterns for a city | Required |
| POST | `/api/route/plan` | Origin/destination → fastest + safest route | Required |
| GET | `/api/riskzones?city` | Risk-zone GeoJSON for map overlay | Required |
| POST | `/api/food/check` | Menu image + allergy profile → flagged items | Required |
| POST | `/api/sos/trigger` | Send location to trusted contacts | Required |
| GET/POST | `/api/contacts` | Manage TrustCircle contacts | Required |
| GET | `/api/destinations/suggest?region&month` | Off-peak alternatives (Week 4 stretch) | Required |

---

## 8. Core Algorithms (implement exactly this logic)

**8.1 Price Fairness Engine**
1. Camera capture → send image to Gemini with an OCR+structuring prompt → return `[{item, price}]`.
2. Fuzzy-match each item name against `PriceReference` for `PILOT_CITY`.
3. `deviationPct = (chargedPrice - medianPrice) / medianPrice * 100`.
4. Trust Ring score: `100 - min(deviationPct, 100)` (clamped at 0). ≥70 fair, 40–69 caution, <40 overpriced.
5. Let the user confirm/correct, and feed confirmed prices back into `PriceReference` (running median).

**8.2 Scam Detector**
1. User pastes message text.
2. Send to Gemini with a classification prompt: categories `safe | suspicious | scam`, plus a one-line reason.
3. Map to score: safe=90, suspicious=55, scam=15 (adjust by confidence returned).
4. Store confirmed `scam` results; surface repeated patterns as a city-level alert feed.

**8.3 Safe Route Planner**
1. Model the pilot city's relevant area as a weighted graph via OpenRouteService directions between waypoints.
2. `edgeCost = w1 * normalizedTime + w2 * riskScore`, risk pulled from `RiskZone` polygons the route segment intersects.
3. Return two options: fastest (w2=0) and safest (w2 weighted high). Trust Ring shows the safest route's score.

**8.4 Food & Health Safety**
1. Reuse the OCR pipeline from 8.1 on a menu photo to extract dish names.
2. Fuzzy/Levenshtein match against `AllergenItem` (including `aliases` for regional dish-name variants).
3. Cross-reference against the user's `allergyProfile`; flagged items shown with the specific allergen named, not just "risky."

**8.5 Emergency SOS & TrustCircle**
1. One-tap SOS captures `navigator.geolocation` and opens a pre-filled SMS/WhatsApp link to each trusted contact (reliable even where Web Push/iOS background push is unreliable).
2. Log the event in `SOSEvent` for the user's own history.

**8.6 Seasonal Discovery (Week 4 stretch only)**
1. Rule-based: given the current month and a destination's `theme`, return 2–3 `Destination`s of the same theme whose `peakMonths` doesn't include the current month.
2. No ML — a filter query is enough for the prototype.

---

## 9. Free-Tier Account Setup Checklist

- [ ] MongoDB Atlas → create free M0 cluster, no card
- [ ] Firebase project → enable Authentication (Email/OTP + Google), Spark plan, no card
- [ ] Google AI Studio → get a Gemini API key (free tier)
- [ ] OpenRouteService → sign up for a free API key (no card)
- [ ] Vercel → connect GitHub repo, Hobby plan, no card
- [ ] (Optional) Web Push VAPID keys generated locally — no external account needed

If any of the above unexpectedly asks for a card during setup, stop and flag it before proceeding — there's a free alternative for every one of these.

---

## 10. Four-Week Build Plan

**Week 1 — Foundation + Design System**
- [ ] Next.js + TypeScript + Tailwind/shadcn scaffold, PWA manifest/service worker
- [ ] Implement the Trust Ring component and full colour/type token system (Section 4) — build this before any feature screen
- [ ] Firebase Auth wired up (email-OTP + Google)
- [ ] MongoDB schemas (Section 6) + seed script for `PILOT_CITY`
- [ ] Bottom-tab app shell, dashboard home with placeholder module cards
- [ ] Deploy skeleton to Vercel
- **Definition of Done:** a logged-in user sees a styled dashboard with working navigation, deployed and installable.

**Week 2 — Price Fairness Engine + Scam Detector**
- [ ] Camera capture flow, Gemini OCR integration
- [ ] Seed 20–30 real reference prices for `PILOT_CITY`
- [ ] Implement 8.1 end-to-end with Trust Ring result screen
- [ ] Scam-message input + Gemini classification, implement 8.2
- [ ] City scam-alert feed screen
- **Definition of Done:** both modules work on real, non-mocked data for the pilot city.

**Week 3 — Safe Route Planner + Food Safety + SOS**
- [ ] Leaflet map integration, OpenRouteService directions
- [ ] Curate risk-zone polygons for `PILOT_CITY` (rough is fine — mark 3–5 known crowded/unsafe areas)
- [ ] Implement 8.3 with fastest-vs-safest toggle
- [ ] Extend OCR to dish/allergen matching, implement 8.4
- [ ] SOS button + TrustCircle contact management, implement 8.5
- **Definition of Done:** all four core modules work end-to-end; SOS successfully opens a pre-filled message to a test contact.

**Week 4 — Stretch Feature, Polish, Testing, Demo Prep**
- [ ] Seasonal Discovery (8.6) — cut first if behind schedule (see Section 11)
- [ ] Full pass on empty/error states in the app's voice (see writing guidance in Section 4)
- [ ] Cross-device testing (Android Chrome install, iOS Safari "Add to Home Screen")
- [ ] Lighthouse PWA audit, fix anything under 90
- [ ] Record demo video, freeze `main`, tag `v1.0-prototype`
- **Definition of Done:** installable PWA, all four core modules demoable live on a phone for `PILOT_CITY`.

---

## 11. If You Fall Behind — Cut in This Order

1. Seasonal Discovery (8.6) — entirely optional, cut first.
2. Multi-language UI — ship English-only, add Hindi later.
3. Fastest-vs-safest route toggle — ship safest-only.
4. Scam-alert feed — ship the classifier without the city feed screen.

Never cut: Trust Ring consistency, the PWA install requirement, or working with real (not mocked) data for `PILOT_CITY`.

---

## 12. Working Agreement for Claude Code

- TypeScript strict mode, no `any` without a comment explaining why.
- Folder structure: `app/(routes)`, `components/`, `lib/algorithms/` (one file per Section 8 algorithm), `lib/db/`, `types/`.
- One feature branch per module (`feat/price-engine`, `feat/scam-detector`, …), merge to `main` after each Definition of Done.
- Commit messages: `[Week N] short description`.
- When a design or architecture choice isn't specified here, pick the option consistent with Section 4/6/7 and state the assumption in `PROGRESS.md` rather than pausing to ask — but stop and ask for anything marked `[NEEDS TEAM INPUT]` or anything that would require a paid tier.
