# PROGRESS

Running log, per Section 0 of `PROJECT_MASTER_PROMPT.md`. Newest session at the top.

---

## Session 4 — AI failover

### Watch the two "OpenRoute" names `[TEAM NOTE]`

An **OpenRouter** key was supplied in place of the **OpenRouteService** key the
route planner needs. They are unrelated services with nearly identical names:

| Service | Domain | What it does | Needed for |
|---|---|---|---|
| OpenRouteService | `openrouteservice.org` | Maps, directions, geocoding | 8.3 route planning — **still missing** |
| OpenRouter | `openrouter.ai` | LLM gateway (GPT, Gemma, Claude…) | Optional AI fallback — now wired |

The key needed for 8.3 comes from `openrouteservice.org/dev/#/signup` and looks
like `5b3ce3597851110001cf6248…`. It is free and needs no card.

### Deviation from the locked stack `[TEAM DECISION]`

Section 3 locks AI to Gemini. OpenRouter is now wired as a **fallback only**,
at the team's request, for one concrete reason: Gemini's free tier allows 20
requests/day on the full flash models, and running out mid-session already
broke a working demo once. Gemini remains the primary and only path when it is
healthy.

### How it works

`lib/ai/provider.ts` owns the policy. A request that Gemini cannot *serve* —
`AI_QUOTA`, `AI_UNREACHABLE`, `AI_MODEL_GONE`, `AI_ERROR` — is retried through
OpenRouter. `AI_BLOCKED` is deliberately excluded: a content refusal is a
judgement rather than an outage, and retrying it elsewhere would be routing
around the refusal itself.

The AI layer was restructured to make this honest rather than bolted on:

- `lib/ai/contract.ts` — the request shape and JSON handling both providers share
- `lib/ai/gemini.ts` / `lib/ai/openrouter.ts` — one provider each, same interface
- `lib/ai/provider.ts` — failover policy and schema validation

Model is `google/gemma-4-26b-a4b-it:free`, chosen by testing all five free
vision-capable models on the bill fixture: it was the only one that both
answered and produced an extraction identical to Gemini's, unit prices included.
Free models carry their own rate limits, so this is a second chance rather than
a guarantee.

### Verified

- Failover fires: with `GEMINI_MODEL` pointed at a retired id, the log shows
  `gemini failed with AI_MODEL_GONE; falling back to openrouter` and the bill
  still scores 33/100 at ₹210 over — the same answer Gemini gives.
- Normal path unchanged: with a valid model, zero fallbacks occur.
- `/api/status` reports `aiFallback` under a new `optional` group, kept out of
  `configured` so an unset optional key cannot make a working deployment report
  itself as not ready.

### Still open

- [ ] **OpenRouteService key** — 8.3 remains the one module never run against a
      live API.
- [ ] **Firebase** — guest sign-in carries the demo; real sign-in needs it.
- [ ] Rotate the Gemini and OpenRouter keys — both were pasted into a chat
      transcript.

---

## Session 3 — the AI modules run end to end

A second Gemini key was supplied and it works. **All four core modules now run
on real data**, which is the Week 3 Definition of Done.

### Correction: this key is free tier, not paid

Session 2 recorded a deliberate move to a paid tier. That was based on the first
key, which never worked. The replacement key reports
`generate_content_free_tier_requests`, so **the ₹0 constraint in Section 2 still
holds** and nothing in this project currently needs a card.

### Free-tier quota is per model, and it is small

The full flash models allow **20 requests per day**. One `npm run demo` costs
five AI calls, so four passes exhausted it mid-session.

`GEMINI_MODEL` therefore defaults to `gemini-3.1-flash-lite`, which has its own
much larger allowance. This is not a downgrade for this workload: on the bill
fixture, flash-lite returned a byte-identical extraction to `gemini-3.6-flash`,
unit prices and all. Reading printed text does not need the bigger model.

Model availability also keeps moving. `gemini-2.0-flash` (the master prompt's
choice) is retired, and `gemini-2.5-flash` now refuses new API projects with a
404 saying it is "no longer available to new users".

### Verified working against the real API

- **8.1 Price** — read the bill fixture correctly, including the instruction to
  report *unit* rather than line-total prices (₹150, not ₹300). Scored 33/100,
  ₹210 over, matching the offline algorithm demo exactly.
- **8.2 Scam** — both scam messages caught (15/100 and 17/100), and the genuine
  Swiggy notification correctly cleared at 89/100.
- **8.4 Food** — 12 of 15 menu dishes flagged against a peanut/dairy profile.

### Bugs found and fixed

1. **Thinking tokens were truncating every structured response.** Current flash
   models are thinking models, and reasoning tokens are charged against
   `maxOutputTokens` *before* any output. The scam call capped it at 512 and was
   spending 484 on thought, cutting the JSON mid-object — which surfaced as a
   misleading "response could not be read" parse error. Thinking cannot simply
   be switched off (`gemini-3.6-flash` rejects `thinkingBudget: 0` with a 400),
   so the floor is now 4096 and a `MAX_TOKENS` finish reason raises a named
   `AI_TRUNCATED` error instead of blaming the parser.
