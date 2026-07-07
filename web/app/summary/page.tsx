"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Orb } from "../components/orb";
import { AppShell } from "../components/app-shell";
import { latestSession, type SessionSummary } from "../lib/api";

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryInner />
    </Suspense>
  );
}

function SummaryInner() {
  const params = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [session, setSession] = useState<SessionSummary | null>(null);

  // Client-side timer as the instant fallback; the server row (with title,
  // word count, corrections) replaces it once loaded. The analysis job runs
  // async after the call, so fields fill in on a refresh if they miss.
  const clientSeconds = Math.max(0, parseInt(params.get("s") || "0", 10));

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    latestSession(getToken).then(setSession).catch(() => setSession(null));
  }, [isLoaded, isSignedIn, getToken]);

  const seconds = session?.duration_s ?? clientSeconds;
  const billable = seconds >= 30;

  const headline = billable ? "Nice work." : "That was a short one.";
  const sub = billable
    ? `You spoke for ${formatDuration(seconds)}.`
    : "Sessions under 30 seconds don't count against your daily minutes — try again whenever.";

  return (
    <AppShell>
      <div className="max-w-[560px] mx-auto min-h-full flex flex-col justify-center px-[clamp(22px,4vw,40px)] py-12 text-center">
        <div className="flex flex-col items-center">
          <Orb size={64} />
          <h1 className="font-display text-[clamp(28px,4vw,36px)] tracking-[-0.025em] mt-6">
            {headline}
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] mt-2 max-w-[380px]">
            {sub}
          </p>
          {session?.title && (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-[13px] font-semibold">
              “{session.title}”
            </div>
          )}
        </div>

        {billable && (
          <div className="grid grid-cols-2 gap-3 mt-8">
            <Stat label="Duration" value={formatDuration(seconds)} />
            {session?.word_count != null ? (
              <Stat label="Words spoken" value={String(session.word_count)} accent />
            ) : (
              <Stat label="Minutes" value={(seconds / 60).toFixed(1)} />
            )}
            {(session?.correction_count ?? 0) > 0 && (
              <div className="col-span-2">
                <Stat
                  label="Gentle corrections"
                  value={String(session!.correction_count)}
                  accent
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-8">
          {session && billable && (
            <Link
              href={`/history/${session.id}`}
              className="h-14 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] flex items-center justify-center text-[16px] font-bold hover:-translate-y-[2px] active:translate-y-0 transition-transform"
              style={{ boxShadow: "var(--shadow-pill)" }}
            >
              See transcript
            </Link>
          )}
          <Link
            href="/talk"
            className={
              session && billable
                ? "text-center text-[15px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors h-11 flex items-center justify-center"
                : "h-14 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] flex items-center justify-center text-[16px] font-bold hover:-translate-y-[2px] active:translate-y-0 transition-transform"
            }
            style={session && billable ? undefined : { boxShadow: "var(--shadow-pill)" }}
          >
            Talk again
          </Link>
          <Link
            href="/"
            className="text-center text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Back home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[18px] bg-[var(--color-surface)] border border-[var(--color-border)] px-5 py-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
        {label}
      </span>
      <span
        className="font-display text-[22px] tabular-nums"
        style={accent ? { color: "var(--color-accent)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${r}s`;
}
