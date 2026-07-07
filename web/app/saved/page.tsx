"use client";

import Link from "next/link";
import { AppShell } from "../components/app-shell";

/**
 * Saved phrases — no backend endpoint yet, so this ships as the designed
 * page with an honest empty state. Wire to an API once phrases exist.
 */
export default function SavedPage() {
  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto px-[clamp(22px,4vw,56px)] pt-[clamp(30px,5vw,64px)] pb-20">
        <h1 className="font-display text-[clamp(28px,3.5vw,40px)]">
          Saved phrases
        </h1>
        <p className="text-[15px] text-[var(--color-text-muted)] mt-2.5">
          The phrases you bookmark — click to hear Echo say them.
        </p>

        <div className="flex flex-col items-center text-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl px-8 py-16 mt-7">
          <div className="w-[52px] h-[52px] rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
          </div>
          <div className="font-bold text-[18px] tracking-[-0.01em]">
            Nothing saved yet
          </div>
          <p className="text-[14px] text-[var(--color-text-soft)] leading-[1.5] max-w-[380px]">
            As you practice, Echo will surface phrases worth keeping. They&apos;ll
            live here so you can come back to them any time.
          </p>
          <Link
            href="/talk"
            className="mt-2 h-12 px-8 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[15px] inline-flex items-center hover:-translate-y-[2px] active:translate-y-0 transition-transform"
            style={{ boxShadow: "var(--shadow-pill)" }}
          >
            Start a conversation
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
