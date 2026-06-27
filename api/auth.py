import os

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from fastapi import HTTPException, Request

from db import ensure_user

CLERK_SECRET_KEY = os.environ["CLERK_SECRET_KEY"]
CLERK_AUTHORIZED_PARTIES = [
    p.strip()
    for p in os.environ.get("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000").split(",")
    if p.strip()
]


def require_clerk_user(request: Request) -> str:
    """Verify the Clerk session JWT, JIT-upsert the user, return the Clerk user_id."""
    state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=CLERK_SECRET_KEY,
            authorized_parties=CLERK_AUTHORIZED_PARTIES,
        ),
    )

    if not state.is_signed_in or state.payload is None:
        raise HTTPException(status_code=401, detail=state.message or "unauthenticated")

    user_id = state.payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing sub claim")

    ensure_user(user_id)
    return user_id
