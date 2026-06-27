"""Quota logic for /token. Single source of truth — also called by the agent
indirectly via the same constants when it splits usage into trial overflow."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from db import _client

DAILY_CAP_S = {
    "free": 3 * 60,        # 3 min/day
    "premium": 30 * 60,    # 30 min/day
}
TRIAL_TOTAL_S = 15 * 60    # 15 min one-time
TRIAL_WINDOW_DAYS = 7      # spendable only within 7 days of signup


@dataclass
class Quota:
    plan: str
    daily_cap_s: int
    daily_used_s: int
    daily_remaining_s: int
    trial_total_s: int
    trial_used_s: int
    trial_remaining_s: int
    trial_eligible: bool

    @property
    def total_remaining_s(self) -> int:
        return self.daily_remaining_s + (self.trial_remaining_s if self.trial_eligible else 0)


def quota_for(user_id: str) -> Quota:
    """One round-trip per table — small numbers, fine to do sync."""
    c = _client()

    user = c.table("users").select("plan, created_at").eq("id", user_id).single().execute().data
    plan = user["plan"]
    created_at = datetime.fromisoformat(user["created_at"])
    daily_cap = DAILY_CAP_S[plan]

    today = date.today().isoformat()
    daily_row = (
        c.table("usage_minutes")
        .select("seconds_used")
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )
    daily_used = daily_row.data[0]["seconds_used"] if daily_row.data else 0

    trial_rows = (
        c.table("usage_minutes")
        .select("trial_credit_used_s")
        .eq("user_id", user_id)
        .execute()
    )
    trial_used = sum(r["trial_credit_used_s"] for r in trial_rows.data)

    trial_eligible = datetime.now(timezone.utc) - created_at <= timedelta(days=TRIAL_WINDOW_DAYS)

    return Quota(
        plan=plan,
        daily_cap_s=daily_cap,
        daily_used_s=daily_used,
        daily_remaining_s=max(0, daily_cap - daily_used),
        trial_total_s=TRIAL_TOTAL_S,
        trial_used_s=trial_used,
        trial_remaining_s=max(0, TRIAL_TOTAL_S - trial_used),
        trial_eligible=trial_eligible,
    )


def seconds_until_daily_reset() -> int:
    """For Retry-After header — UTC midnight is when daily_used resets."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - now).total_seconds())
