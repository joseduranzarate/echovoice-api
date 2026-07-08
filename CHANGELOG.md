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
- [~] **Chunk 18** — Stripe subscriptions + webhook → Supabase *(code complete 2026-06-27; STILL UNTESTED with live credentials — the only chunk with unverified code in prod)*
- [x] **Chunk 19** — session detail with corrections + live captions — 2026-07-07 *(shipped as the endpoint-audit pass: /history/[id] transcript view + post-session correction job + data-channel captions on /talk)*
- [x] **Chunk 20** — deploy: API → Railway, agent → Railway, web → Vercel — 2026-06-27
- [ ] **Chunk 21** — PostHog + Sentry wired in
- [ ] **Chunk 22** — first public conversation as Echo *(prereqs: pricing decision, Chunk 18 live test, Chunk 21, Terms/Privacy pages)*

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

### 2026-07-01 — LiveKit free tier exhausted; agent paused

Woke up to a LiveKit "quota reached" email. Diagnosed the cause and paused
the agent to stop the bleeding. Not from user traffic — from architecture.

**Root cause:** the agent's 5-min reconnect loop (shipped 2026-06-27,
commit `01389b0`) keeps the bot in the LiveKit room 24/7. LiveKit meters
per participant-minute, so an idle agent burns quota indefinitely.
~1,440 participant-min/day × 3.5 days = 5,040 min → exactly the free
tier ceiling. User's actual testing was <100 min.

**Action taken:** removed the active deployment on the Railway agent
service (`echovoice-api` service with root `/agent`) — "Service is
offline / no active deployment". API service stayed up (doesn't touch
LiveKit until `/token` is called).

**Free tier resets 2026-07-01.** July is a fresh 5,000 min.

**Blocker:** must land LiveKit Agent Worker SDK dispatch before turning
the agent back on. Under that model the agent process registers with
LiveKit as a Worker and only gets dispatched into a room when a user
call actually starts — zero idle minutes. This kills two birds:

1. LiveKit meter goes to actual-usage-only
2. Removes the single shared `speech-room` limitation (was blocking
   more than 1 concurrent user globally, was tagged for the future
   Chunk 19 rewrite anyway)

Bumped this in front of Chunk 21 (observability) in the queue.

### 2026-07-01 — Design refresh in flight (external template pass)

Paused implementation work while the user runs a design pass with an
external template. Delivered a self-contained brief prompt covering:

- Product principles (orb-as-interface, no gamification, coral warmth,
  sage green reserved for "Echo is speaking" cue)
- Full tier feature list (Free vs Premium, shipped vs planned)
- All 10 routes to design (`/`, `/sign-in`, `/onboarding`, `/talk`,
  `/summary`, `/history`, `/history/[id]`, `/paywall`, `/settings`,
  billing return targets)
- Component library scope (`<Orb>`, `<Button>`, `<QuotaPill>`,
  `<SessionRow>`, `<CorrectionCallout>`, `<UpsellModal>`,
  `<VoicePicker>`, `<AuthCard>`)
- Anti-requirements (no streaks/XP/leaderboards/chat bubbles/mascot/
  fake urgency)

Brief is a one-shot handoff — not committed to the repo since it's a
working artifact for a different tool.

### 2026-07-02 — Pricing analysis: current V1 model is unprofitable

Ran the numbers on the current pricing (Free 3 min/day, Premium
$14.99/mo at 30 min/day) against the V1 hosted cost stack ($0.026/min).
Result: **−$8.41 per premium user per month.**

**Where the loss comes from (per premium user):**
- Premium usage cost @ 585 min/mo blended: $15.21
- Free-tier subsidy (9 free users per 1 premium × $0.91/mo blended): $8.19
- Loaded cost: $23.40 vs $14.99 revenue

**Scenarios explored** (with realistic utilization blend — lower caps
have higher % utilization):

