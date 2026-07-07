"use client";

import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getQuota, type Quota } from "../lib/api";
import { formatClock } from "./app-shell";

const PROMPTS = [
  "Order at a café",
  "Talk about my weekend",
  "Job interview",
  "Describe my city",
  "Small talk",
];

const SCENARIOS = [
  { emoji: "☕", title: "Everyday talk", desc: "Cafes, shops, small daily moments.", bg: "#E9ECD6" },
  { emoji: "💼", title: "Work & interviews", desc: "Meetings, intros, tricky questions.", bg: "#EFE7CB" },
  { emoji: "✈️", title: "Travel", desc: "Airports, directions, hotels.", bg: "#E4ECDA" },
  { emoji: "💬", title: "Just to chat", desc: "No agenda — keep it flowing.", bg: "#ECE8D2" },
];

export function HomeDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getQuota(getToken).then(setQuota).catch(() => setQuota(null));
  }, [isLoaded, isSignedIn, getToken]);

  const remaining = quota
    ? quota.daily_remaining_s + quota.trial_remaining_s
    : null;

  const hour = new Date().getHours();
  const daypart =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = user?.firstName ? `, ${user.firstName}` : "";

  return (
    <div className="max-w-[1040px] mx-auto px-[clamp(22px,4vw,56px)] pt-[clamp(30px,5vw,64px)] pb-20">
      <div className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <div className="text-[15px] text-[var(--color-text-faint)] font-semibold">
            {daypart}
            {name}
          </div>
          <h1 className="font-display text-[clamp(30px,4vw,44px)] mt-2">
            Ready to speak?
          </h1>
        </div>
        {remaining !== null && (
          <div className="flex items-center gap-[9px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-[18px] py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.9">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5l3 2" strokeLinecap="round" />
            </svg>
            {formatClock(remaining)} left today
          </div>
        )}
      </div>

      {/* Talk hero */}
      <Link
        href="/talk"
        className="w-full flex items-center gap-[26px] text-left text-white rounded-[30px] px-[clamp(24px,3vw,40px)] py-[clamp(24px,3vw,38px)] mt-[30px] overflow-hidden relative"
        style={{
          background: "linear-gradient(120deg, #23261C, #33381F)",
          boxShadow: "0 32px 70px -34px rgba(30,34,20,0.9)",
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            right: -40,
            top: -40,
            width: 220,
            height: 220,
            background: "radial-gradient(circle, var(--color-glow), transparent 70%)",
            filter: "blur(6px)",
          }}
        />
        <div
          className="relative flex-none rounded-full animate-breathe"
          style={{
            width: "clamp(76px, 9vw, 104px)",
            height: "clamp(76px, 9vw, 104px)",
            background:
              "radial-gradient(circle at 36% 30%, var(--color-orb-a), var(--color-orb-b) 52%, var(--color-orb-c))",
            boxShadow:
              "0 18px 40px -14px var(--color-glow), inset 0 -10px 24px rgba(60,74,30,0.5), inset 0 10px 20px rgba(240,248,220,0.5)",
          }}
        />
        <div className="flex-1 min-w-0 relative">
          <div className="font-display text-[clamp(22px,2.6vw,30px)] tracking-[-0.02em]">
            Talk to Echo
          </div>
          <div className="text-[clamp(14px,1.5vw,17px)] text-white/[0.62] mt-1.5 leading-[1.5]">
            Free-flowing conversation, at your pace. Tap and just start speaking.
          </div>
        </div>
        <div className="relative flex-none w-[52px] h-[52px] rounded-full bg-[var(--color-btn)] hidden sm:flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-btn-text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Prompt chips */}
      <div className="flex flex-wrap gap-2.5 mt-[26px]">
        {PROMPTS.map((label) => (
          <Link
            key={label}
            href="/talk"
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-[19px] py-[11px] text-[14px] font-semibold text-[#3C3E2E] whitespace-nowrap hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Scenario grid */}
      <div className="flex items-center justify-between mt-11 mb-[18px]">
        <h2 className="font-display text-[22px] tracking-[-0.02em]">
          Practice scenarios
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {SCENARIOS.map((s) => (
          <Link
            key={s.title}
            href="/talk"
            className="text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl px-[22px] py-6 transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-[3px]"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-[26px]"
              style={{ background: s.bg }}
            >
              {s.emoji}
            </div>
            <div className="font-bold text-[18px] mt-[18px] tracking-[-0.01em]">
              {s.title}
            </div>
            <div className="text-[14px] text-[var(--color-text-soft)] leading-[1.5] mt-1.5">
              {s.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
