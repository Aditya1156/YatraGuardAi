# PROGRESS

Running log, per Section 0 of `PROJECT_MASTER_PROMPT.md`. Newest session at the top.

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
