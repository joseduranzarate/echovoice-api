"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { startCheckout } from "../lib/api";

const PREMIUM_PRICE = "$14.99";

const PERKS = [
  "30 minutos de práctica al día",
  "Transcripción completa e historial guardado",
  "Correcciones suaves después de cada charla",
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
          ? "No pudimos abrir el pago. Inténtalo en un momento."
          : "Algo salió mal.",
      );
    }
  }

  return (
    <AppShell>
      <div className="max-w-[560px] mx-auto min-h-full flex flex-col justify-center px-[30px] pt-[60px] pb-20 text-center">
        <div className="text-[13px] font-bold tracking-[0.06em] uppercase text-[var(--color-accent)]">
          Esos fueron tus 3 minutos de hoy
        </div>
        <h1 className="font-display text-[clamp(28px,3.5vw,38px)] tracking-[-0.025em] leading-[1.1] mt-3.5">
          Diste todo por hoy.
        </h1>
        <p className="text-[16px] text-[var(--color-text-muted)] mt-3 leading-[1.55]">
          Echo se reinicia a medianoche — o desbloquea 30 minutos al día ahora mismo.
        </p>

        <div
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-[26px] mt-[30px] text-left"
          style={{ boxShadow: "0 28px 60px -36px var(--color-glow)" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[23px] tracking-[-0.02em]">
              Echo Premium
            </span>
            <span className="text-[14px] text-[var(--color-text-soft)]">
              <strong className="text-[var(--color-ink)] font-bold">
                {PREMIUM_PRICE}
              </strong>
              /mo
            </span>
          </div>
          <div className="h-px bg-[var(--color-border-soft)] my-[18px]" />
          <div className="flex flex-col gap-[13px]">
            {PERKS.map((p) => (
              <div
                key={p}
                className="flex items-center gap-3 text-[15px] text-[#3C3E2E]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-11" />
                </svg>
                {p}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          className="mt-6 h-14 rounded-full border-none bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[17px] cursor-pointer disabled:opacity-60 hover:-translate-y-[2px] active:translate-y-0 disabled:hover:translate-y-0 transition-transform"
          style={{ boxShadow: "var(--shadow-pill)" }}
        >
          {loading ? "Abriendo el pago…" : "Desbloquear Premium"}
        </button>
        {error && <p className="text-[13px] text-[#C0563E] mt-3">{error}</p>}
        <Link
          href="/"
          className="mt-3 h-11 flex items-center justify-center text-[var(--color-text-soft)] text-[15px] font-medium hover:text-[var(--color-ink)] transition-colors"
        >
          Nos vemos mañana
        </Link>
      </div>
    </AppShell>
  );
}
