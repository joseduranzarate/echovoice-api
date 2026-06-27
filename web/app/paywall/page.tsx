"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { Orb } from "../components/orb";
import { startCheckout } from "../lib/api";

const PREMIUM_PRICE = "$14.99";

const PERKS = [
  "30 minutes a day — every day",
  "Save your conversation history",
  "Review what to say better, after the call",
];

export default function PaywallPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setError(null);
    setLoading(true);
    try {
      const url = await startCheckout(getToken);
      window.location.assign(url);
    } catch (e) {
      setLoading(false);
      setError(
        e instanceof Error && e.message
          ? "Couldn't reach checkout. Try again in a moment."
          : "Something went wrong.",
      );
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8">
        <Orb size={64} />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-coral)]">
            You&apos;ve done your three minutes
          </span>
          <h1 className="font-display font-bold text-[clamp(28px,5vw,38px)]">
            Keep going with Premium.
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] max-w-[360px]">
            Free Echo is three minutes a day so it stays a habit, not a binge.
            Premium gives you more room when you&apos;re in the flow.
          </p>
        </div>

        <ul className="w-full flex flex-col gap-2.5">
          {PERKS.map((p) => (
            <li
              key={p}
              className="flex items-center gap-3 rounded-2xl bg-white border border-[var(--color-border)] px-4 py-3"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--color-coral)" }}
              />
              <span className="text-[14px]">{p}</span>
            </li>
          ))}
        </ul>

        <div className="w-full flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="h-[56px] rounded-full bg-[var(--color-ink)] text-white text-[15px] font-medium hover:-translate-y-[2px] active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 transition-transform"
            style={{ boxShadow: "var(--shadow-pill)" }}
          >
            {loading ? "Opening checkout…" : `Go Premium — ${PREMIUM_PRICE}/month`}
          </button>
          {error && (
            <p className="text-[13px] text-[var(--color-coral-deep)] text-center">{error}</p>
          )}
          <Link
            href="/"
            className="text-center text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Come back tomorrow
          </Link>
        </div>

        <p className="text-[12px] text-[var(--color-text-faint)] text-center">
          Cancel anytime. We&apos;ll never make this awkward.
        </p>
      </div>
    </main>
  );
}
