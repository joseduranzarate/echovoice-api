import os
from functools import lru_cache

from supabase import Client, create_client


@lru_cache(maxsize=1)
def _client() -> Client:
    # Built on first use so the API can boot before SUPABASE_* are configured.
    # Service-role key bypasses RLS — never expose this client to a browser.
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def ensure_user(user_id: str) -> None:
    """JIT-create the user row on first authenticated request. Idempotent."""
    _client().table("users").upsert(
        {"id": user_id},
        on_conflict="id",
    ).execute()


def list_sessions(user_id: str, limit: int = 50) -> list[dict]:
    """Return the user's most recent sessions, newest first."""
    res = (
        _client()
        .table("sessions")
        .select("id, room_name, started_at, ended_at, duration_s")
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        {
            "id": r["id"],
            "room_name": r["room_name"],
            "started_at": r["started_at"],
            "ended_at": r["ended_at"],
            "duration_s": r["duration_s"] or 0,
        }
        for r in (res.data or [])
        # Hide cancelled/never-started rows so they don't litter the UI.
        if (r["duration_s"] or 0) > 0
    ]
