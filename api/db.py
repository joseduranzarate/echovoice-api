from __future__ import annotations

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


_SESSION_FIELDS = (
    "id, room_name, started_at, ended_at, duration_s, "
    "title, preview, word_count, correction_count"
)


def _session_dict(r: dict) -> dict:
    return {
        "id": r["id"],
        "room_name": r["room_name"],
        "started_at": r["started_at"],
        "ended_at": r["ended_at"],
        "duration_s": r["duration_s"] or 0,
        "title": r.get("title"),
        "preview": r.get("preview"),
        "word_count": r.get("word_count"),
        "correction_count": r.get("correction_count"),
    }


def list_sessions(user_id: str, limit: int = 50) -> list[dict]:
    """Return the user's most recent sessions, newest first."""
    res = (
        _client()
        .table("sessions")
        .select(_SESSION_FIELDS)
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        _session_dict(r)
        for r in (res.data or [])
        # Hide cancelled/never-started rows so they don't litter the UI.
        if (r["duration_s"] or 0) > 0
    ]


def get_session(user_id: str, session_id: str) -> dict | None:
    """One session, ownership-checked (returns None for other users' rows)."""
    res = (
        _client()
        .table("sessions")
        .select(_SESSION_FIELDS)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _session_dict(res.data[0]) if res.data else None


def latest_session(user_id: str) -> dict | None:
    """Most recent finished session (for the post-call summary screen)."""
    res = (
        _client()
        .table("sessions")
        .select(_SESSION_FIELDS)
        .eq("user_id", user_id)
        .not_.is_("ended_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    return _session_dict(res.data[0]) if res.data else None


def get_transcript(user_id: str, session_id: str) -> list[dict] | None:
    """Ordered turns for one session; None if the session isn't the user's."""
    if get_session(user_id, session_id) is None:
        return None
    res = (
        _client()
        .table("transcripts")
        .select("id, role, text, correction, created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .order("id")
        .execute()
    )
    return [
        {"id": r["id"], "role": r["role"], "text": r["text"], "correction": r.get("correction")}
        for r in (res.data or [])
    ]


# ── Saved phrases ───────────────────────────────────────────────────────────

def list_phrases(user_id: str, limit: int = 200) -> list[dict]:
    res = (
        _client()
        .table("phrases")
        .select("id, session_id, phrase, note, tag, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def create_phrase(
    user_id: str,
    phrase: str,
    note: str | None,
    tag: str | None,
    session_id: str | None,
) -> dict:
    res = (
        _client()
        .table("phrases")
        .insert(
            {
                "user_id": user_id,
                "phrase": phrase,
                "note": note,
                "tag": tag,
                "session_id": session_id,
            }
        )
        .execute()
    )
    return res.data[0]


def delete_phrase(user_id: str, phrase_id: str) -> bool:
    res = (
        _client()
        .table("phrases")
        .delete()
        .eq("id", phrase_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


# ── Preferences ─────────────────────────────────────────────────────────────

def get_preferences(user_id: str) -> dict:
    res = (
        _client()
        .table("users")
        .select("level, topic")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return {"level": res.data.get("level"), "topic": res.data.get("topic")}


def update_preferences(user_id: str, level: str | None, topic: str | None) -> dict:
    patch = {}
    if level is not None:
        patch["level"] = level
    if topic is not None:
        patch["topic"] = topic
    if patch:
        _client().table("users").update(patch).eq("id", user_id).execute()
    return get_preferences(user_id)


# ── Account deletion ────────────────────────────────────────────────────────

def delete_user_data(user_id: str) -> None:
    """Remove every Supabase row for this user. Order matters for FKs."""
    c = _client()
    session_ids = [
        r["id"]
        for r in (
            c.table("sessions").select("id").eq("user_id", user_id).execute().data or []
        )
    ]
    if session_ids:
        c.table("transcripts").delete().in_("session_id", session_ids).execute()
    c.table("phrases").delete().eq("user_id", user_id).execute()
    c.table("usage_minutes").delete().eq("user_id", user_id).execute()
    c.table("subscriptions").delete().eq("user_id", user_id).execute()
    c.table("sessions").delete().eq("user_id", user_id).execute()
    c.table("users").delete().eq("id", user_id).execute()
