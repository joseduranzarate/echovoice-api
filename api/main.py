import os
import uuid
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from livekit import api
from pydantic import BaseModel

from auth import require_clerk_user
from billing import (
    cancel_active_subscriptions,
    create_checkout_session,
    create_portal_session,
)
from db import (
    create_phrase,
    delete_phrase,
    delete_user_data,
    get_preferences,
    get_session,
    get_transcript,
    latest_session,
    list_phrases,
    list_sessions,
    update_preferences,
)
from limits import quota_for, seconds_until_daily_reset
from webhooks import handle_stripe_webhook

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]

# On-demand agent dispatch. The agent service exposes POST /dispatch on
# Railway's private network; the API pokes it with a fresh per-call room
# right after minting the user's token. Rooms are single-use, so multiple
# concurrent conversations are supported and the agent burns zero LiveKit
# minutes while idle.
AGENT_DISPATCH_URL = os.environ["AGENT_DISPATCH_URL"]
DISPATCH_SECRET = os.environ["DISPATCH_SECRET"]

app = FastAPI(title="speech_project api")

# CORS allow-list. Comma-separated env var; falls back to the two local
# dev ports. In prod, add the Vercel URL via Railway's env panel.
_allowed = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


class TokenBody(BaseModel):
    # Optional roleplay scenario the user picked on Home; injected into the
    # agent's system prompt for this call only.
    scenario: Optional[str] = None
    # Optional session to continue — the API forwards the tail of that
    # transcript so Echo remembers the previous conversation.
    resume_session_id: Optional[str] = None


@app.post("/token")
def mint_token(
    body: Optional[TokenBody] = None,
    user_id: str = Depends(require_clerk_user),
):
    # Block here if today's quota + (eligible) trial credit are both spent.
    quota = quota_for(user_id)
    if quota.total_remaining_s <= 0:
        retry_after = seconds_until_daily_reset()
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "error": "quota_exhausted",
                "plan": quota.plan,
                "daily_cap_s": quota.daily_cap_s,
                "daily_remaining_s": quota.daily_remaining_s,
                "trial_remaining_s": quota.trial_remaining_s if quota.trial_eligible else 0,
                "retry_after_s": retry_after,
            },
        )

    # Fresh single-use room per call — server-chosen so clients can't collide.
    room_name = f"echo-{uuid.uuid4().hex[:12]}"

    scenario = (body.scenario or "").strip()[:200] if body else ""

    # Resume memory: ownership-checked; last 12 turns keep the dispatch
    # payload (and the agent's LLM context) small.
    resume = None
    if body and body.resume_session_id:
        prev = get_session(user_id, body.resume_session_id.strip())
        if prev:
            turns = get_transcript(user_id, prev["id"]) or []
            if turns:
                resume = {
                    "title": prev.get("title"),
                    "turns": [
                        {"role": t["role"], "text": t["text"][:400]}
                        for t in turns[-12:]
                    ],
                }

    # Learner profile (from onboarding preferences) rides along so the agent
    # can pace and frame the conversation.
    try:
        prefs = get_preferences(user_id)
    except Exception:
        prefs = {}
    level = prefs.get("level")
    institute = prefs.get("institute")
    cycle = prefs.get("cycle")

    # Wake the agent for this room BEFORE handing the token back, so it's
    # usually already in the room when the browser connects.
    try:
        r = httpx.post(
            f"{AGENT_DISPATCH_URL}/dispatch",
            json={
                "room": room_name,
                "user_id": user_id,
                "scenario": scenario or None,
                "level": level,
                "institute": institute,
                "cycle": cycle,
                "resume": resume,
            },
            headers={"X-Dispatch-Secret": DISPATCH_SECRET},
            timeout=5.0,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        return JSONResponse(
            status_code=503,
            content={"error": "agent_unavailable", "detail": str(e)},
        )

    # LiveKit identity is the Clerk user_id so the agent can attribute the
    # session to a real account downstream.
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(user_id)
        .with_name(user_id)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    return {
        "token": token,
        "url": LIVEKIT_URL,
        "room": room_name,
        "identity": user_id,
        "quota": {
            "plan": quota.plan,
            "daily_remaining_s": quota.daily_remaining_s,
            "trial_remaining_s": quota.trial_remaining_s if quota.trial_eligible else 0,
        },
    }


@app.get("/quota")
def get_quota(user_id: str = Depends(require_clerk_user)):
    quota = quota_for(user_id)
    return {
        "plan": quota.plan,
        "daily_remaining_s": quota.daily_remaining_s,
        "trial_remaining_s": quota.trial_remaining_s if quota.trial_eligible else 0,
    }


@app.get("/sessions")
def get_sessions(user_id: str = Depends(require_clerk_user)):
    return {"sessions": list_sessions(user_id)}


@app.get("/sessions/latest")
def get_latest_session(user_id: str = Depends(require_clerk_user)):
    session = latest_session(user_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "no_sessions"})
    return session


