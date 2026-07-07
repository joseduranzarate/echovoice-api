"""Admin dashboard aggregations. One endpoint, everything the /admin page
shows. Numbers are computed from our own Supabase tables; costs are
ESTIMATES from the per-vendor rate card — real invoices live in each
vendor's portal."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import httpx

from db import _client

# Per conversation-minute rate card (2026-06 research, see CHANGELOG).
# LiveKit meters per PARTICIPANT-minute; a call has 2 participants.
RATES = {
    "livekit": 0.005 * 2,
    "deepgram": 0.0043,
    "groq": 0.003,
    "cartesia": 0.006,
}
RAILWAY_MONTHLY_USD = float(os.environ.get("RAILWAY_MONTHLY_USD", "10"))
LIVEKIT_FREE_PARTICIPANT_MIN = 5000

PREMIUM_PRICE_USD = 14.99

AGENT_DISPATCH_URL = os.environ.get("AGENT_DISPATCH_URL", "")


def _agent_health() -> dict:
    try:
        r = httpx.get(f"{AGENT_DISPATCH_URL}/health", timeout=3.0)
        r.raise_for_status()
        data = r.json()
        return {"up": True, "active_rooms": data.get("active_rooms", 0)}
    except Exception:
        return {"up": False, "active_rooms": 0}


def admin_stats() -> dict:
    c = _client()
    now = datetime.now(timezone.utc)
    today = date.today()
    month_start = today.replace(day=1)
    week_ago = now - timedelta(days=7)
    days_14 = today - timedelta(days=13)

    # ── Users ────────────────────────────────────────────────────────────
    users = (
        c.table("users")
        .select("id, plan, created_at, level, email, name")
        .execute()
        .data
        or []
    )
    who = {
        u["id"]: (u.get("name") or u.get("email") or u["id"][:14] + "…")
        for u in users
    }
    total_users = len(users)
    premium_users = sum(1 for u in users if u["plan"] == "premium")
    new_this_week = sum(
        1 for u in users if datetime.fromisoformat(u["created_at"]) >= week_ago
    )
    in_trial = sum(
        1
        for u in users
        if now - datetime.fromisoformat(u["created_at"]) <= timedelta(days=7)
    )

    # ── Sessions this month ──────────────────────────────────────────────
    sessions = (
        c.table("sessions")
        .select("user_id, duration_s, started_at, title, correction_count")
        .gte("started_at", month_start.isoformat())
        .execute()
        .data
        or []
    )
    sessions = [s for s in sessions if (s["duration_s"] or 0) > 0]

    def _day(s):
        return datetime.fromisoformat(s["started_at"]).date()

    month_seconds = sum(s["duration_s"] for s in sessions)
    today_sessions = [s for s in sessions if _day(s) == today]
    today_seconds = sum(s["duration_s"] for s in today_sessions)
    active_today = len({s["user_id"] for s in today_sessions})
    active_month = len({s["user_id"] for s in sessions})
    avg_session_s = month_seconds // len(sessions) if sessions else 0

    # Top talkers this month
    by_user: dict[str, int] = defaultdict(int)
    for s in sessions:
        by_user[s["user_id"]] += s["duration_s"]
    top_users = sorted(by_user.items(), key=lambda kv: -kv[1])[:5]
    plan_of = {u["id"]: u["plan"] for u in users}

    # ── Daily bars (last 14 days) from usage_minutes ─────────────────────
    usage_rows = (
        c.table("usage_minutes")
        .select("date, seconds_used, trial_credit_used_s")
        .gte("date", days_14.isoformat())
        .execute()
        .data
        or []
    )
    per_day: dict[str, dict] = defaultdict(lambda: {"daily_s": 0, "trial_s": 0})
    for r in usage_rows:
        per_day[r["date"]]["daily_s"] += r["seconds_used"] or 0
        per_day[r["date"]]["trial_s"] += r["trial_credit_used_s"] or 0
    days = []
    for i in range(14):
        d = (days_14 + timedelta(days=i)).isoformat()
        days.append(
            {
                "date": d,
                "daily_s": per_day[d]["daily_s"],
                "trial_s": per_day[d]["trial_s"],
            }
        )

    # ── Estimated cost (month-to-date) ───────────────────────────────────
    month_minutes = month_seconds / 60
    day_of_month = today.day
    days_in_month = (month_start.replace(month=month_start.month % 12 + 1, day=1) - timedelta(days=1)).day
    vendors = {k: round(month_minutes * rate, 2) for k, rate in RATES.items()}
    vendors["railway"] = round(RAILWAY_MONTHLY_USD * day_of_month / days_in_month, 2)
    est_cost = round(sum(vendors.values()), 2)

    # LiveKit free-tier gauge
    participant_min_used = month_minutes * 2
    pace_per_day = participant_min_used / max(1, day_of_month)
    remaining = max(0, LIVEKIT_FREE_PARTICIPANT_MIN - participant_min_used)
    days_left = round(remaining / pace_per_day) if pace_per_day > 0 else None

    # ── Unit economics ───────────────────────────────────────────────────
    mrr = round(premium_users * PREMIUM_PRICE_USD, 2)

    # ── Activity feed ────────────────────────────────────────────────────
    recent = (
        c.table("sessions")
        .select("id, user_id, started_at, duration_s, title, correction_count")
        .gt("duration_s", 0)
        .order("started_at", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )

    return {
        "live": _agent_health(),
        "users": {
            "total": total_users,
            "premium": premium_users,
            "free": total_users - premium_users,
            "new_this_week": new_this_week,
            "in_trial": in_trial,
            "active_today": active_today,
            "active_month": active_month,
        },
        "usage": {
            "sessions_today": len(today_sessions),
            "sessions_month": len(sessions),
            "seconds_today": today_seconds,
            "seconds_month": month_seconds,
            "avg_session_s": avg_session_s,
            "days": days,
            "top_users": [
                {
                    "user_id": uid,
                    "who": who.get(uid, uid[:14] + "…"),
                    "seconds": secs,
                    "plan": plan_of.get(uid, "free"),
                }
                for uid, secs in top_users
            ],
        },
        "cost": {
            "estimated_month_usd": est_cost,
            "vendors": vendors,
            "livekit_participant_min_used": round(participant_min_used),
            "livekit_participant_min_free": LIVEKIT_FREE_PARTICIPANT_MIN,
            "livekit_days_left": days_left,
        },
        "economics": {
            "mrr_usd": mrr,
            "est_margin_usd": round(mrr - est_cost, 2),
            "premium_price_usd": PREMIUM_PRICE_USD,
        },
        "recent_sessions": [
            {**r, "who": who.get(r["user_id"], r["user_id"][:14] + "…")}
            for r in recent
        ],
    }