2. **The city scam feed never grouped anything.** 8.2 step 4 exists to surface
   *repeated* patterns, but the aggregation grouped on the model's free-text
   label — and the same fake-KYC message came back as "Fake Bank KYC Phishing
   Scam", "Fake Bank KYC Expiry Scam" and "Fake bank KYC update scam" across
   runs. Every report became its own one-report alert, so the feature was dead
   on arrival while looking fine. Reports now store a deterministic
   `patternKey` derived from the local rule ids, which do not vary. Verified:
   three reports of the same scam under two different model labels now roll into
   a single alert reading "3 reports".

### Still open

- [ ] **OpenRouteService key** — the last unconfigured integration, and the only
      module never exercised against a live API. The risk scoring it feeds is
      verified; the directions call is not.
- [ ] **Firebase** — guest sign-in carries the demo; real sign-in needs it.
- [ ] Rotate both Gemini keys — they were pasted into a chat transcript.

---

## Session 2 — first real run, three bugs found and fixed

### Constraint change: paid Gemini tier `[TEAM DECISION]`

Section 2 says every service must have a free tier and that a paid tier is a
stop-and-flag. The team supplied a **paid** Gemini key and asked to proceed, so
this is recorded rather than silent: **the ₹0 constraint no longer holds for
Gemini.** Everything else (MongoDB M0, Firebase Spark, OpenRouteService,
OpenStreetMap, Vercel Hobby) is still free-tier with no card.

### The key does not currently work

The supplied key returns `403 PERMISSION_DENIED — "Your project has been denied
access"` on `generateContent`. Confirmed with a bare `curl`, so it is not our
request shape — the model-list endpoint answers fine on the same key while
generation is blocked at the project level. **Someone needs to sort this out in
Google Cloud before any AI module can run.**

Separately: `gemini-2.0-flash`, the model the master prompt specifies, **has
been retired by Google.** Default is now `gemini-2.5-flash`, and a 404 from the
model endpoint produces a named `AI_MODEL_GONE` error telling you how to list
current ids, because this will happen again.

### Ran end to end against a real database

MongoDB in Docker, seeded, production build, real HTTP requests. Everything that
does not need Gemini works: guest sign-in, profile, allergen list, TrustCircle,
SOS message and deep links, flagged areas, scam feed, seasonal discovery.

### Bugs the demo caught

1. **`selectRoutes` returned the same route for fastest and safest.** With
   weights 0.35 time / 0.65 risk, the slowest candidate always pays the full
   normalised time penalty, so a detour that cut exposure from 74% to 29% still
   lost. A "safest" option that can return the risky route makes the toggle a
   lie. Now 0.15 / 0.85, and the two options genuinely differ (47/CAUTION vs
   80/SAFE on the Majestic → Chickpet test).
2. **Fuzzy matching failed on regional spellings.** "Masaala Dose" scored 0.46
   against "Masala Dosa" — below the 0.62 threshold — because token overlap used
   exact set intersection, so individually-misspelled tokens counted as zero
   overlap. Tokens now match within a small edit distance, with greedy pairing so
   a repeated word cannot inflate the score. That variant is now 0.91, and
   "Buttr Nan" matches "Butter Naan" at 0.90 on the algorithm alone, without
   needing an alias entry.
3. **The demo displayed "unknown" as green "clear".** The app itself was correct
   — an unmatched dish is caution with "ask the kitchen" — but the demo's own
   label conflated the two, which is exactly the confusion that hurts someone
   with an allergy. Fixed in the demo output.

### Refactor: algorithms are now genuinely pure

`lib/algorithms/*` imported the Gemini client, which imports `server-only`, so
the scoring logic could not run outside Next at all. Every AI call now lives in
`lib/ai/extract.ts`; the Section 8 modules have no dependency on the AI client or
the database. That is what makes `npm run demo:algorithms` possible, and it
matches the master prompt's intent for `lib/algorithms/`.

### Added

- `npm run demo:algorithms` — scoring walkthrough, no keys needed.
- `npm run demo` — end-to-end HTTP journey; Gemini steps report `SKIPPED` with
  the reason instead of aborting, so it doubles as a deployment diagnostic.
- `npm run demo:fixtures` — renders a bill and a menu image with a hand-written
  5x7 bitmap font, so the OCR path has real input with no image dependency.
- `scripts/load-env.ts` — loads `.env.local` before `lib/config` snapshots
  `process.env`. ES imports are hoisted, so an inline `dotenv` call ran too late
  and the seed script silently saw an empty environment.

### Still blocked

- [ ] **Fix the Gemini key's project access.** Until then, price check, scam
      check and menu check cannot run. Everything downstream of them is built,
      tested and waiting.
- [ ] **OpenRouteService key** — the only integration still entirely unconfigured.
      Route planning needs it; the risk scoring it feeds is already verified.
- [ ] **Firebase** — guest sign-in covers the demo, but real sign-in needs it.

---

## Session 1 — full build, Weeks 1–4 scaffolded

### Decisions taken (Section 5 `[NEEDS TEAM INPUT]`)

