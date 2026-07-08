"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getQuota, type Quota } from "../lib/api";
import { Orb } from "./orb";

/**
 * App shell — persistent sidebar for signed-in screens.
 * Collapses to an icon rail below md; labels/cards reappear at md+.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getQuota(getToken).then(setQuota).catch(() => setQuota(null));
  }, [isLoaded, isSignedIn, getToken, pathname]);

  const isPremium = quota?.plan === "premium";
  const remaining = quota
    ? quota.daily_remaining_s + quota.trial_remaining_s
    : null;

  const name = user?.firstName ?? user?.fullName ?? "You";

  // Screens that get the mobile bottom tab bar (mirrors the iOS design's
  // Home / History / Talk / Saved / Profile tabs).
  const isTabRoute =
    pathname === "/" ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/saved") ||
    pathname.startsWith("/settings");

  return (
    <div className="h-dvh w-full flex items-stretch bg-[var(--color-paper)]">
      {/* ============ SIDEBAR (desktop only — mobile gets the bottom tab bar) ============ */}
      <aside className="h-full flex-none w-[clamp(84px,17vw,268px)] px-5 py-[30px] hidden md:flex flex-col bg-[var(--color-rail)] border-r border-[var(--color-rail-border)]">
          <Link href="/" className="flex items-center gap-3 px-2 pt-0">
            <Orb size={40} className="flex-none" />
            <span className="hidden md:inline font-display text-[26px] text-[var(--color-ink)] whitespace-nowrap overflow-hidden">
              Echo
            </span>
          </Link>

          <nav className="flex flex-col gap-1.5 mt-[38px]">
            <NavItem
              href="/"
              label="Inicio"
              active={pathname === "/"}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
                </svg>
              }
            />
            <NavItem
              href="/history"
              label="Historial"
              active={pathname.startsWith("/history") || pathname.startsWith("/summary")}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h13v9H9l-4 3v-3H4z" />
                  <path d="M20 9v10l-3-2h-6" />
                </svg>
              }
            />
            {/* Talk — the accent pill */}
            <Link
              href="/talk"
              title="Hablar"
              className="flex items-center gap-[13px] w-full px-3.5 py-3 my-1.5 rounded-[14px] font-semibold text-[15px] text-white bg-[var(--color-accent)]"
              style={{ boxShadow: "0 14px 28px -12px var(--color-glow)" }}
            >
              <span className="flex-none flex">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" />
                </svg>
              </span>
              <span className="hidden md:inline whitespace-nowrap overflow-hidden">Hablar</span>
            </Link>
            <NavItem
              href="/saved"
              label="Guardadas"
              active={pathname.startsWith("/saved")}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                </svg>
              }
            />
            <NavItem
              href="/settings"
              label="Perfil"
              active={pathname.startsWith("/settings")}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
                </svg>
              }
            />
          </nav>

          <div className="mt-auto flex flex-col gap-3.5">
            {!isPremium && quota && (
              <div className="hidden md:block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] px-4 py-[18px]">
                <div className="text-[12px] font-bold uppercase tracking-[0.03em] text-[var(--color-gold)]">
                  Plan gratis
                </div>
                <div className="text-[14px] text-[var(--color-text-muted)] leading-[1.45] mt-[7px]">
                  Te quedan{" "}
                  <strong className="text-[var(--color-ink)]">
                    {formatClock(remaining ?? 0)}
                  </strong>{" "}
                  de práctica hoy.
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/paywall")}
                  className="mt-3.5 w-full h-10 rounded-[11px] bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[14px] cursor-pointer"
                  style={{ boxShadow: "0 12px 24px -14px rgba(150,130,50,0.42)" }}
                >
                  Mejorar
                </button>
              </div>
            )}
            <Link
              href="/settings"
              className="flex items-center gap-[11px] px-2.5 py-[9px] rounded-[14px] hover:bg-[var(--color-accent-soft)] transition-colors"
            >
              <Orb size={36} className="flex-none" />
              <span className="hidden md:block min-w-0">
                <span className="block font-bold text-[14px] text-[var(--color-ink)] truncate">
                  {name}
                </span>
                <span className="text-[12px] text-[var(--color-text-faint)]">
                  {isPremium ? "Plan Premium" : "Plan gratis"}
                </span>
              </span>
            </Link>
          </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main
        className={`flex-1 min-w-0 h-full overflow-y-auto bg-[var(--color-main)] ${
          isTabRoute ? "pb-[112px] md:pb-0" : ""
        }`}
      >
        {children}
      </main>

      {/* ============ MOBILE BOTTOM TAB BAR (iOS-design pill) ============ */}
      {isTabRoute && (
        <nav className="md:hidden fixed left-4 right-4 bottom-[max(20px,env(safe-area-inset-bottom))] z-30 h-[66px] px-3 flex items-center justify-around bg-white rounded-full border border-[#F3EAF0]"
          style={{ boxShadow: "0 20px 44px -16px rgba(60,70,40,0.3), 0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <TabIcon href="/" active={pathname === "/"}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
            </svg>
          </TabIcon>
          <TabIcon href="/history" active={pathname.startsWith("/history")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h13v9H9l-4 3v-3H4z" />
              <path d="M20 9v10l-3-2h-6" />
            </svg>
          </TabIcon>
          {/* Center Talk button — raised accent circle, per the iOS design */}
          <Link
            href="/talk"
            aria-label="Talk"
            className="w-14 h-14 -mt-2 rounded-full bg-[var(--color-accent)] flex items-center justify-center"
            style={{ boxShadow: "0 14px 28px -8px var(--color-glow)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" />
            </svg>
          </Link>
          <TabIcon href="/saved" active={pathname.startsWith("/saved")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
          </TabIcon>
          <TabIcon href="/settings" active={pathname.startsWith("/settings")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
          </TabIcon>
        </nav>
      )}
    </div>
  );
}

function TabIcon({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`w-[46px] h-[46px] flex items-center justify-center transition-colors ${
        active ? "text-[var(--color-accent)]" : "text-[#BCB2BE]"
      }`}
    >
      {children}
    </Link>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      className="relative flex items-center gap-[13px] w-full px-3.5 py-3 rounded-[14px] font-semibold text-[15px] text-[#585B46] overflow-hidden"
    >
      {active && (
        <span className="absolute inset-0 bg-[var(--color-accent-soft)] rounded-[14px]" />
      )}
      <span className="relative flex-none flex">{icon}</span>
      <span className="relative hidden md:inline whitespace-nowrap overflow-hidden">
        {label}
      </span>
    </Link>
  );
}

export function formatClock(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
