# Handoff: Echo — Voice-First English Practice (Web App)

## Overview
Echo is a voice-first web app for practicing spoken English with a patient AI partner. The
emotional center is a single breathing **orb** the user talks to. The product is deliberately
**calm**: no streaks, no mascot, no gamification, no FOMO. This package contains the design
reference for the free + premium MVP surface: marketing landing, SSO sign-in, a 2-question
onboarding, the conversation screen (orb in 3 states), end-of-session summary, the daily-cap
paywall, plus the premium journey (session history, saved transcript with gentle corrections,
and a real-time live-captions conversation).

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that
demonstrates the intended look, motion, and behavior. They are **not production code to copy
directly**. The task is to **recreate these designs in the target codebase's environment**
(e.g. React/Next, Vue, SwiftUI, etc.) using its established components, routing, and state
patterns. If no app environment exists yet, choose the most appropriate framework for the
project and implement the designs there.

`Echo.dc.html` is a single-file prototype built on a small in-house template runtime
(`support.js`). **Do not port the runtime.** Read `Echo.dc.html` for exact markup, inline
styles, and the logic class (screen router, the onboarding selection state, the conversation
state machine, and the word-by-word live-caption streaming engine), then re-implement the same
structure idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and copy are all intended
as shown. Recreate the UI faithfully using the target codebase's libraries. The one thing that
is illustrative rather than final is the **sample conversation content** (the scripted turns and
the three correction examples) — that data comes from the backend / LLM at runtime.

## Brand & Design Tokens

### Color
| Token | Hex | Usage |
|---|---|---|
| `ink` | `#1B1A18` | Primary text; primary buttons; never-red "Done"/end action |
| `paper` | `#F3F1ED` | App background (warm off-white) |
| `surface` | `#FFFFFF` | Cards, list rows, modals, inputs |
| `coral` (accent) | `#DD6B4E` | Warmth & highlights ONLY — active states, labels, orb, corrections. **Never** used for stop/end/destructive. |
| `coral-deep` | `#C5523A` | Orb shading (gradient low end) |
| `coral-light` | `#F7CBB1` | Orb highlight (gradient high end) |
| `coral-wash` | `#FFF6F1` | Selected option fill; correction card fill |
| `coral-border` | `#F4DDD2` | Correction card border |
| `sage` | `#5B8C6E` | RESERVED: the "Echo is speaking" state cue only |
| `text-muted` | `#6B6760` | Secondary text / body |
| `text-soft` | `#8A857C` | Tertiary captions, metadata |
| `text-faint` | `#A8A29A` | Placeholders, idle state label |
| `border` | `#E7E3DD` / `#EDE9E3` | Card & control borders, dividers |
| Google brand dot | linear-gradient `#EA4335 → #FBBC05 45% → #34A853 75% → #4285F4` | SSO button only |

> **Critical brand rule:** coral signals *warmth*, not *alarm*. Destructive/stop actions
> (Done, end session, delete) use neutral `ink`, never coral or red.

### Typography
- **Display / headings:** `Cabinet Grotesk` (weights 700, 800). Tight tracking: `letter-spacing: -0.02em` to `-0.03em` on large headings; `line-height: 1.02–1.1`.
- **UI / body:** `General Sans` (weights 400, 500, 600, 700).
- Loaded via Fontshare in the prototype. In production use the licensed webfonts or your design
  system's nearest geometric-grotesk + humanist-sans pairing.
- Scale (clamped, responsive): hero `clamp(40px,7vw,76px)`; screen title `clamp(28px,5vw,38px)`;
  section heading 26px; body 16–17px; label/eyebrow 11–13px uppercase `letter-spacing:.05–.06em`.

