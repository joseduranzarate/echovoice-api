"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Soft upsell — shown after a free session when the user still has time today
 * but might want more. NEVER appears mid-conversation.
 */
export type UpsellModalProps = {
  open: boolean;
  onClose: () => void;
};

export function UpsellModal({ open, onClose }: UpsellModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:p-4"
      style={{ background: "rgba(27,26,24,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-3xl bg-white p-7 flex flex-col gap-5 animate-fade-up"
        style={{ boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-coral)]">
            Want more time?
          </span>
          <h2 className="font-display font-bold text-[22px] leading-tight">
            Premium gives you 30 minutes a day.
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            For when you&apos;re in the flow and the timer feels mean.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/paywall"
            onClick={onClose}
            className="h-[50px] rounded-full bg-[var(--color-ink)] text-white text-[14px] font-medium flex items-center justify-center hover:-translate-y-[1px] transition-transform"
          >
            See Premium
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-[44px] text-[13px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