| Decision | Chosen | Why |
|---|---|---|
| `PILOT_CITY` | **Bengaluru** | Asked for "a region with more data and exposure". Bengaluru has the most verifiable real price data (published auto/metro/BMTC fares, ticketed attractions, standardised darshini pricing) and the largest tourist footprint of the options considered. |
| Allergens | peanuts, dairy, gluten, shellfish, eggs, soy | All six from the master prompt's example list, with the dish data written specifically for Karnataka menus. |
| TrustCircle contact | name + phone | Phone is what the SMS/WhatsApp deep link needs; the name makes the list readable. Matches the Section 6 model exactly. |

### Built

**Week 1 — Foundation + design system** ✅
- Next.js 14 App Router, TypeScript strict (plus `noUncheckedIndexedAccess`), Tailwind.
- Full Section 4 token system: colours as CSS variables, Fraunces/Manrope/IBM Plex Mono, card
  styling as `surface` + soft shadow (no stripes, no accent underlines).
- `components/trust-ring.tsx` — the one component every module renders. Built before any feature
  screen, as instructed. Animates 0 → score once, respects `prefers-reduced-motion`.
- PWA: manifest, hand-written service worker, generated icons, offline page.
- Firebase Auth (Google + email link) → app-owned httpOnly session cookie.
- All Section 6 models, plus a seed script.
- Bottom-tab shell, dashboard with module cards showing each module's last Trust Ring.

**Week 2 — Price + scam** ✅
- Camera capture with client-side downscaling before upload.
- Gemini OCR → fuzzy match → deviation → Trust Ring, exactly per 8.1.
- 55 real Bengaluru reference prices seeded across 7 categories.
- Confirmation loop feeding a running median back into `PriceReference` (8.1 step 5).
- Scam classifier (8.2) with a local rule pass layered under the AI verdict.
- City scam-alert feed, aggregated in MongoDB.

**Week 3 — Routes + food + SOS** ✅
- Leaflet + OpenStreetMap tiles + OpenRouteService directions and geocoding.
- 6 curated flagged areas for Bengaluru with the reason attached to each.
- 8.3 risk scoring, fastest-vs-safest toggle.
- Menu OCR → allergen matching against 48 curated dishes → conflicts named specifically (8.4).
- SOS with location capture, pre-filled WhatsApp/SMS/call links, event logging (8.5).

**Week 4 — Stretch + polish** ✅
- Seasonal Discovery (8.6) — rule-based off-peak suggestions across 24 Karnataka destinations.
- Empty, error and loading states on every screen.
- `/api/status` diagnostics endpoint.
- Per-user rate limiting on every route, sized to protect the free AI/routing quotas.

### Assumptions stated (per Section 12)

1. **Hand-written service worker instead of `next-pwa`.** The plugin adds a build-time dependency
   for caching rules this app needs to control precisely — specifically, `/api/*` must *never* be
   cached, because a stale trust verdict is worse than no verdict. ~90 lines of explicit Workbox-style
   logic was the smaller, more auditable option.
2. **Gemini over REST, not an SDK.** Zero extra bundle weight in the serverless function, and the
   free-tier request shape stays visible when debugging quota errors.
3. **Email *link* rather than email OTP.** Firebase SMS OTP requires a billing-enabled project.
   Passwordless email link is the free-plan equivalent and needs no card, per the Section 2 constraint.
4. **8.3 cost function applied per route, not per edge.** OpenRouteService does not expose the
   underlying graph on the free tier, so the app requests alternative routes and ranks them with the
   master prompt's `w1 * normalizedTime + w2 * riskScore`. Same cost function, coarser resolution.
5. **Guest sign-in exists but defaults off.** Needs `ALLOW_GUEST_LOGIN=true` *and* a 32-char
   `SESSION_SECRET`. It is a demo affordance for judging without a Firebase account, not a real
   auth path.
6. **Unmatched items are never green.** An item with no reference price scores 50/caution, and an
   unrecognised dish is "unknown", not "safe". Showing green for something we have no data on would
   be the one failure mode that actually hurts someone.

### Verified

- `npm run build` — clean.
- `npm run check` (typecheck + lint) — clean.
- Production server smoke-tested: landing, login, offline and manifest all 200; `/dashboard`
  correctly 307s to `/login`; `/api/status` reports integration state.

### Blocked / needs the team

- [ ] **No API keys are configured yet.** Everything is wired and waiting. Fill `.env.local` from
      `.env.example`, then run `npm run seed`. `/api/status` tells you what is still missing.
- [ ] **Confirm the Gemini free tier is available for your Google account's region** before relying
      on it in the demo (Section 3 flags this). If it ever asks for billing, stop and say so.
- [ ] **Verify the seeded prices against reality.** They are researched typical rates, not a survey.
      Walking a few of them (a darshini bill, an auto meter, a Lalbagh ticket) before the demo makes
      the whole thing more credible, and corrections go straight in through the confirm flow.

### Next

- [ ] Cross-device install test — Android Chrome and iOS Safari "Add to Home Screen".
- [ ] Lighthouse PWA audit; fix anything under 90.
- [ ] Record the demo video, freeze `main`, tag `v1.0-prototype`.
