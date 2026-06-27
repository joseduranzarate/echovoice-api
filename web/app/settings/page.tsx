"use client";

import Link from "next/link";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Orb } from "../components/orb";
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
      const url = quota.plan === "premium"
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
    <main className="flex-1 flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-[460px] flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Orb size={28} />
            <span className="font-display text-[18px] font-bold tracking-tight">
              Echo
            </span>
          </Link>
          <Link
            href="/talk"
            className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            Back to talk
          </Link>
        </header>

        <section className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-[clamp(26px,4.5vw,32px)]">
            Settings
          </h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            Hi {name}. Everything stays where you left it.
          </p>
        </section>

        <Group title="Account">
          <Row label="Email" value={email} />
          <Row
            label="Plan"
            value={isPremium ? "Premium" : "Free"}
            trailing={
              <button
                type="button"
                onClick={handleBillingClick}
                disabled={!quota || billingLoading}
                className="text-[13px] font-medium text-[var(--color-coral)] hover:text-[var(--color-coral-deep)] disabled:opacity-50 transition-colors"
              >
                {billingLoading
                  ? "Opening…"
                  : isPremium
                  ? "Manage"
                  : "Upgrade"}
              </button>
            }
          />
        </Group>

        <Group title="Practice">
          <Row label="Daily goal" value={isPremium ? "30 minutes" : "3 minutes"} />
          <Row label="Voice" value="Echo (default)" />
        </Group>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-[52px] rounded-full bg-white border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-ink)] text-[14px] font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-soft)] font-semibold pl-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-white border border-[var(--color-border)] divide-y divide-[var(--color-border-soft)]">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] text-[var(--color-text-muted)]">{label}</span>
        <span className="text-[14px] font-medium">{value}</span>
      </div>
      {trailing}
    </div>
  );
}
