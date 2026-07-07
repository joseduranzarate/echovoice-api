"use client";

import Link from "next/link";
import { Orb } from "../../components/orb";

export default function BillingSuccessPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8 text-center">
        <Orb size={72} halo />

        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-[clamp(28px,5vw,38px)]">
            You&apos;re in. Welcome to Premium.
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] max-w-[360px]">
            Thirty minutes a day, your full history, the works. Go talk.
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 pt-2">
          <Link
            href="/talk"
            className="h-[56px] rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] text-[15px] font-bold flex items-center justify-center hover:-translate-y-[2px] active:translate-y-0 transition-transform"
            style={{ boxShadow: "var(--shadow-pill)" }}
          >
            Start a conversation
          </Link>
          <Link
            href="/settings"
            className="text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Manage subscription
          </Link>
        </div>

        <p className="text-[12px] text-[var(--color-text-faint)]">
          Your receipt is on its way by email.
        </p>
      </div>
    </main>
  );
}
