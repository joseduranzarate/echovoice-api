"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { listSessions, type SessionSummary } from "../lib/api";

export default function HistoryPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    listSessions(getToken)
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load history"));
  }, [isLoaded, isSignedIn, getToken]);

  const stats = useMemo(() => {
    if (!sessions) return null;
    const weekAgo = Date.now() - 7 * 24 * 3600_000;
    const thisWeek = sessions.filter((s) => new Date(s.started_at).getTime() >= weekAgo);
    const weekMinutes = Math.round(
      thisWeek.reduce((acc, s) => acc + s.duration_s, 0) / 60,
    );
    return {
      thisWeek: thisWeek.length,
      weekMinutes,
      total: sessions.length,
    };
  }, [sessions]);

  const filtered = useMemo(() => {
    if (!sessions) return null;
    if (!query.trim()) return sessions;
    const q = query.trim().toLowerCase();
    return sessions.filter((s) =>
      `${s.title ?? ""} ${s.preview ?? ""} ${formatDate(s.started_at)} ${formatRelative(s.started_at)}`
        .toLowerCase()
        .includes(q),
    );
  }, [sessions, query]);

  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto px-[clamp(22px,4vw,56px)] pt-[clamp(30px,5vw,64px)] pb-20">
        <h1 className="font-display text-[clamp(28px,3.5vw,40px)]">History</h1>

        {/* Stats */}
        <div className="flex gap-3.5 flex-wrap mt-[22px]">
          <Stat value={stats ? String(stats.thisWeek) : "—"} label="this week" />
          <Stat value={stats ? String(stats.weekMinutes) : "—"} label="minutes" />
          <Stat
            value={stats ? String(stats.total) : "—"}
            label="conversations"
            accent
          />
        </div>

        {/* Search */}
        <label className="flex items-center gap-[11px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[14px] px-[18px] py-3.5 mt-6 text-[var(--color-text-faint)] max-w-[440px] focus-within:border-[var(--color-accent)] transition-colors">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your conversations…"
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-text-faint)]"
          />
        </label>

        <div className="text-[13px] font-bold text-[var(--color-text-soft)] mt-[34px] mb-3.5">
          Recent conversations
        </div>

        {error && <p className="text-[14px] text-[#C0563E]">{error}</p>}

        {!error && filtered === null && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[92px] rounded-[20px] bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse opacity-60"
              />
            ))}
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)] py-4">
            {sessions && sessions.length > 0
              ? "No conversations match your search."
              : "Your conversations will show up here once you start talking."}
          </p>
        )}

        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {filtered.map((s) => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 sm:min-w-[130px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] px-3 sm:px-5 py-4 sm:py-[18px] text-center sm:text-left">
      <div
        className="font-display text-[24px] sm:text-[28px] tracking-[-0.02em]"
        style={accent ? { color: "var(--color-accent)" } : undefined}
      >
        {value}
      </div>
      <div className="text-[12px] sm:text-[13px] text-[var(--color-text-soft)] mt-0.5">{label}</div>
    </div>
  );
}

function SessionCard({ s }: { s: SessionSummary }) {
  return (
    <Link
      href={`/history/${s.id}`}
      className="flex items-center gap-3.5 text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-[18px] transition-transform duration-[160ms] hover:-translate-y-[2px] hover:border-[var(--color-accent)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="w-[46px] h-[46px] rounded-[14px] bg-[var(--color-accent-soft)] flex items-center justify-center flex-none text-[var(--color-accent)]">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 10h8M8 14h5" />
          <path d="M4 5h16v11H9l-4 3v-3H4z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[16px] tracking-[-0.01em] truncate">
          {s.title ?? formatDate(s.started_at)}
        </div>
        <div className="text-[13px] text-[var(--color-text-soft)] truncate mt-[3px]">
          {s.preview ?? formatRelative(s.started_at)}
        </div>
        <div className="text-[12px] text-[var(--color-text-faint)] mt-1.5">
          {formatDate(s.started_at)} · {formatDuration(s.duration_s)}
          {(s.correction_count ?? 0) > 0 && (
            <span className="text-[var(--color-accent)]">
              {" "}· {s.correction_count} correction{s.correction_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (r === 0) return `${m} min`;
  return `${m} min ${r}s`;
}