### Spacing, radius, shadow
- Radius: pills/buttons `999px`; cards `18–24px`; inputs/options `16–18px`; correction box `14px`.
- Primary button shadow: `0 12px 28px -12px rgba(27,26,24,.5)`.
- Card shadow (premium continue card): `0 18px 40px -20px rgba(27,26,24,.55)`.
- Orb shadow: `0 28px 64px -20px rgba(197,82,58,.6)` + inset highlights (see file).
- Standard control height: buttons 54–56px; circular icon buttons 42–54px.

### Motion personality — "breathing, not blinking"
All CSS transforms/opacity; no layout thrash. Keyframes (see `<helmet>` in the file):
- `breathe` — 5s ease-in-out orb scale 0.97↔1.04 (idle presence).
- `breatheSlow` — 6s glow halo scale+opacity.
- `ringBreathe` / `coreBeat` — concentric-ring orb variant.
- `wave` — 2.4s expanding ring, staggered ×3 (Echo speaking).
- `spinSlow` — 4s conic shimmer ring (listening).
- `dotPulse` — 1.6s status-dot pulse.
- `blink` — 1s steps caret for the live-caption typing cursor.
- `fadeUp` — 0.3s entrance for revealed elements.

## Screens / Views
Screenshots are in `screens/`, numbered in this order:

1. **01 — Landing** (`screens/01-echo.png`)
   - Purpose: marketing entry; communicate calm + "somewhere to speak".
   - Layout: max-width 1180px, two-column on desktop (copy left, orb right), single column on mobile. Header (logo + Sign in), centered hero, footer.
   - Components: animated logo orb 24px; eyebrow "VOICE-FIRST PRACTICE" (coral); H1 "Finally, somewhere to speak." (Cabinet Grotesk 700); body; primary pill "Start talking" (ink) → sign-in; muted row "No appointment · No judgment · Available at 2am". Large hero orb (glossy radial-gradient sphere, breathing).
   - Copy: H1 `Finally, somewhere to speak.` / sub `Practice speaking English with a patient AI partner. Free, five minutes a day.` *(NOTE: update to "three minutes a day" per current pricing — see Planned Changes.)*

2. **02 — Sign in** (`screens/02-echo.png`)
   - Purpose: SSO only, no forms. Centered, max-width 400px.
   - Components: 64px orb; H1 `Let's get you talking.`; body; two 56px white SSO buttons `Continue with Google` / `Continue with Apple` (1.5px border `#E7E3DD`, hover border `ink`); text button `Not now`.

3. **03 — Onboarding (2 questions)** (`screens/03-echo.png`)
   - Purpose: capture level + goal; minimal. Back chip + 2-dot progress.
   - Q1 eyebrow `Question 1 of 2`, H2 `What's your current level?`, options: `Beginner / Intermediate / Advanced / Not sure`. Selecting advances to Q2.
   - Q2 H2 `What would you like to practice?`, options: `Daily conversation / Work & professional / Travel / Just to chat`. On pick, reveal pill `Start talking` (fadeUp) → conversation.
   - Option component: full-width row, 1.5px border (selected → coral border + `#FFF6F1` fill), 22px radio circle with check when selected.

4. **04 — Conversation · idle** (`screens/04-echo.png`)
   - Purpose: the core talk surface. Centered orb on paper.
   - Top-left: time-remaining indicator (clock icon + label). Top-right: transcript toggle icon button (premium).
   - Center: tappable orb. Below: status dot + label. Bottom: circular secondary button + ink `Done` pill (ends → summary).
   - Idle status: `Tap the orb to begin` (faint). *(The prototype also has a "Preview" control strip at the bottom to demo states/orb variants — this is a prototype-only affordance, NOT part of the product UI. Omit in production.)*

5. **05 — Conversation · listening (user speaking)** (`screens/05-echo.png`)
   - Orb gains a slow rotating coral shimmer ring. Status: dot + `Listening…` in coral.

6. **06 — Conversation · speaking (Echo speaking)** (`screens/06-echo.png`)
   - Orb emits staggered expanding `wave` rings. Status: `Echo is speaking` in **sage** `#5B8C6E` (the only sage usage).

