import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from livekit import api

from auth import require_clerk_user
from billing import create_checkout_session, create_portal_session
from db import list_sessions
from limits import quota_for, seconds_until_daily_reset
from webhooks import handle_stripe_webhook

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]

# Single shared room — must match the agent's ROOM_NAME. MVP only supports
# one concurrent conversation globally. Replace with per-call rooms once
# the agent switches to LiveKit Agent Worker SDK dispatch (Chunk 19).
DEFAULT_ROOM = os.environ.get("DEFAULT_ROOM", "speech-room")

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


@app.post("/token")
def mint_token(
    user_id: str = Depends(require_clerk_user),
    room: Optional[str] = None,
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

    room_name = room or DEFAULT_ROOM

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