| # | Free | Premium cap | Price | Net/premium/mo |
|---|---|---|---|---|
| 1 (current) | 3 min/day | 30 min/day | $14.99 | −$8.41 |
| 3 | 1 min/day | 15 min/day | $14.99 | +$2.90 |
| 5 | 1 min/day | 20 min/day | $19.99 | +$5.56 |
| 9 | 1 min/day | 10 min/day | $14.99 | +$5.24 |
| 6 | trial-only (no daily free) | 15 min/day | $14.99 | +$5.63 |

**Hybrid model proposed** (subscription + credit boosters):

| Layer | Price | Purpose |
|---|---|---|
| Free | 15-min trial credit, 7-day window | Acquisition |
| Premium sub | $14.99/mo, 10 min/day fair use | Habit lock + predictable MRR |
| Booster credits (NEW) | $5 = 40 min / $15 = 150 min | Captures power-user overage + micro-conversion from lapsed free |

**Why hybrid over pure credits:** language practice is a habit product.
Habit products need low pain-of-paying (sub psychology). Credits alone
would create meter-running anxiety, kill daily return, halve LTV.
Boosters as a *top-up* fix the power-user cost sink without breaking
habit formation.

**No code changes yet.** Constants in `api/limits.py` still hold the
old numbers. Decision deferred until design pass lands — new tier
UX/copy is easier to design after the visual system is refreshed.

**Open questions:**
- Pick between Scenario 9 (10 min/day, $14.99, cheapest & positive)
  and Scenario 5 (20 min/day, $19.99, more premium headroom)
- Decide if boosters are day-1 or fast-follow
- Adjust free tier: keep 3 min/day (retention-focused) or drop to
  1 min/day (conversion-focused) or trial-only (margin-focused)

### 2026-07-03 — Web redesign shipped (meadow design system)

Implemented the external design pass ("Echo Web Screens.html") across the
entire `/web` app. Full visual replacement, zero endpoint changes — every
screen still talks to the same FastAPI routes.

**New design system** (`globals.css` + `layout.tsx`):
- Warm cream palette: paper `#EFEDE6`, olive accent `#75894E`,
  yellow CTA `#EFD24A`, gold plan-badge `#AD8C46`
- Plus Jakarta Sans everywhere (replaces Cabinet Grotesk + General Sans)
- Orb is now olive (`#CBD7A6 → #8A9E5C → #5E7238`) with specular
  highlight; spin-ring while listening, ripple waves while speaking

**New app shell:** persistent left sidebar (Home / History / Talk /
Saved / Profile) with real quota in the free-plan upgrade card and the
Clerk user in the profile chip. Collapses to an icon rail below `md`.

**Screens:**
- `/` — signed-in users get a Home dashboard (greeting, dark Talk hero,
  prompt chips, scenario grid); signed-out keeps the landing, re-tinted