7. **07 — Post-session summary** (`screens/07-echo.png`)
   - Purpose: gentle close. Centered, max-width 460px. 56px orb; H1 `Nice work.`; sub `You spoke for 6 minutes today.`; two stat cards (`320 words spoken`, `4 new phrases` — number in coral); primary pill `Practice again tomorrow` → landing; text button `View transcript & corrections` (lock icon) → paywall for free users.

8. **08 — Daily-cap paywall** (`screens/08-echo.png`)
   - Purpose: honest offer when the daily allotment is spent. Eyebrow `You've used today's 5 minutes` *(→ "3 minutes", see Planned Changes)*; H1 `That's five minutes well spent.`; body; **Echo Premium** card — `$14.99/mo · or $119/yr`, four coral-check benefits (30 min/day, full history, transcripts with gentle corrections, more voices *(drop "more voices" per MVP — single voice only)*). Buttons: ink `Unlock more time` and text `I'll come back tomorrow`. No urgency timer, no dark patterns.

9. **09 — History (premium home)** (`screens/09-echo.png`)
   - Purpose: returning-premium landing. max-width 660px. Header: avatar `G` + name + coral `Premium` badge + manage-plan icon button.
   - Big ink "continue" card: orb + `Talk to Echo` + `28 minutes left today · live captions on` → live conversation.
   - Three calm stat cards (`5 this week`, `47 minutes`, `26 new phrases`). NO streaks.
   - `Your conversations` list: each row = title + 1-line preview (truncated) + date + duration + chevron → session detail.

10. **10 — Session detail / transcript + corrections** (`screens/10-echo.png`)
    - Purpose: saved transcript reading view with gentle corrections. Back chip + title `A trip to the market` + `Today · 6 min`; meta row (`320 words`, `6 min spoken`, coral `3 gentle corrections`).
    - Turn list: uppercase speaker label (Echo = coral, You = soft), then text. When a turn has a correction, a soft **coral-wash box** (`#FFF6F1`, border `#F4DDD2`, radius 14px) shows label `Gentle correction`, original struck-through in muted, arrow `→`, suggested phrasing in ink 500. **Never red error styling.**

11. **11 — Live captions (premium, real-time)** (`screens/11-echo.png`)
    - Purpose: optional live transcript during a call. Top-left time `28:14 left today`; top-right pill `● Live captions`.
    - Smaller orb up top (same state animations). Scrolling turn log (completed turns) auto-scrolls to bottom. The **in-progress turn** renders in a white card: speaker dot+label + text that **streams in word-by-word** with a blinking coral caret. User turns stream slower than Echo's. Bottom: pause/resume circular button (▮▮ / ▶ / ↻ when finished) + ink `Done`.

## Interactions & Behavior
- **Routing:** single-page screen router keyed by a `screen` string (`landing | auth | setup | conversation | summary | paywall | history | session | live`). Scroll resets to top on navigation. (The fixed bottom-left ⋯ "Jump to screen" menu is a **prototype navigator only** — remove in production.)
- **Onboarding:** picking a level sets state and auto-advances to Q2; picking a goal reveals the Start button.
- **Conversation state machine:** `idle → listening → speaking → idle`; tapping the orb cycles it in the prototype. In production this is driven by mic VAD + TTS playback. Each state maps to the orb animation + status label/color above.
- **Transcript toggle (premium):** shows/hides a transcript panel. **For FREE users this button must instead open the soft-upsell modal** (see Planned Changes — not yet built).
- **Live-caption streaming engine:** see logic class `startLive/tickWord` — iterate a script of turns; reveal one word at a time (~115ms Echo, ~195ms user) with a typing caret; on turn end, commit the full line to the scroll log and pause briefly before the next. Pause/resume halts the timer; on finish, the control becomes a replay (↻). Re-implement against real streaming STT/LLM/TTS events rather than a fixed script.
- **Hover states:** white buttons darken border to `ink`; primary pills lift `translateY(-2px)` or `opacity:.9`; list rows darken border.

