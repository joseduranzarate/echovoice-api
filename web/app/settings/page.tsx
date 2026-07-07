"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Orb } from "../components/orb";
import { AppShell } from "../components/app-shell";
import { getQuota, openPortal, startCheckout, type Quota } from "../lib/api";

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [quota, setQuota] = useState<Quota | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getQuota(getToken).then(setQuota).catch(() => setQuota(null));
  }, [isLoaded, isSignedIn, getToken]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  async function handleBillingClick() {
    if (!quota) return;
    setBillingLoading(true);
    try {
      const url =
        quota.plan === "premium"
          ? await openPortal(getToken)
          : await startCheckout(getToken);
      window.location.assign(url);
    } catch {
      setBillingLoading(false);
    }
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const name = user?.firstName ?? user?.fullName ?? "Friend";
  const isPremium = quota?.plan === "premium";

  return (
    <AppShell>
      <div className="max-w-[640px] mx-auto px-[clamp(22px,4vw,40px)] pt-[clamp(30px,5vw,64px)] pb-20">
        {/* Identity */}
        <div className="flex items-center gap-5">
          <Orb size={84} className="flex-none" />
          <div>
            <div className="font-display text-[26px] tracking-[-0.01em]">{name}</div>
            <div
              className="inline-flex items-center gap-1.5 mt-2 px-[13px] py-[5px] rounded-full text-[12px] font-bold tracking-[0.03em] uppercase"
              style={{
                background: isPremium ? "var(--color-accent-soft)" : "var(--color-gold-soft)",
                color: isPremium ? "var(--color-accent)" : "var(--color-gold)",
              }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: isPremium ? "var(--color-accent)" : "var(--color-gold)",
                }}
              />
              {isPremium ? "Premium plan" : "Free plan"}
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="text-[13px] font-bold text-[var(--color-text-soft)] mt-9 mb-3 px-1">
          Account
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
          <Row label="Signed in as" value={email} />
          <Row
            label="Plan"
            value={isPremium ? "Premium · 30 min/day" : "Free · 3 min/day"}
            valueAccent
            last
            trailing={
              <button
                type="button"
                onClick={handleBillingClick}
                disabled={!quota || billingLoading}
                className="text-[13px] font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-deep)] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {billingLoading ? "Opening…" : isPremium ? "Manage" : "Upgrade"}
              </button>
            }
          />
        </div>

        {/* Practice */}
        <div className="text-[13px] font-bold text-[var(--color-text-soft)] mt-[26px] mb-3 px-1">
          Practice
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
          <Row label="Language" value="English" />
          <Row label="Voice" value="Echo (default)" last />
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-[26px] h-[50px] px-[26px] rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold text-[15px] cursor-pointer hover:border-[var(--color-accent)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  trailing,
  valueAccent = false,
  last = false,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
  valueAccent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-[17px] gap-4 ${
        last ? "" : "border-b border-[var(--color-border-soft)]"
      }`}
    >
      <span className="text-[16px]">{label}</span>
      <span className="flex items-center gap-4 min-w-0">
        <span
          className={`text-[15px] truncate ${
            valueAccent
              ? "font-semibold text-[var(--color-accent)]"
              : "text-[var(--color-text-soft)]"
          }`}
        >
          {value}
        </span>
        {trailing}
      </span>
    </div>
  );
}
