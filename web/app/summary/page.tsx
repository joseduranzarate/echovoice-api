"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Orb } from "../components/orb";

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

  const headline = billable
    ? "Nice. That counts."
    : "That was a short one.";

  const sub = billable
    ? `You spoke for ${formatDuration(seconds)}. Daily streak: +1.`
    : "Sessions under 30 seconds don't count against your daily minutes — try again whenever.";

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8">
        <Orb size={56} />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display font-bold text-[clamp(28px,5vw,38px)]">
            {headline}
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] max-w-[360px]">
            {sub}
          </p>
        </div>

        {billable && (
          <div className="w-full grid grid-cols-2 gap-3">
            <Stat label="Duration" value={formatDuration(seconds)} />
            <Stat label="Minutes" value={minutes} />
          </div>
        )}

        <div className="w-full flex flex-col gap-3 pt-2">
          <Link
            href="/talk"
            className="h-[56px] rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center text-[15px] font-medium hover:-translate-y-[2px] active:translate-y-0 transition-transform"
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
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] px-5 py-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
        {label}
      </span>
      <span className="font-display text-[22px] font-bold tabular-nums">
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
