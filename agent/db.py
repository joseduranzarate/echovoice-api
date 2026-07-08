import os
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

from supabase import Client, create_client

# Kept in sync with api/limits.py — duplicated to avoid coupling the two
# venvs through a shared package. If these constants ever diverge, the API
# will under/over-gate. Worth a shared module later.
DAILY_CAP_S = {"free": 3 * 60, "premium": 30 * 60}
TRIAL_TOTAL_S = 15 * 60
TRIAL_WINDOW_DAYS = 7
MIN_BILLABLE_SECONDS = 30  # sessions shorter than this don't count (retry rule)


@lru_cache(maxsize=1)
def _client() -> Client:
    # Service-role key bypasses RLS — never expose this client to a browser.
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def ensure_user(user_id: str) -> None:
    """FK safety: agent may see a user-id we've never written before."""
    _client().table("users").upsert(
        {"id": user_id},
        on_conflict="id",
    ).execute()


def create_session(user_id: str, room_name: str) -> str:
    """Returns the new session's uuid."""
    res = (
        _client()
        .table("sessions")
        .insert({"user_id": user_id, "room_name": room_name})
        .execute()
    )
    return res.data[0]["id"]


def append_transcript(session_id: str, role: str, text: str) -> None:
    _client().table("transcripts").insert(
        {"session_id": session_id, "role": role, "text": text}
    ).execute()


def get_transcript_rows(session_id: str) -> list[dict]:
    """Ordered turns for the post-session analysis job."""
    # Ordered by id — the table has no created_at column.
    res = (
        _client()
        .table("transcripts")
        .select("id, role, text")
        .eq("session_id", session_id)
        .order("id")
        .execute()
    )
    return res.data or []


def save_analysis(
    session_id: str,
    title: str | None,
    preview: str | None,
    word_count: int,
    correction_count: int,
) -> None:
    _client().table("sessions").update(
        {
            "title": title,
            "preview": preview,
            "word_count": word_count,
            "correction_count": correction_count,
        }
    ).eq("id", session_id).execute()


def set_correction(transcript_id, correction: dict) -> None:
    _client().table("transcripts").update({"correction": correction}).eq(
        "id", transcript_id
    ).execute()


def end_session(session_id: str, user_id: str, duration_s: int) -> None:
    """Close the session row and roll usage forward — applies the retry rule
    and splits overflow into trial credit when eligible."""
    c = _client()
    c.table("sessions").update(
        {
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_s": duration_s,
        }
    ).eq("id", session_id).execute()

    # Retry rule: ultra-short sessions (mic test, accidental tap) don't count.
    if duration_s < MIN_BILLABLE_SECONDS:
        return

    # Get plan + signup date to decide where the seconds go.
    user = c.table("users").select("plan, created_at").eq("id", user_id).single().execute().data
    plan = user["plan"]
    created_at = datetime.fromisoformat(user["created_at"])
    daily_cap = DAILY_CAP_S[plan]
    trial_eligible = datetime.now(timezone.utc) - created_at <= timedelta(days=TRIAL_WINDOW_DAYS)

    # Read today's row + lifetime trial use in one pass.
    today = date.today().isoformat()
    all_rows = (
        c.table("usage_minutes")
        .select("date, seconds_used, trial_credit_used_s")
        .eq("user_id", user_id)
        .execute()
    ).data
    today_row = next((r for r in all_rows if r["date"] == today), None)
    today_used = today_row["seconds_used"] if today_row else 0
    today_trial = today_row["trial_credit_used_s"] if today_row else 0
    lifetime_trial = sum(r["trial_credit_used_s"] for r in all_rows)

    # Allocation: daily quota first; overflow → trial credit (if eligible).
    daily_room = max(0, daily_cap - today_used)
    bill_daily = min(duration_s, daily_room)
    overflow = duration_s - bill_daily

    bill_trial = 0
    if overflow > 0 and trial_eligible:
        trial_room = max(0, TRIAL_TOTAL_S - lifetime_trial)
        bill_trial = min(overflow, trial_room)
    # Anything past daily + trial is unbilled — that's the agent's own grace
    # for the race between "/token gated you" and "session ended over cap".

    c.table("usage_minutes").upsert(
        {
            "user_id": user_id,
            "date": today,
            "seconds_used": today_used + bill_daily,
            "trial_credit_used_s": today_trial + bill_trial,
        },
        on_conflict="user_id,date",
    ).execute()
