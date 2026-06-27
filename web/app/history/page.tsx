"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Orb } from "../components/orb";
import { listSessions, type SessionSummary } from "../lib/api";

export default function HistoryPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    listSessions(getToken)
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load history"));
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-[560px] flex flex-col gap-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Orb size={28} />
            <span className="font-display text-[18px] font-bold tracking-tight">
              Echo
            </span>
          </Link>
          <Link
            href="/settings"
            className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            Settings
          </Link>
        </header>

        {/* Big CTA */}
        <section className="flex flex-col items-center gap-5 py-6">
          <Orb size={180} halo />
          <Link
            href="/talk"
            className="h-[56px] px-10 rounded-full bg-[var(--color-ink)] text-white text-[15px] font-medium flex items-center justify-center hover:-translate-y-[2px] active:translate-y-0 transition-transform"
            style={{ boxShadow: "var(--shadow-pill)" }}
          >
            Start a conversation
          </Link>
        </section>

        {/* History list */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-bold">Recent</h2>
            {sessions && sessions.length > 0 && (
              <span className="text-[12px] text-[var(--color-text-soft)]">
                {sessions.length} session{sessions.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-[var(--color-coral-deep)]">{error}</p>
          )}

          {!error && sessions === null && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[72px] rounded-2xl bg-white border border-[var(--color-border-soft)] animate-pulse opacity-60"
                />
              ))}
            </div>
          )}

          {sessions && sessions.length === 0 && (
            <p className="text-[14px] text-[var(--color-text-muted)] py-4">
              Your conversations will show up here once you start talking.
            </p>
          )}

          {sessions && sessions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <SessionRow s={s} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function SessionRow({ s }: { s: SessionSummary }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-[var(--color-border)] px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium">{formatDate(s.started_at)}</span>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {formatRelative(s.started_at)}
        </span>
      </div>
      <span className="font-display text-[16px] font-bold tabular-nums">
        {formatDuration(s.duration_s)}
      </span>
    </div>
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
  if (r === 0) return `${m}m`;
  return `${m}m ${r}s`;
}
