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

export async function mintToken(getToken: GetToken): Promise<TokenResponse> {
  const res = await authedFetch("/token", getToken, { method: "POST" });
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
