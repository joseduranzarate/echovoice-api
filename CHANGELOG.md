# Changelog

All notable decisions and progress on the speech project.

## [Unreleased]

### 2026-06-22 — Initial research & architecture decision

#### Project goal
Build a conversational voice AI app inspired by Sesame (app.sesame.com) —
low-latency, natural-sounding voice companion accessible through a browser,
with a clear path to scale without rewriting.

#### Reference research: how Sesame works
- **CSM (Conversational Speech Model)** replaces the standard TTS stage
- Pipeline: `STT → LLM → CSM (text + audio history) → speaker`
- CSM operates directly on RVQ audio tokens, not phonemes
- Split architecture: large backbone for semantics + small decoder for acoustic detail
- Trained on ~1M hours of audio with "compute amortization" (decoder trains on 1/16 of frames)
- CSM-1B is open source on Hugging Face — usable as a drop-in TTS later

#### Architecture decision: Pipecat over OpenAI Realtime
Rejected the simpler "OpenAI Realtime API" path because it locks us into one
vendor and one cost curve. Instead, building on **Pipecat** from day one so
every component is swappable.

```
[Browser]
   ↕ WebRTC (LiveKit transport)
[Pipecat agent — Python]
   ├── STT  →  Deepgram      (swap → self-hosted Whisper later)
   ├── LLM  →  Groq Llama / Anthropic  (swap → self-hosted vLLM at scale)
   └── TTS  →  Cartesia       (swap → CSM-1B self-hosted later)
```

#### Cost analysis summary
Per minute of conversation, rough averages:

| Stack | Prototype (10 hr/mo) | Growth (1k hr/mo) | Scale (100k hr/mo) |
|---|---|---|---|
| OpenAI Realtime gpt-4o | $120 | $12,000 | $1.2M |
| OpenAI Realtime mini | $24 | $2,400 | $240k |
| Pipecat all-hosted | $36 | $3,600 | $360k |
| Pipecat + self-hosted LLM | $40 + GPU | ~$2,500 | ~$60k |
| Pipecat + self-hosted everything | $40 + GPU | ~$2,000 | ~$30k |

**Key insight:** all hosted-API stacks scale linearly with usage. Self-hosting
flattens the curve. Break-even for self-hosting the LLM is around
500–1,000 concurrent hours/month.

#### Component prices used (early 2026)
- **STT — Deepgram Nova-3:** $0.0043/min
- **LLM — Groq Llama 3.3 70B:** ~$0.003/min average
- **LLM — Claude Haiku 4.5:** ~$0.001–0.005/min
- **TTS — Cartesia Sonic:** $0.004–0.008/min
- **Transport — LiveKit Cloud:** ~$0.005/min
- **GPU — H100 reserved:** ~$1.50/hr, ~30–60 concurrent calls each
- **GPU — L4 reserved:** ~$0.40/hr, ~50 concurrent TTS streams each

### Open questions before scaffolding

