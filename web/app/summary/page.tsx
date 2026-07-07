"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Orb } from "../components/orb";
import { AppShell } from "../components/app-shell";

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryInner />
    </Suspense>
  );
}

function SummaryInner() {
  const params = useSearchParams();
  const seconds = Math.max(0, parseInt(params.get("s") || "0", 10));
  const billable = seconds >= 30;
  const minutes = (seconds / 60).toFixed(1);

  const headline = billable ? "Nice. That counts." : "That was a short one.";

  const sub = billable
    ? `You spoke for ${formatDuration(seconds)}.`
    : "Sessions under 30 seconds don't count against your daily minutes — try again whenever.";

  return (
    <AppShell>
      <div className="max-w-[760px] mx-auto px-[clamp(22px,4vw,40px)] pt-[clamp(30px,5vw,60px)] pb-[90px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[13px] font-bold tracking-[0.05em] uppercase text-[var(--color-accent)]">
              Session complete
            </div>
            <h1 className="font-display text-[clamp(26px,3vw,34px)] tracking-[-0.025em] mt-2">
              {headline}
            </h1>
            <div className="text-[14px] text-[var(--color-text-soft)] mt-1.5 max-w-[420px]">
              {sub}
            </div>
          </div>
          <Link
            href="/talk"
            className="h-11 px-[22px] rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-[14px] inline-flex items-center hover:border-[var(--color-accent)] transition-colors"
          >
            New conversation
          </Link>
        </div>

        <div className="flex flex-col items-center gap-8 mt-12">
          <Orb size={72} />

          {billable && (
            <div className="w-full max-w-[460px] grid grid-cols-2 gap-3">
              <Stat label="Duration" value={formatDuration(seconds)} />
              <Stat label="Minutes" value={minutes} />
            </div>
          )}

          <div className="w-full max-w-[460px] flex flex-col gap-3 pt-2">
            <Link
              href="/talk"
              className="h-14 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] flex items-center justify-center text-[16px] font-bold hover:-translate-y-[2px] active:translate-y-0 transition-transform"
              style={{ boxShadow: "var(--shadow-pill)" }}
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
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[var(--color-surface)] border border-[var(--color-border)] px-5 py-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
        {label}
      </span>
      <span className="font-display text-[22px] tabular-nums">{value}</span>
    </div>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${r}s`;
}
