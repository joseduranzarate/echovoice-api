/**
 * Tiny browser → FastAPI client. Adds Clerk's session JWT as Bearer so the
 * Python auth dependency (`authenticate_request`) can verify the caller.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type GetToken = (opts?: { template?: string }) => Promise<string | null>;

export type Quota = {
  plan: "free" | "premium";
  daily_remaining_s: number;
  trial_remaining_s: number;
};

export type TokenResponse = {
  token: string;
  url: string;
  room: string;
  identity: string;
  quota: Quota;
};

export type QuotaExhausted = {
  error: "quota_exhausted";
  plan: "free" | "premium";
  daily_cap_s: number;
  daily_remaining_s: number;
  trial_remaining_s: number;
  retry_after_s: number;
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `API ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function authedFetch(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
) {
  const token = await getToken();
  if (!token) throw new ApiError(401, null, "no clerk token");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return res;
}

export async function mintToken(
  getToken: GetToken,
  scenario?: string,
): Promise<TokenResponse> {
  const res = await authedFetch("/token", getToken, {
    method: "POST",
    ...(scenario
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario }),
        }
      : {}),
  });
  if (res.status === 429) {
    const body = (await res.json()) as QuotaExhausted;
    throw new ApiError(429, body, "quota exhausted");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as TokenResponse;
}

export type SessionSummary = {
  id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  title: string | null;
  preview: string | null;
  word_count: number | null;
  correction_count: number | null;
};

export type Turn = {
  id: string | number;
  role: "user" | "assistant";
  text: string;
  correction: { from: string; to: string } | null;
};

export async function listSessions(getToken: GetToken): Promise<SessionSummary[]> {
  const res = await authedFetch("/sessions", getToken);
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  const data = (await res.json()) as { sessions: SessionSummary[] };
  return data.sessions;
}

export async function latestSession(getToken: GetToken): Promise<SessionSummary | null> {
  const res = await authedFetch("/sessions/latest", getToken);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as SessionSummary;
}

export async function getSession(
  getToken: GetToken,
  id: string,
): Promise<SessionSummary> {
  const res = await authedFetch(`/sessions/${id}`, getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as SessionSummary;
}

export async function getTranscript(
  getToken: GetToken,
  id: string,
): Promise<Turn[]> {
  const res = await authedFetch(`/sessions/${id}/transcript`, getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { turns: Turn[] };
  return data.turns;
}

// ── Saved phrases ───────────────────────────────────────────────────────────

export type Phrase = {
  id: string;
  session_id: string | null;
  phrase: string;
  note: string | null;
  tag: string | null;
  created_at: string;
};

export async function listPhrases(getToken: GetToken): Promise<Phrase[]> {
  const res = await authedFetch("/phrases", getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { phrases: Phrase[] };
  return data.phrases;
}

export async function savePhrase(
  getToken: GetToken,
  body: { phrase: string; note?: string; tag?: string; session_id?: string },
): Promise<Phrase> {
  const res = await authedFetch("/phrases", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as Phrase;
}

export async function deletePhrase(getToken: GetToken, id: string): Promise<void> {
  const res = await authedFetch(`/phrases/${id}`, getToken, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// ── Preferences ─────────────────────────────────────────────────────────────

export type Preferences = { level: string | null; topic: string | null };

export async function getPreferences(getToken: GetToken): Promise<Preferences> {
  const res = await authedFetch("/me/preferences", getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as Preferences;
}

export async function updatePreferences(
  getToken: GetToken,
  prefs: Partial<Preferences>,
): Promise<Preferences> {
  const res = await authedFetch("/me/preferences", getToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as Preferences;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export type AdminStats = {
  live: { up: boolean; active_rooms: number };
  users: {
    total: number;
    premium: number;
    free: number;
    new_this_week: number;
    in_trial: number;
    active_today: number;
    active_month: number;
  };
  usage: {
    sessions_today: number;
    sessions_month: number;
    seconds_today: number;
    seconds_month: number;
    avg_session_s: number;
    days: Array<{ date: string; daily_s: number; trial_s: number }>;
    top_users: Array<{ user_id: string; who: string; seconds: number; plan: string }>;
  };
  cost: {
    estimated_month_usd: number;
    vendors: Record<string, number>;
    livekit_participant_min_used: number;
    livekit_participant_min_free: number;
    livekit_days_left: number | null;
  };
  economics: { mrr_usd: number; est_margin_usd: number; premium_price_usd: number };
  recent_sessions: Array<{
    id: string;
    user_id: string;
    who: string;
    started_at: string;
    duration_s: number;
    title: string | null;
    correction_count: number | null;
  }>;
};

export async function getAdminStats(getToken: GetToken): Promise<AdminStats> {
  const res = await authedFetch("/admin/stats", getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as AdminStats;
}

// ── Account ─────────────────────────────────────────────────────────────────

export async function deleteAccount(getToken: GetToken): Promise<void> {
  const res = await authedFetch("/me", getToken, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function getQuota(getToken: GetToken): Promise<Quota> {
  const res = await authedFetch("/quota", getToken);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as Quota;
}

export async function startCheckout(getToken: GetToken): Promise<string> {
  const res = await authedFetch("/billing/checkout", getToken, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function openPortal(getToken: GetToken): Promise<string> {
  const res = await authedFetch("/billing/portal", getToken, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { url: string };
  return data.url;
}