- `/talk` — new orb stage; all LiveKit logic untouched; added a working
  mic-mute toggle (design's mic button, wired to `setMicrophoneEnabled`)
- `/history` — stats row (this week / minutes / conversations) + card
  grid, all computed from `/sessions`; client-side date search
- `/settings` — Profile screen layout; `/paywall` — premium card with
  perks; `/summary` — transcript-style header, real data only
- `/saved` — new page, honest empty state (no phrases endpoint yet)

**Desktop layout fix (same day):** shell is full-width so the sidebar
hugs the left edge on any monitor; every screen's content is capped and
centered inside `main` (Settings 640px, Summary 760px, Home/History/
Saved 1040px). Card grids use `auto-fill minmax(300px,1fr)`.

**Design gaps deferred** (need backend work):
- Saved phrases → no API; page ships with empty state
- Transcript view with corrections → transcripts exist in Supabase but
  no client-facing endpoint yet
- Scenario/prompt chips are static; all route to `/talk`

### 2026-07-03 — iOS app scaffold (SwiftUI, design replica)

New `ios/` folder: native SwiftUI replica of "Echo Mobile Screen.html"
(the mobile companion design, same meadow palette). Built with xcodegen
(`project.yml` → `EchoMobile.xcodeproj`), iOS 17+, builds clean and runs
in the iPhone 17 simulator.

**All 13 screens replicated:** Splash (pink bloom-blob → orb formation),
Welcome, Auth (SSO buttons), 2-question Setup, Home, Talk (orb stage with
idle/listening/speaking cycle), Live transcript (word-by-word playback
with pause/resume), Session detail (gentle corrections), Summary,
Paywall, History, Saved, Profile — plus the premium upsell sheet and the
floating pill tab bar.

**Structure:** `Router` (screen enum + transcript playback engine),
`Theme` (palette + Plus Jakarta Sans static weights, bundled),
`Components` (OrbView / CTA pill / tab bar), one file per screen group.

**Status: UI-only.** Demo data from the design mock; no Clerk, LiveKit,
or API wiring. Auth buttons just advance; quota is hardcoded. Wiring the
iOS app to the real backend is a future chunk.

### 2026-07-03/04 — Agent re-enabled: on-demand dispatch, per-call rooms

The fix for the 2026-07-01 LiveKit quota burn. Replaces the
always-connected agent with **on-demand dispatch**: the agent joins a
LiveKit room only when a call actually starts, and leaves when it ends.

---

#### DIAGNOSIS — Before (the architecture that burned the free tier)

```
                        LiveKit Cloud
                     ┌───────────────────┐
                     │   "speech-room"   │
                     │   (one shared     │
  You ──/token────►  │    room, always   │  ◄──── Agent
  (only when you     │    the same)      │        joins at startup,
   want to talk)     └───────────────────┘        NEVER leaves
                                                  (loop rejoins it
                                                   every 5 min)

  ⏱ Meter: 24 h/day  →  ~1,440 participant-min/day
                     →  × 3.5 days ≈ 5,000 min = the entire free tier
  Actual conversation time in that period: < 100 min
```

How each piece contributed:

1. **LiveKit bills per participant-minute** — anyone connected to a
   room counts, talking or not. An idle agent is still a participant.
2. **The agent joined `speech-room` at startup and never left.** Room
   name came from its `ROOM_NAME` env var, hardcoded to one value.
3. **The `run_forever()` reconnect loop** (commit `01389b0`,
   2026-06-27) was the direct culprit. Pipecat self-cancels its
   pipeline after ~5 min of idle — which would have let the agent drop
   out — but the loop rejoined 2 s later, forever. It was shipped as an
   MVP stopgap to fix "agent disappears mid-day, calls go dead"; the
   billing consequence wasn't understood until the quota email.
4. **The old `/token` had a `?room=` param** (`room_name = room or
   DEFAULT_ROOM`). Tokens could target any room, but the agent only
   ever sat in its own `ROOM_NAME` room — so a custom room was an
   empty room unless you also edited the agent's env and restarted it
   (the manual two-room test from June). Practical result: one
   concurrent conversation globally, and any signed-in user could mint
   a token for an arbitrary room name (mild security smell).

#### AFTER — on-demand dispatch

```
  You ──/token───► API ──"wake up, room echo-a1b2c3"──► Agent (dispatch server,
                    │         (private network)          in NO LiveKit room,
                    │ mints fresh room name              waiting to be called —
                    ▼                                    costs 0 min while idle)
             ┌───────────────────┐
             │  "echo-a1b2c3"    │   ◄──── Agent joins ONLY now
   You join  │  (new room, used  │
             │   for this call   │
             │   only)           │
             └───────────────────┘
                      │
              you hang up (or never show up for 90 s)
                      ▼
              agent leaves, room dies

  ⏱ Meter: only during actual conversation
  ✓ One room per call → concurrent users supported
  ✓ Room names server-chosen (unguessable) → no token-for-any-room hole
```

Sequence per call:

1. Browser hits `POST /token` (Clerk-authed, quota-checked as before)
2. API mints a fresh single-use room name `echo-{12-hex-uuid}`
3. API POSTs `{room, user_id}` to the agent's `/dispatch` endpoint
   over Railway private networking, **before** returning the token —
   so Echo is usually already in the room when the browser connects
   (pairs with the "Waking up Echo…" phase on /talk)
4. Agent spawns one asyncio task per room: joins LiveKit, runs the
   existing pipeline (Deepgram → Groq → Cartesia, both TranscriptLogger
   taps, Supabase session rows — all unchanged)
5. User leaves → `on_participant_disconnected` closes the session row
   and `task.cancel()`s the pipeline → agent leaves the room
6. If the user never connects (closed the tab during "Connecting…"),
   a **90 s no-show watchdog** cancels the task and leaves the room

#### Why not the LiveKit Agent Worker SDK (the original plan)?

Deliberate deviation. Wrapping `livekit-agents` around Pipecat means the
job context connects to the room with its own identity *and* Pipecat's
`LiveKitTransport` connects separately — two agent participants per
call (extra billed minutes, and the web's "agent is here" check would
fire before the pipeline is actually ready, re-introducing the
lost-first-words bug). Self-managed dispatch is one HTTP endpoint and
reuses the whole existing pipeline unchanged. If we outgrow it (job
queuing, autoscaling), the Worker SDK is still available later.

#### Code changes

**`agent/bot.py`** — process is now an aiohttp server, not a room
resident:
- `POST /dispatch` — authenticated by `X-Dispatch-Secret` header;
  spawns `run_session(room)`; idempotent (re-dispatching an active
  room is a no-op); tracks tasks in `active_rooms` dict
- `GET /health` — `{status, active_rooms}` for monitoring
- `run_session(room)` — the old `main()` parametrized by room name;
  per-call `SessionState` (no more global session)
- Binds host `::` — **Railway private networking is IPv6-only**;
  binding `0.0.0.0` would make `*.railway.internal` unreachable
- `run_forever()` reconnect loop **deleted**
- `PipelineRunner(handle_sigint=False)` (server owns signals now)

**`api/main.py`**:
- `/token`: server-generated room name; client `room` param **removed**
- Dispatch call with 5 s timeout; on failure returns
  `503 {"error": "agent_unavailable"}` instead of letting the user
  join an agent-less room
- New env: `AGENT_DISPATCH_URL`, `DISPATCH_SECRET`
- `httpx` added to `api/requirements.txt`

**Web:** zero changes — `/token` response shape is identical.

#### Verified locally (2026-07-03)

- `GET /health` → `{"status": "ok", "active_rooms": 0}`
- Dispatch without secret → 401; without room → 400
- Real dispatch → agent joined the LiveKit room, full pipeline
  connected (Deepgram + Cartesia websockets up)
- No user joined → watchdog cancelled at 90 s, agent left cleanly,
  server stayed up, `active_rooms` back to 0
- Re-test on IPv6 (`http://[::1]:PORT`) after the `::` bind fix
- Remaining deprecation warnings are pre-existing (PipelineTask →
  PipelineWorker, Cartesia `voice_id`) — parked for a Pipecat 2.0 pass

#### Deploy checklist (manual, Railway) — NOT DONE YET

1. Generate a secret: `openssl rand -hex 32`
2. Agent service (named `echovoice-api`, root `/agent`): set
   `DISPATCH_SECRET=<secret>` and `PORT=8080`, re-enable deployment
3. API service: set `DISPATCH_SECRET=<same>` and
   `AGENT_DISPATCH_URL=http://<agent-service-name>.railway.internal:8080`,
   redeploy
4. Commit + push first — Railway builds from the repo
5. Test a call in prod; agent logs should show
   `dispatched agent to room 'echo-…'`

### 2026-07-07 — Dispatch deployed to prod + API endpoint audit

**Dispatch is live.** Deploy hit two snags, both fixed:
1. 502 through the agent's public domain — the generated domain's
   target port didn't match; set to 8080
2. Second 502 — the `host="::"` bind was IPv6-only and Railway's public
   edge connects over IPv4; fixed by binding all interfaces
   (`7acb037`), which also keeps `railway.internal` working for the
   future project consolidation

Note from the deploy: the container built **Pipecat 1.5.0** (local venv
has 1.4.0) because `agent/requirements.txt` is unpinned. Worked, but
pin versions eventually (added to tech debt).

Also shipped: the meadow web redesign is deployed on Vercel
(`4d7fa17`).

#### Endpoint audit — designs vs API (2026-07-07)

Mapped every screen in the web + iOS designs against `api/main.py`.

**Exists:** `POST /token`, `GET /quota`, `GET /sessions`,
`POST /billing/checkout`, `POST /billing/portal`,
`POST /webhooks/stripe`, healths, agent `POST /dispatch`.

**Missing, in suggested build order:**

1. **Transcript read path** — biggest gap. Data already lands in
   Supabase (`transcripts` table) but nothing serves it:
   - `GET /sessions/{id}` — meta + stats (duration, words, corrections)
   - `GET /sessions/{id}/transcript` — ordered turns
   - `GET /sessions/latest` — the browser never learns the session id
     (the agent creates the row), so Summary can't link to its own
     transcript without this
   - extend `GET /sessions` with title + preview (once #2 exists)
   - Unlocks: Transcript screen, real Summary stats, richer History
2. **Post-session analysis job** (agent-side, on `end_session`) — LLM
   pass that writes back: session title ("A trip to the market"),
   correction annotations (buyed → bought), word count. The designs'
   "gentle corrections" feature is this job + #1.
3. **Saved phrases** — whole feature has no backend:
   `GET/POST /phrases`, `DELETE /phrases/{id}`; new table
   `phrases (id, user_id, session_id, phrase, note, tag, created_at)`;
   optional `POST /tts` later for iOS "tap to hear it"
4. **User preferences** — onboarding answers (level/topic) currently
   live in localStorage only; the agent can't tune its prompt per
   level until this exists: `GET/PATCH /me/preferences` (level, topic,
   language, daily reminder)
5. **Live captions** — ✅ shipped 2026-07-07 (see entry below). Not
   REST: agent publishes STT/LLM text over the LiveKit data channel;
   web subscribes in-room. iOS still needs its subscriber side.
6. **`DELETE /me`** — account deletion (Clerk + Supabase + Stripe
   cancel). iOS Profile design shows it; required for App Store review.

### 2026-07-07 — Live captions on /talk (caption strip + toggle)

Audit item #5, the design's "Caption strip" variant: a toggleable
two-line strip under the orb — your last line (muted, "You" prefix) and
Echo's current line (display size, olive "Echo" prefix).

**Transport: LiveKit data channel, zero new REST endpoints.** The agent
and browser already share a room; text rides alongside the audio.

**Agent** — `TranscriptLogger` now also pushes
`LiveKitOutputTransportMessageFrame` DataFrames downstream; the output
transport JSON-encodes and publishes them reliably:
`{type: "transcript", role: "user"|"assistant", text, final}`.
- User captions stream in real time (Deepgram interims, `final:false`,
  then the final line)
- Echo's caption publishes when the LLM reply completes — i.e. right as
  TTS starts speaking it
- Same DB writes as before; captions are an extra tap, not a change

**Web (/talk)** — captions button between mic and "End & review"
(accent-tinted when active), `RoomEvent.DataReceived` listener, strip
renders in the space the idle greeting uses. Lines reset per call.
Backward/forward compatible: old web ignores the data messages; new web
with old agent just shows no captions.

**Gating note:** captions are currently available to all plans. The
tier table marks live captions as premium — when we enforce that, gate
publish-side in the agent (it knows the user's plan via the session
row) rather than hiding client-side.

### 2026-07-07 — Scenario roleplay: Home chips now brief the agent

The prompt chips and scenario cards on Home were decorative (static
links to /talk). Now the choice travels the whole dispatch chain and
becomes the call's system prompt:

```
chip "Job interview" → /talk?scenario=… → POST /token {scenario}
  → agent /dispatch {room, user_id, scenario}
  → per-call system prompt: "The learner chose to practice: …
     play the natural other role … a starting point, not a cage."
```

- **Echo now speaks first** on every call (queues one `LLMRunFrame`
  when the user joins) — in-scenario when one was picked ("Welcome to
  the check-in desk!"), plain warm greeting otherwise. Previously the
  agent waited silently for the user to talk.
- /talk shows a "Practicing: …" badge when a scenario is active
- Scenario text capped at 200 chars, sanitized on both API and agent
- No new endpoint — `POST /token` gained an optional JSON body
- Per-call prompts are only possible because dispatch made everything
  per-call; the old shared-room agent had one global prompt
- Also refreshed the base prompt: Echo now knows it's an English
  practice partner ("patient and encouraging"), not a generic companion

Foundation for audit item #4: when `/me/preferences` lands, learner
level rides the same path into the prompt.

### 2026-07-07 — Endpoint audit items #1–#4 + #6 built (transcripts, analysis, phrases, prefs, deletion)

Everything from the audit except iOS wiring, in one pass.

**Migration** (`db/migrations/002_analysis_phrases_preferences.sql` —
run in the Supabase SQL editor BEFORE deploying this code):
- `sessions` + title, preview, word_count, correction_count
- `transcripts` + correction jsonb
- `users` + level, topic
- new `phrases` table (+ index)

**API — 8 new endpoints** (all Clerk-authed, ownership-checked):
- `GET /sessions/latest`, `GET /sessions/{id}`,
  `GET /sessions/{id}/transcript`; `GET /sessions` now returns
  title/preview/word_count/correction_count
- `GET/POST /phrases`, `DELETE /phrases/{id}`
- `GET/PATCH /me/preferences`
- `DELETE /me` — cancels Stripe sub, wipes all Supabase rows, deletes
  the Clerk user (each step best-effort in that order)
- `/token` now reads the stored level and sends it to dispatch
- Compat fix: local API venv is Python 3.9 → `Optional[]` not `X | None`
  in FastAPI/pydantic signatures (prod runs newer, but local must import)

**Agent — post-session analysis job**: after `end_session`, one Groq
call (JSON mode, `llama-3.3-70b-versatile`) produces a 3–6 word title +
up to 5 gentle corrections mapped back to specific transcript rows;
word count and preview computed in Python. Best-effort: a failure just
leaves the session untitled. Also: level-based pacing in the system
prompt (Beginner/Intermediate/Advanced clauses, case-normalized to
match web's lowercase ids).

**Web**:
- New `/history/[id]` transcript page — design's bubble layout, user
  turns in accent bubbles, Echo turns with mini-orb, "Gentle correction"
  callouts with a **Save phrase** button (→ POST /phrases)
- Summary now loads `/sessions/latest`: real duration, title chip,
  words spoken, corrections count, "See transcript" CTA
- History cards show title + preview + corrections count, link to the
  transcript page; search includes titles
- /saved lists real phrases (delete with optimistic rollback, link back
  to the source conversation)
- Onboarding persists level/topic via PATCH /me/preferences (localStorage
  stays as the routing gate)
- Settings: Sign out + **Delete account** (two-tap confirm) in a
  grouped card

**iOS**: `EchoAPI.swift` — full client (Codable models + every endpoint,
snake_case decoding, typed 429/503 errors) behind a `TokenProvider`
protocol. Screens stay on demo data until the Clerk iOS SDK is
configured; then the client plugs in without changes.

**Deploy order matters:** run migration 002 first — the enriched
`GET /sessions` selects the new columns and 500s without them.

### 2026-07-07 — Admin dashboard (/admin + GET /admin/stats)

Decision: custom dashboard over Datadog/Grafana — the user/minutes/plan
data all lives in our own Supabase, and vendor spend is *estimated* from
the rate card (real invoices stay in vendor portals; the page says so).

**API** (`api/admin.py`): one aggregation endpoint, gated by
`ADMIN_USER_IDS` env (comma-separated Clerk ids; non-admins get 404,
not 403). Live agent status proxied from the agent's /health.

**Web** (`/admin`, meadow style, inline SVG charts — no chart lib):
- Live strip: active calls now, agent up/down, refresh button
- Users: total / premium / free / new this week / in trial / talked today
- Usage: sessions + minutes (today, month), avg session, stacked
  14-day bar chart (daily quota olive, trial credit gold), top-5
  talkers with plan badges
- Cost: big month-to-date estimate, per-vendor stacked bar
  (LiveKit/Deepgram/Cartesia/Groq/Railway-prorated), LiveKit free-tier
  gauge with "days until exhausted at current pace"
- Unit economics: MRR (premium × $14.99) and est. margin (red when
  negative — which it will be until the pricing decision)
- Activity feed: last 10 sessions (time, user, title, corrections,
  duration)

**New env var (API service): `ADMIN_USER_IDS`** — your Clerk user id
(Clerk dashboard → Users → copy `user_…`). Optional:
`RAILWAY_MONTHLY_USD` (default 10) for the prorated flat cost.

### 2026-07-07 — BUG: phantom users from Pipecat 1.5 (found via the admin dashboard)

The dashboard's first real catch, minutes after shipping: "Top talkers"
showed ids like `PA_v2ZDjAEwNzLC…` and 19 total users when Clerk has 3.

**Root cause:** the agent attributed sessions to the `participant_id`
from `on_participant_connected`. Under Pipecat 1.4 that was the LiveKit
*identity* (our Clerk user_id); prod's unpinned build pulled **Pipecat
1.5**, which passes the participant **SID** (`PA_…`). Every call since
then: created a phantom user row, billed usage to it (real users' daily
quota never decremented), and hid sessions from their History.

**Fixes:**
1. **Agent**: session ownership now comes from the dispatch payload's
   `user_id` (the API's Clerk-verified id) — the participant event is
   just the trigger. Version-proof against transport changes.
2. **Pinned `agent/requirements.txt`** (pipecat-ai==1.5.0 to match
   prod) — the debt item that caused this, now closed.
3. **Migration 003**: adds `users.email`/`users.name`, deletes all
   `PA_…` phantom rows (users, sessions, transcripts, usage, phrases).
4. **API `ensure_user`** now JIT-enriches new users with email/name
   from Clerk (and self-heals existing rows missing email).
5. **Admin dashboard** shows the human (name/email, full id on hover)
   instead of raw ids in Top talkers + Recent conversations.

Lesson recorded: the June "quota works" verification silently regressed
when prod rebuilt with a newer Pipecat. Pinning + the dashboard are the
two guards against it happening quietly again.

### 2026-07-07 — iOS wired to the real backend (feature parity with web)

The iOS app is no longer a demo shell — every web feature now has its
native counterpart, pending only two config values.

**Dependencies** (SPM via xcodegen): `clerk-ios` 1.2.x (ClerkKit) +
`livekit/client-sdk-swift` 2.15.x. Mic permission + background audio in
Info.plist.

**Auth**: Clerk configured at launch; Auth screen runs real
`signInWithOAuth(.google/.apple)`; `ClerkTokenProvider` feeds the
session JWT to `EchoAPI` (same Bearer flow as web). Splash lands on
Home when signed in, Welcome when not.

**Real voice calls** (`CallController`): mintToken (with scenario) →
LiveKit Room connect → mic publish → wait-for-agent (12s, same as web)
→ live. Speaking/listening orb states from `didUpdateSpeakingParticipants`,
mic mute toggle, elapsed timer, 429 → paywall, 503 → friendly error.
**Live captions** parsed from the agent's data-channel messages — the
Live Transcript screen now shows the real conversation streaming in.

**Data screens on EchoAPI**: Home (real quota, name, scenario chips →
roleplay), History (sessions + search + week stats), Session detail
(transcript + corrections + Save phrase), Saved (list/delete), Summary
(latest session stats + title), Paywall (real Stripe checkout URL via
Safari), Profile (email, plan, sign out, two-tap delete account),
Setup → PATCH /me/preferences. DemoData trimmed to static content.

**Config gate**: `Sources/Config.swift` needs the Clerk publishable key
and API URL (copy from `web/.env.local`); until then the app shows an
"Almost there" instruction screen instead of crashing. Builds clean in
the simulator; on-device sign-in/audio testing pending those keys.

### 2026-07-08 — Exam mode Level 1 (IELTS / TOEFL Speaking chips)

From the new Home design analysis: exam chips as structured scenarios,
no endpoint changes (they ride the existing scenario pipe).

- **Agent**: `EXAM_PROMPTS` keyed by marker — `exam:ielts-speaking`
  runs a 3-part mock (intro questions → cue-card long turn → discussion),
  `exam:toefl-speaking` runs independent + situation tasks with a tip
  after each. Both explicitly do NOT give scores (that's exam Level 2,
  post-pricing). Level pacing still applies underneath.
- **Web**: two EXAM chips on Home (accent-tinted, graduation icon,
  EXAM badge); /talk badge shows "Mock exam: IELTS Speaking" instead of
  the raw marker.
- **iOS**: same chips + badge formatting.

Rest of the Home redesign analysis (free-text situation input, resume
card, /me/stats) parked as next items; resume-with-memory needs
`resume_session_id` through /token → dispatch → agent context.

### 2026-07-08 — Fixes: transcript ordering + patient turn-taking

1. **"Couldn't load this conversation"** — the transcripts table has no
   `created_at` column (original schema); both the transcript endpoint
   and the analysis job ordered by it and crashed. Silent double-bug:
   sessions also stayed untitled because analysis failed on the same
   query. Fix: order by serial `id` (insertion order). Verified against
   prod data (48-turn exam session loads).
2. **Echo interrupting thinking pauses** — Deepgram's default
   endpointing (~10ms silence) finalizes a learner's turn the instant
   they pause to find a word. Raised to `endpointing=800ms` +
   `utterance_end_ms=1500`, tunable via `STT_ENDPOINTING_MS` /
   `STT_UTTERANCE_END_MS` env vars on the agent — tune to taste without
   code changes. Tradeoff: Echo's replies start ~0.8s later; right
   call for a language-learning product.
3. Local agent venv upgraded to Pipecat 1.5.0 to match the pinned prod
   version (was 1.4, the drift that caused the phantom-user bug).

### Technical debt

- **Consolidate Railway services into one project** (2026-07-05): API and
  agent currently live in *separate* Railway projects, so private
  networking (`.railway.internal`) can't connect them. Dispatch runs
  over the agent's public URL (`AGENT_DISPATCH_URL=https://….up.railway.app`),
  protected only by `DISPATCH_SECRET`. Fix: create a new service inside
  the API's project (same repo, root `/agent`), copy env vars, delete
  the standalone agent project, switch `AGENT_DISPATCH_URL` to
  `http://<name>.railway.internal:8080`, and remove the public domain.
- `DAILY_CAP_S`/trial constants duplicated between `api/limits.py` and
  `agent/db.py` (two venvs, no shared package)
- Pipecat 1.4 deprecations: `PipelineTask`/`PipelineRunner` → Worker
  API, Cartesia `voice_id` param (do together as a Pipecat 2.0 pass)
- Missing client endpoints: see the 2026-07-07 endpoint audit above
  (transcript read path, saved phrases, preferences, live captions,
  DELETE /me)
- Pin agent dependency versions (`agent/requirements.txt` is unpinned;
  prod built Pipecat 1.5.0 while local venv has 1.4.0)
- iOS app is UI-only — needs Clerk, /token + dispatch, and LiveKit
  Swift SDK wiring

### Later

- Tune system prompt per learner level, swap voices
- Conversation memory across sessions (premium context continuity)
- Prompt caching, smaller-LLM routing for short turns
- **V1.5 migration**: Cartesia → Deepgram Aura-2 (single-vendor TTS+STT)
- **V2 migration**: self-host TTS on L4 (Kokoro first, CSM-1B if quality demands it)
- **V3 migration**: self-host LiveKit + self-host LLM on H100 (vLLM)
- Specialty tiers (Business English $24.99, Kids tier, IELTS prep)