@app.get("/sessions/{session_id}")
def get_one_session(session_id: str, user_id: str = Depends(require_clerk_user)):
    session = get_session(user_id, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return session


@app.get("/sessions/{session_id}/transcript")
def get_session_transcript(
    session_id: str, user_id: str = Depends(require_clerk_user)
):
    turns = get_transcript(user_id, session_id)
    if turns is None:
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return {"turns": turns}


# ── Saved phrases ───────────────────────────────────────────────────────────


class PhraseBody(BaseModel):
    phrase: str
    note: Optional[str] = None
    tag: Optional[str] = None
    session_id: Optional[str] = None


@app.get("/phrases")
def get_phrases(user_id: str = Depends(require_clerk_user)):
    return {"phrases": list_phrases(user_id)}


@app.post("/phrases")
def post_phrase(body: PhraseBody, user_id: str = Depends(require_clerk_user)):
    phrase = body.phrase.strip()[:300]
    if not phrase:
        return JSONResponse(status_code=400, content={"error": "empty_phrase"})
    row = create_phrase(
        user_id,
        phrase,
        (body.note or "").strip()[:300] or None,
        (body.tag or "").strip()[:40] or None,
        body.session_id,
    )
    return row


@app.delete("/phrases/{phrase_id}")
def remove_phrase(phrase_id: str, user_id: str = Depends(require_clerk_user)):
    if not delete_phrase(user_id, phrase_id):
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return {"deleted": phrase_id}


# ── Preferences ─────────────────────────────────────────────────────────────


class PreferencesBody(BaseModel):
    level: Optional[str] = None
    topic: Optional[str] = None
    # Academy alignment: 'britanico' | 'icpna' | 'self', plus the cycle the
    # student is currently in (e.g. 'basico-7').
    institute: Optional[str] = None
    cycle: Optional[str] = None


@app.get("/me/preferences")
def read_preferences(user_id: str = Depends(require_clerk_user)):
    return get_preferences(user_id)


@app.patch("/me/preferences")
def patch_preferences(
    body: PreferencesBody, user_id: str = Depends(require_clerk_user)
):
    level = (body.level or "").strip()[:40] or None if body.level is not None else None
    topic = (body.topic or "").strip()[:80] or None if body.topic is not None else None
    institute = None
    if body.institute is not None:
        v = body.institute.strip().lower()
        if v not in ("britanico", "icpna", "self"):
            return JSONResponse(status_code=400, content={"error": "bad_institute"})
        institute = v
    cycle = (body.cycle or "").strip().lower()[:40] or None if body.cycle is not None else None
    return update_preferences(user_id, level, topic, institute, cycle)


# ── Account deletion ────────────────────────────────────────────────────────


@app.delete("/me")
def delete_account(user_id: str = Depends(require_clerk_user)):
    """Full account deletion: Stripe subscription, Supabase rows, Clerk user."""
    # 1. Cancel any active Stripe subscription (best-effort).
    try:
        cancel_active_subscriptions(user_id)
    except Exception:
        pass  # no Stripe config in dev, or no subscription — fine

    # 2. Remove all Supabase data.
    delete_user_data(user_id)

    # 3. Delete the Clerk user so they can't sign back into a ghost account.
    try:
        from clerk_backend_api import Clerk

        with Clerk(bearer_auth=os.environ["CLERK_SECRET_KEY"]) as clerk:
            clerk.users.delete(user_id=user_id)
    except Exception:
        # Data is already gone; a stale Clerk user just re-onboards fresh.
        pass

    return {"deleted": user_id}


@app.post("/billing/checkout")
def billing_checkout(user_id: str = Depends(require_clerk_user)):
    url = create_checkout_session(user_id)
    return {"url": url}


@app.post("/billing/portal")
def billing_portal(user_id: str = Depends(require_clerk_user)):
    url = create_portal_session(user_id)
    return {"url": url}


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    return await handle_stripe_webhook(request)


# ── Admin ───────────────────────────────────────────────────────────────────

# Comma-separated Clerk user ids allowed to read /admin/stats.
ADMIN_USER_IDS = {
    u.strip()
    for u in os.environ.get("ADMIN_USER_IDS", "").split(",")
    if u.strip()
}


@app.get("/admin/stats")
def get_admin_stats(user_id: str = Depends(require_clerk_user)):
    if user_id not in ADMIN_USER_IDS:
        # 404, not 403 — don't advertise the endpoint's existence.
        return JSONResponse(status_code=404, content={"error": "not_found"})
    from admin import admin_stats

    return admin_stats()
