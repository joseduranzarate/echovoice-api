"use client";

import Link from "next/link";
import { Orb } from "../../components/orb";

export default function BillingCancelPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-7 text-center">
        <Orb size={56} />

        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-[clamp(24px,4.5vw,32px)]">
            No worries.
          </h1>
          <p className="text-[14px] text-[var(--color-text-muted)] max-w-[320px]">
            You weren&apos;t charged. Premium will be here when you&apos;re ready.
          </p>
        </div>

        <div className="w-full flex flex-col gap-2.5 pt-2">
          <Link
            href="/talk"
            className="h-[52px] rounded-full bg-[var(--color-ink)] text-white text-[14px] font-medium flex items-center justify-center hover:-translate-y-[2px] active:translate-y-0 transition-transform"
          >
            Back to talking
          </Link>
          <Link
            href="/"
            className="text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