## State Management
- `screen` — current route.
- `setupStep` (0/1), `level`, `topic` — onboarding selections.
- `convo` — `idle | listening | speaking`; drives orb + status.
- `transcript` — transcript panel visibility (premium); gate behind tier.
- Live: `turns[]` (committed), `liveIdx`, `liveCount` (words revealed), `liveSpeaker`, `running`, `finished`.
- **Tier** (not yet modeled in the prototype — add): `trial | free | premium`, plus `secondsRemainingToday` / `trialSecondsRemaining`, used to pick the time-indicator copy/tone and to gate premium features and the two distinct paywalls.
- Data fetching (production): session history list, a single session transcript + its corrections array, subscription status, and the live STT/LLM/TTS stream.

## Empty / Loading / Error States
- **History empty:** before any session, replace the list with a calm one-liner inviting the first conversation (design TBD — keep it warm, no illustration needed).
- **Transcript loading:** corrections come from a post-session LLM pass — show the transcript immediately and lazy-fill correction boxes (skeleton in coral-wash) when ready.
- **Mic / permission error:** if a session ends under 30s due to mic failure, silently do not deduct time (see Planned Changes — invisible retry). Surface a quiet inline "We couldn't hear you — check your mic" if permission is denied.
- **Network error during live call:** pause the orb, show a quiet reconnecting pill; never a red banner.

## Responsive Behavior
- Mobile-first; everything is centered with max-widths (400–660px) so it reads as a focused column on desktop. Landing is the only true two-column layout (collapses to one under ~760px). Type uses `clamp()` so headings scale fluidly. Touch targets ≥ 44px.

## Planned changes (from the latest scope brief — NOT yet in these files)
The current files reflect the prior build. The product owner has since tightened scope; implement
toward this target (ask them for the finalized screens if not yet provided):
- **Pricing:** Trial = **15 min across first 7 days** (no card). Free = **3 min/day** (not 5),
  with a **silent** invisible "retry" (sessions ending <30s simply don't deduct time — no button).
  Premium unchanged ($14.99/mo, $119/yr, 30 min/day).
- **Conversation time indicator — 3 tonal variants:** trial `12 min trial left` (informational) /
  free `2:31 left today` (neutral) / premium `24 min left today` (near-invisible).
- **Free-user transcript toggle → soft-upsell modal:** `See what you and Echo are saying — Premium only`, two **equal** buttons `Maybe later` / `See plans`.
- **Two distinct, equal-weight paywalls (no dark patterns):**
  - Trial→free: H `That was your free trial.` body explains 3 min/day vs upgrade; buttons `Keep using free` / `Unlock more`.
  - Daily-cap: H `You're all in for today.` body `Echo will be here tomorrow at midnight — or unlock more right now.`; buttons `See you tomorrow` / `Unlock more`.
- **Post-session summary — 2 tier variants:** free → single CTA `Practice tomorrow` + dismissable soft row upselling suggestions; premium → primary `Review transcript & 3 suggestions` + secondary `Done`.
- **Settings screen:** account, subscription status, language pair (only "English" selectable, UI ready for more), sign out, delete account.
- **Stripe checkout:** one plan, two cadences (monthly / annual w/ discount badge); avoid 3-column comparison-table tropes; match the calm brand.
- **Explicitly NOT in MVP:** multiple voices, cross-session memory, vocab dashboards, transcript export, specialty modes, mid-session pause, notifications, native app, multi-language UI. (So: drop "more voices" from the paywall benefit list; single default voice only.)

## Files
- `Echo.dc.html` — the full prototype (markup + inline styles + logic class). Primary reference.
- `support.js` — prototype runtime only. **Do not port.**
- `screens/01..11-echo.png` — screenshots, in the order documented above.