- [ ] Python or TypeScript for the agent? (leaning Python — Pipecat's native language)
- [ ] Sign up for Deepgram, Groq, Cartesia, LiveKit free tiers
- [ ] Pick a system prompt / personality for the first companion
- [ ] Decide on browser-only vs. browser + mobile later

### Build chunks (ongoing)

- [x] **Chunk 1** — sign up for 4 free accounts (Deepgram, Groq, Cartesia, LiveKit) — 2026-06-23
- [x] **Chunk 2** — folder structure + README — 2026-06-23
- [x] **Chunk 3** — REST API skeleton (FastAPI: `/health` + `/token`) — 2026-06-23
- [x] **Chunk 4** — test `/token` returns a valid JWT — 2026-06-23
- [x] **Chunk 5** — Pipecat agent skeleton (joins LiveKit room) — 2026-06-23
- [x] **Chunk 6** — test the agent joins a room (verified via logs) — 2026-06-23
- [x] **Chunk 7** — add STT (Deepgram) to the agent — 2026-06-23
- [x] **Chunk 8** — add LLM (Groq) to the agent — 2026-06-24
- [x] **Chunk 9** — add TTS (Cartesia) to the agent — 2026-06-24
- [x] **Chunk 10** — browser client (button + audio via LiveKit JS) — 2026-06-24
- [x] **Chunk 11** — first end-to-end conversation — 2026-06-24

### 2026-06-24 — Multi-tenant refactor (Chunk 12a)

- `agent/bot.py`: `ROOM_NAME` reads from runtime env (fallback `speech-room`)
- `api/main.py`: `/token` generates `call-{uuid}` per request; accepts optional `?room=` query param to pin
- Proven locally: two agent processes in two rooms with two browser tabs → independent LLM contexts, zero cross-talk

### Build chunks 12 — Deploy

- [x] **Chunk 12a** — dynamic room names (verified locally) — 2026-06-24
- [x] **Chunk 12b** — containerize the agent (Dockerfile) — 2026-06-24
- [ ] **Chunk 12c** — deploy API to Render *(paused — product pivot, see 2026-06-25)*
- [ ] **Chunk 12d** — deploy agent to Fly Machines + wire dispatcher
- [ ] **Chunk 12e** — deploy web client to Vercel
- [ ] **Chunk 12f** — first public conversation

### 2026-06-25 — Product definition pivot

Paused the deploy track (12c–f) before shipping anything publicly. Reason:
deploying a generic voice demo would lock us into infrastructure choices
(auth, DB, billing) made for the wrong product. Defined the actual product
first so the deploy targets the real thing.

#### Product: **Echo** — voice-first language practice partner
- One-sentence pitch: *press one button, talk to a patient AI partner in
  the language you're learning, it talks back like a real person*
- Primary audience: adult English learners (B1–C1), already on
  Duolingo/Babbel, frustrated they can't *speak*
- Secondary: parents practicing with kids, IELTS/TOEFL prep, job-interview prep
- Web first → mobile later. SSO only (Google/Apple), 2-question onboarding,
  under 60s to first conversation
- The interface IS the orb. No chat bubbles, no avatars, no streaks, no XP

#### Pricing *(revised — see 2026-06-25 cost optimization entry)*
- **Free**: 5 min/day, no history
- **Premium**: $14.99/mo or $119/yr — 30 min/day fair use, history, transcripts
  with corrections, multiple voices

#### Profit analysis — the uncomfortable truth
Per-minute cost locked at **~$0.026/min** ($1.58/hr) on the hosted stack
(LiveKit $0.010 + Deepgram $0.0043 + Groq $0.003 + Cartesia $0.006 +
Fly compute $0.003).

Blended premium user → 585 min/mo → **$15.21 cost vs $14.99 revenue**.
**Premium is structurally negative on hosted APIs, regardless of conversion.**

| Scale (100k users, 10% conv.) | Premium MRR | Gross profit/mo |
|---|---|---|
| Fully hosted | $149,900 | **−$137,200** |
| TTS self-hosted (CSM-1B on L4) | $149,900 | **−$107,900** |
| Full self-host (TTS + LLM) | $149,900 | **+$6,700** |

**Conclusions baked into the plan:**
1. Self-hosting TTS + LLM is not optional — it's the business model
2. Free-tier discipline (day-7 deactivation, no rollover) matters more
   than any feature
3. Annual plans ($119/yr) subsidize churn and improve cash flow
4. Realistic ceiling: profitable indie/small-Series-A SaaS, not a unicorn

#### Deliverables produced today
- Full product spec (audience, flows, screens, anti-requirements)
- Profit analysis (unit economics, sensitivity, path to profitability)
- Design brief for Claude (UI/UX prompt — given to user to drive design work)

#### Architecture additions decided (not yet built)
- **Auth**: Clerk (SSO, sessions, webhooks)
- **DB**: Supabase Postgres (users, sessions, transcripts, usage_minutes, subscriptions)
- **Billing**: Stripe (subscriptions, webhooks → Supabase)
- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Analytics**: PostHog (product), Sentry (errors)
- **Rate limiting**: session-aware, enforced at agent dispatch

### Build chunks 13+ — Echo product layer

- [x] **Chunk 13** — Clerk auth integrated with API + web — 2026-06-26
- [x] **Chunk 14** — Supabase schema + JIT user upsert — 2026-06-27
- [x] **Chunk 15** — session-aware agent (sessions + transcripts + usage rollups) — 2026-06-27
- [x] **Chunk 16** — daily rate limiting + trial credit (3/30 min/day + 15-min trial, enforced at /token) — 2026-06-27
- [x] **Chunk 17a** — design tokens + Orb + landing + custom SSO sign-in — 2026-06-27
- [x] **Chunk 17b** — onboarding + LiveKit-wired talk + summary — 2026-06-27
- [x] **Chunk 17c** — paywall + history + settings + soft-upsell modal — 2026-06-27
- [x] **Chunk 18** — Stripe subscriptions + webhook → Supabase *(code complete; waiting on Stripe account + env vars to test live)* — 2026-06-27
- [ ] **Chunk 19** — session detail with corrections + live captions *(history list shipped in 17c; remaining: per-session transcript view with LLM correction pass, and word-streaming captions on /talk)*
- [x] **Chunk 20** — deploy: API → Railway, agent → Railway, web → Vercel — 2026-06-27
- [ ] **Chunk 21** — PostHog + Sentry wired in
- [ ] **Chunk 22** — first public conversation as Echo

### 2026-06-25 — Free tier retune + cost optimization roadmap (V1 → V3)

Second pass on pricing after running per-hour cost numbers more carefully.
The previous free tier (5 min/day, no trial) was both bleeding margin and
not converting well — fixed both at once.

#### Pricing changes
- Free tier: **5 min/day → 3 min/day**, with a 1-time same-day retry rule
  (sessions ending in <30s don't count against the cap — covers genuine
  "mic didn't work" / "I bailed before saying anything" cases)
- **New: 15-minute one-time trial credit** spendable across the first 7 days,
  no credit card required. Replaces the idea of a "7-day premium trial"
  (which would cost up to $5.46/trial user — unbounded blast radius)
- Premium unchanged: $14.99/mo or $119/yr, 30 min/day fair use

#### Why this is better than 5 min/day
- Cuts free-tier blended cost from ~$1.17 → **~$0.91/free user/mo** (−22%)
- Lifts conversion (users hit the cap faster) by est. +2–4 pp
- Trade-off: −15–25% top-of-funnel signup rate (3 min "sounds stingier"
  than 5 min in ads) and −5–10 pp on day-1 return. Net: roughly wash on
  revenue, real win on cost discipline
- 15-min trial cost: max **$0.39/signup** vs $5.46 for a 7-day premium
  trial — survives even bad signup quality

#### Per-hour cost reference
**$1.58/hour** of active conversation on the current hosted stack
(LiveKit $0.60 + Deepgram $0.26 + Cartesia $0.36 + Groq $0.18 + Fly $0.18).

#### Cost optimization versions — the path to margin
Each version cuts the per-hour cost without changing the product surface.
Triggers are tied to scale, not calendar.

| Version | Trigger | Stack change | $/hr | vs V1 |
|---|---|---|---|---|
| **V1 (current)** | 0 → 1k users | LiveKit Cloud + Cartesia + Deepgram + Groq | $1.58 | — |
| **V1.5** | 1k → 5k users | Switch TTS: Cartesia → Deepgram Aura-2 (already a vendor) | $1.52 | −4% |
| **V2** | 5k → 10k premium users | Self-host TTS on L4 GPU (Kokoro or CSM-1B, ~50 concurrent/GPU) | $0.88 | −44% |
| **V3** | 10k+ premium users | Self-host LiveKit + self-host LLM (vLLM on H100, ~30 concurrent/GPU) | $0.39 | −75% |

Vendors *not* worth switching in V1 (researched, rejected):
- Agora (10× cheaper transport but immature Pipecat adapter, integration risk)
- OpenAI / Google / Azure TTS (cheap but 3–4× worse TTFB latency — kills the conversational feel that's core to the product)
- ElevenLabs (better quality than Cartesia but ~7× more expensive)

#### Profit estimates — V1 (current pricing) vs V3 (post self-host)

Assumptions: 10% free→premium conversion, 60/30/10 split of free users
(curious/casual/power), premium blended usage 585 min/mo, $14.99/mo
(annual mix ignored for simplicity).

**V1 — current hosted stack:**

| Total users | Free (90%) | Premium (10%) | MRR | Cost/mo | Gross profit/mo |
|---|---|---|---|---|---|
| 100 | 90 | 10 | $150 | $234 | **−$84** |
| 1,000 | 900 | 100 | $1,499 | $2,340 | **−$841** |
| 10,000 | 9,000 | 1,000 | $14,990 | $23,400 | **−$8,410** |
| 100,000 | 90,000 | 10,000 | $149,900 | $234,000 | **−$84,100** |

Loss scales linearly. Hosted-API economics never reach break-even at any scale.

**V3 — fully self-hosted (TTS + LLM + transport):**

| Total users | Free (90%) | Premium (10%) | MRR | Cost/mo | Gross profit/mo |
|---|---|---|---|---|---|
| 100 | 90 | 10 | $150 | $59 | **+$91** |
| 1,000 | 900 | 100 | $1,499 | $590 | **+$909** |
| 10,000 | 9,000 | 1,000 | $14,990 | $5,900 | **+$9,090** |
| 100,000 | 90,000 | 10,000 | $149,900 | $59,000 | **+$90,900** |

Net swing at 100k users: **+$175k/mo from cost optimization alone.**

#### Per-premium-user economics

| Metric | V1 (now) | V3 (target) |
|---|---|---|
| Direct cost per premium user/mo | $15.21 | $3.80 |
| Free-tier subsidy (9 free per 1 premium) | $8.19 | $2.07 |
| Fully-loaded cost per premium | $23.40 | $5.87 |
| Revenue per premium (monthly plan) | $14.99 | $14.99 |
| Net profit per premium user/mo | **−$8.41** | **+$9.12** |
| Payback on $20 CAC | never | ~2.2 months |

#### What this means for the build order
- **V1 launch goal**: prove the product, not profit. Budget for ~$10k/mo
  burn through 10k users. Acceptable as paid market research.
- **V2 trigger**: at ~5k premium users, the L4-GPU TTS self-host pays for
  itself within 60 days. Block ~2 weeks of engineering for the migration.
- **V3 trigger**: at ~10k premium users, the H100 LLM self-host crosses
  break-even. Block ~3–4 weeks of engineering (vLLM ops, eval pipeline,
  shadow-traffic comparison vs Groq).
- **The whole business hinges on reaching V3.** If retention/conversion
  don't get us to 5k premium users, the product was never going to work.

### 2026-06-26 — Chunk 13: Clerk auth wired end-to-end

Auth foundation for everything downstream (DB user records, rate limiting,
Stripe customer mapping). Generic Clerk-default styling kept on purpose —
visual polish deferred to Chunk 17 (full frontend).

- **Web** (`/web`): added `@clerk/nextjs`, wrapped `app/layout.tsx` in
  `<ClerkProvider>`, created `/sign-in` and `/sign-up` catch-all routes,
  added Next.js 16 `proxy.ts` (the renamed `middleware.ts`) with
  `clerkMiddleware()` gating everything except auth routes
- **API** (`/api`): added `clerk-backend-api`, new `auth.py` exposing
  `require_clerk_user` FastAPI dependency that verifies the session JWT via
  `authenticate_request(...)` and returns the Clerk `user_id` (the `sub`
  claim). `/token` now requires auth and mints the LiveKit JWT with the
  Clerk user_id as the LiveKit `identity` — so downstream agents can
  attribute every session to a real account
- **CORS**: API allows both `:3000` and `:3001` (Next sometimes falls back)
- Verified: unauth `/token` → 401, web `/` → 307 to `/sign-in`,
  Clerk-hosted sign-in widget renders, sign-in round-trip works via Google
  SSO

Deferred to later chunks:
- Clerk → Supabase webhook for user sync (waits on Chunk 14 schema)
- Branded sign-in UI (Chunk 17)
- Renaming the Clerk app from "echovoice" → "Echo" in the Clerk dashboard

### 2026-06-27 — Chunk 14: Supabase schema + JIT user upsert

Persistence layer for every product feature downstream (rate limiting,
history, Stripe).

- `supabase/migrations/001_init.sql`: 5 tables — `users`, `sessions`,
  `transcripts`, `usage_minutes`, `subscriptions`. RLS enabled as a deny-all
  safety net (no policies needed; all access is server-side via service_role)
- `api/db.py`: lazy-instantiated supabase-py client + `ensure_user(user_id)`
  helper
- `api/auth.py`: `require_clerk_user` now calls `ensure_user` after JWT
  verification — every authenticated API call JIT-creates the user row.
  Replaces the originally-planned Clerk webhook (no ngrok/Svix needed,
  simpler ops, only downside is email backfill is deferred)
- Verified end-to-end: smoke-test upsert against the live Supabase project,
  read back, deleted, confirmed all 5 tables addressable

Architecture note: we kept the traditional Browser → API → DB pattern.
Browser has zero Supabase credentials; Supabase URL + service_role key live
only in `/api/.env`. Could disable RLS with no functional change, but kept
on as cheap defense-in-depth.

### 2026-06-27 — Chunk 15: session-aware agent

Agent now persists everything it hears so downstream features (rate limiting,
history, billing) have data to work with.

- `agent/db.py`: `ensure_user`, `create_session`, `append_transcript`,
  `end_session` (which also bumps `usage_minutes` for today)
- `agent/bot.py`: tracks `SessionState` per room; `on_participant_connected`
  (non-self) → JIT user upsert + sessions row; `TranscriptLogger` writes a
  row per user turn and per assistant reply; `on_participant_disconnected`
  → closes the session row and rolls usage forward. All Supabase writes go
  through `asyncio.to_thread` + `asyncio.create_task` (fire-and-forget) so
  the audio pipeline never blocks on the DB
- Identification: participant_id == Clerk user_id (set when API minted the
  LiveKit JWT). One user per room — trusted from Chunk 12a
- Verified: full create/append/end loop against live Supabase, FK cascade
  delete cleared the smoke data

### 2026-06-27 — Chunk 16: rate limiting + trial credit

Locks in the pricing model. Free users get 3 min/day + a 15-min one-time
trial credit spendable across days 1–7. Premium users get 30 min/day.
Enforced at the front door (`/token`) so the agent never even spins up for
a user who's out of quota.

- `api/limits.py`: `quota_for(user_id)` returns daily + trial state in one
  shot. Constants in one place: `DAILY_CAP_S = {"free": 180, "premium": 1800}`,
  `TRIAL_TOTAL_S = 900`, `TRIAL_WINDOW_DAYS = 7`
- `api/main.py`: `/token` blocks with **HTTP 429** + JSON body
  `{plan, daily_cap_s, daily_remaining_s, trial_remaining_s, retry_after_s}`
  and a `Retry-After` header pointing at UTC midnight. Successful responses
  now carry `quota` so the browser can show "you have 2:14 left"
- `agent/db.py` (`end_session`): retry rule — sessions <30s (mic test,
  bailed before talking) don't count against quota. Daily quota fills first;
  overflow spills into trial credit if eligible; anything past both is
  unbilled grace (covers the race between gate and end-of-call)
- Tested: 5 quota scenarios + 4 allocation scenarios — all assertions pass
  against live Supabase

Storage decision: no schema migration. The original `usage_minutes` table
already had `trial_credit_used_s` per (user, day) — lifetime trial use is
just `SUM(trial_credit_used_s) WHERE user_id = ?`. Saved a migration round.

Known gap (deferred): `DAILY_CAP_S` / `TRIAL_*` constants are duplicated
between `api/limits.py` and `agent/db.py`. If they ever diverge, billing
will under/over-count. Acceptable for now (both venvs are tiny); split into
a shared package when we add a third caller.

### 2026-06-27 — Chunk 17b + 17c: real product UI

The frontend Echo from `/design_handoff_echo`. Everything visible to a user
now lives behind brand tokens — coral warmth, sage RESERVED for the
"speaking" cue, breathing-not-blinking motion.

- **`/onboarding`** — 2-question flow (level + topic) persisted to
  `localStorage` under `echo:onboarding:v1`. Skipped if already answered.
  Will move server-side when personalization actually drives the agent
- **`/talk`** — the screen the app is for. `useAuth().getToken()` → bearer
  fetch to FastAPI `/token` → `livekit-client`'s `Room.connect()` → mic on.
  Orb state machine driven by `RoomEvent.ActiveSpeakersChanged`:
  `connecting → listening → speaking → listening`. Remote audio attached to
  a hidden `<audio>` element. 429 from `/token` → redirect to `/paywall`.
  End button disconnects, stashes elapsed seconds in URL, pushes to summary
- **`/summary`** — congrats + duration. Sessions <30s show the retry-rule
  copy ("this one doesn't count")
- **`/paywall`** — daily-cap exhaustion screen. Premium copy follows the
  spec; Stripe button is dead until Chunk 18
- **`/history`** — premium home (screen 09). Lists recent sessions, big
  "Start a conversation" CTA, links to settings
- **`/settings`** — account/plan/practice rows + sign-out
- **`<UpsellModal />`** — soft upsell shell; not wired into a flow yet, kept
  for when post-summary upsell needs a cheaper-than-paywall variant

- **New API endpoints** (`/api/main.py`):
  - `GET /quota` — read-only quota for the timer hint on `/talk`
  - `GET /sessions` — recent sessions for `/history`, filtered to rows with
    `duration_s > 0` (cancelled/never-started don't pollute the list)
- **`/web/app/lib/api.ts`** — thin browser client. Bearer-token fetch
  wrapper, typed responses, surfaces 429 as `ApiError` so `/talk` can branch
- **`Orb` upgraded** — `state: "idle" | "listening" | "speaking" | "connecting"`.
  Speaking flips the gradient to sage (the brand's one exception for that
  color). Listening adds two outward-rippling rings via the existing `wave`
  keyframe
- **Sign-in updated to Clerk's new signal API** — `signIn.sso({...})`
  instead of the now-removed `authenticateWithRedirect`. Typecheck clean

Verified: routes 200/307 as expected, typecheck clean, dev compile clean.
Real end-to-end conversation through the new `/talk` page not yet tested
(needs a fresh sign-in session in the browser).

Deferred from 17c (intentional — both need infra we haven't built):
- Session detail with corrections (screen 10) — needs an LLM correction pass
- Live captions (screen 11) — needs word-streaming WebSockets

### 2026-06-27 — Chunk 18: Stripe subscriptions + webhook

End-to-end billing. Code is complete and import-clean; only the Stripe
credentials (test mode) are needed to test the live round-trip.

- `api/billing.py` — `create_checkout_session` and `create_portal_session`.
  `_get_or_create_customer` JIT-creates a Stripe Customer on first checkout
  and stores `stripe_customer_id` in the existing `subscriptions` row
- `api/webhooks.py` — verifies `Stripe-Signature` header, routes
  `checkout.session.completed` and `customer.subscription.*` events.
  Source of truth for `users.plan`: **only** flipped on
  `subscription.updated/created/deleted`, not on checkout success
  (cards can fail after checkout)
- `api/main.py` — three new endpoints:
  - `POST /billing/checkout` — returns `{url}` for the hosted Stripe page
  - `POST /billing/portal` — returns `{url}` for the customer portal
  - `POST /webhooks/stripe` — Stripe-signed, no Clerk auth
- `web/app/paywall/page.tsx` — "Go Premium" button now calls
  `/billing/checkout` and `window.location.assign(url)`
- `web/app/billing/success/page.tsx` + `cancel/page.tsx` — return targets
- `web/app/settings/page.tsx` — reads `quota.plan`, swaps the row trailing
  button between "Upgrade" (→ checkout) and "Manage" (→ portal). Daily-goal
  copy follows the plan too
- `web/app/lib/api.ts` — `startCheckout()` and `openPortal()` helpers

Required env vars (`api/.env`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_PREMIUM`, `WEB_URL` (defaults to `http://localhost:3001`).

For local webhook testing: `stripe listen --forward-to localhost:8000/webhooks/stripe`
(Stripe CLI prints a `whsec_...` secret to use).

Verified: `/billing/checkout` and `/billing/portal` return 401 without auth;
`/webhooks/stripe` returns 400 on unsigned payloads (signature check works).
Real charge round-trip not yet tested — needs the env vars.

### 2026-06-27 — Chunk 20: first end-to-end deploy

Echo is reachable on the open internet — Vercel web → Railway API → LiveKit
Cloud → Railway agent → audio back to the browser. Round-trip verified with
a real conversation.

**Hosting choices (deviated from the plan):**
- API → **Railway** (was Render). Picked one provider for both backend
  services to avoid juggling two dashboards / billing surfaces
- Agent → **Railway** (was Fly Machines). Fly required a separate credit
  card for activation; Railway already approved. Worth revisiting at
  Chunk 19 when proper Worker SDK dispatch lands
- Web → Vercel (unchanged)

**Repo prep:**
- `fded7bf` — `web/` was tracked as a gitlink (submodule pointer) after a
  stray `git init` inside it. Re-imported as a regular tree so Vercel can
  see the source

**API (Railway):**
- Service root pointed at `/api`; healthcheck on `/health`
- Env vars: `LIVEKIT_*`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`
  (Vercel origin), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CORS_ALLOW_ORIGINS` (Vercel origin), `DEFAULT_ROOM=speech-room`
- Public domain generated via "Generate Domain" — internal `.railway.internal`
  hostname only works for service-to-service traffic, not for browsers

**Agent (Railway):**
- Same repo, separate service with root `/agent` and Dockerfile build
- Env vars: `LIVEKIT_*`, `DEEPGRAM_API_KEY`, `GROQ_API_KEY`,
  `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`, `SUPABASE_*`, `ROOM_NAME=speech-room`
- No public port — agent is a LiveKit client, not a server

**Web (Vercel):**
- Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_API_URL` (Railway public domain)
- `NEXT_PUBLIC_*` is baked into the JS bundle at build time — any change
  requires a Vercel redeploy

**Wiring fixes shipped during bring-up:**
- `f8092cc` — API and agent were defaulting to different room names. Added
  `DEFAULT_ROOM` env var on the API so both services share `speech-room`.
  Permanent fix lands in Chunk 19 (per-call rooms via Worker SDK dispatch)
- `40c1341` / `22e5e41` — Clerk's `signIn.sso()` returns `{error}`, it
  doesn't throw. Inspect the result instead of wrapping in try/catch.
  Also call `signIn.reset()` first to wipe stale verification state from
  a previous failed/cancelled redirect — otherwise the SDK refuses to
  start a new flow. (Commit `3bd6294` tried `authenticateWithRedirect` —
  doesn't exist on `SignInFutureResource` in Clerk v7.5.9 future API;
  reverted)
- `01389b0` — Pipecat self-cancels the pipeline after 5 min idle and the
  process exits. Railway restarts it, but the ~15s boot gap leaves the
  room agentless — users who joined during that window heard silence.
  Wrapped `main()` in a reconnect loop as MVP stopgap. Removed in
  Chunk 19 when Worker SDK dispatches an agent per call

**Verified:** sign-in via Google, `/talk` connects to LiveKit, agent
responds with audio, transcripts persist, `/history` lists the session.

### 2026-06-27 — Agent transcript fix (post-Chunk 20)

User transcript rows were missing from Supabase — only `assistant` rows
appeared in the table.

- `5fa8f55` — Root cause: `TranscriptLogger` sat **after**
  `context_aggregator.user()` in the pipeline. The user context aggregator
  consumes `TranscriptionFrame` to build LLM context and does not propagate
  it downstream, so the logger only ever saw LLM frames. Fix: added a
  second `TranscriptLogger` instance directly after STT (it sees user
  turns) while keeping the original placement after LLM (it still sees
  assistant turns). No DB change needed — same table, same writer

### 2026-06-30 — UX fix: wait for agent before going live on /talk

User reported starting to speak before the agent was ready, losing the
first words of every session.

- `380f0dc` — `room.connect()` resolves the moment the SDP handshake
  finishes, but the agent may still be joining (or restarting). The old
  code flipped `phase` straight to `live` and the orb said "Listening"
  while the room was effectively empty. Added a `waking` phase between
  `connecting` and `live` that holds until `RoomEvent.ParticipantConnected`
  fires (or a remote is already present when we check
  `room.remoteParticipants`). 12-second timeout falls back to the error
  state and disconnects the room. Copy: "Connecting…" → "Waking up Echo…"
  → "Listening". End-conversation button stays disabled until truly live

### 2026-06-30 — Plan: pause numbered chunks for UX + tier polish

Stopping the Chunk 21+ track. The MVP is live and reachable; before
adding observability or relaunching, we want a polish pass on the
conversational experience and a sharper free-vs-premium contrast.

#### Free vs Premium — current state of truth

| Feature | Free | Premium |
|---|---|---|
| Price | $0 | $14.99/mo or $119/yr |
| Daily cap | 3 min/day | 30 min/day (fair use) |
| Trial credit | 15 min one-time, first 7 days | n/a |
| Retry rule (<30s doesn't count) | ✅ | ✅ |
| Reset | UTC midnight | UTC midnight |
| Session history (`/history`) | ❌ | ✅ |
| Transcripts with corrections | ❌ | 🟡 planned |
| Live captions on `/talk` | ❌ | 🟡 planned |
| Multiple voices | ❌ | 🟡 planned |
| Cross-session memory | ❌ | 🟡 planned |
| Onboarding (level + topic) | ✅ | ✅ |
| SSO (Google/Apple) | ✅ | ✅ |
| Stripe billing portal | n/a | ✅ |

🟡 = spec'd, not yet wired. Closing those gaps is the priority of this
ad-hoc track before resuming Chunk 21 (observability).

### Later

- Tune system prompt per learner level, swap voices
- Conversation memory across sessions (premium context continuity)
- Prompt caching, smaller-LLM routing for short turns
- **V1.5 migration**: Cartesia → Deepgram Aura-2 (single-vendor TTS+STT)
- **V2 migration**: self-host TTS on L4 (Kokoro first, CSM-1B if quality demands it)
- **V3 migration**: self-host LiveKit + self-host LLM on H100 (vLLM)
- Specialty tiers (Business English $24.99, Kids tier, IELTS prep)
