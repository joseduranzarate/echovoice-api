"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Orb } from "../components/orb";
import { updatePreferences } from "../lib/api";
import { writeOnboarding, type OnboardingAnswers } from "../lib/onboarding";

type Level = OnboardingAnswers["level"];
type Topic = OnboardingAnswers["topic"];

const LEVELS: Array<{ id: Level; label: string; hint: string }> = [
  { id: "beginner", label: "Just starting", hint: "I know some words" },
  { id: "intermediate", label: "Getting there", hint: "I can hold a chat" },
  { id: "advanced", label: "Polishing", hint: "I want it to flow" },
];

const TOPICS: Array<{ id: Topic; label: string; hint: string }> = [
  { id: "casual", label: "Everyday talk", hint: "Small talk, day-to-day" },
  { id: "work", label: "At work", hint: "Meetings, emails, standups" },
  { id: "travel", label: "Traveling", hint: "Asking, ordering, exploring" },
  { id: "interviews", label: "Interviews", hint: "Job conversations" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState<0 | 1>(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);

  function pickLevel(l: Level) {
    setLevel(l);
    setTimeout(() => setStep(1), 220);
  }

  function pickTopic(t: Topic) {
    setTopic(t);
    if (!level) return;
    writeOnboarding({ level, topic: t });
    // Persist server-side too — the agent paces the conversation by level.
    // Best-effort: localStorage is the gate, the server copy is the upgrade.
    void updatePreferences(getToken, { level, topic: t }).catch(() => {});
    setTimeout(() => router.push("/talk"), 220);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[480px] flex flex-col items-center gap-9">
        <Orb size={72} />

        <div className="w-full flex items-center gap-1.5">
          <span
            className="h-1 flex-1 rounded-full"
            style={{ background: step >= 0 ? "var(--color-ink)" : "var(--color-border)" }}
          />
          <span
            className="h-1 flex-1 rounded-full"
            style={{ background: step >= 1 ? "var(--color-ink)" : "var(--color-border)" }}
          />
        </div>

        {step === 0 && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                Where are you with English?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Pick the one that feels closest. You can change this later.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              {LEVELS.map((l) => (
                <OptionCard
                  key={l.id}
                  label={l.label}
                  hint={l.hint}
                  selected={level === l.id}
                  onClick={() => pickLevel(l.id)}
                />
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                What do you want to talk about?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                We&apos;ll start there. The conversation goes where you take it.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              {TOPICS.map((t) => (
                <OptionCard
                  key={t.id}
                  label={t.label}
                  hint={t.hint}
                  selected={topic === t.id}
                  onClick={() => pickTopic(t.id)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(0)}
              className="text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
            >
              ← Back
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function OptionCard({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white border-[1.5px] transition-all text-left"
      style={{
        borderColor: selected ? "var(--color-ink)" : "var(--color-border)",
        boxShadow: selected ? "0 8px 20px -12px rgba(27,26,24,0.25)" : "none",
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-[13px] text-[var(--color-text-muted)]">{hint}</span>
      </div>
      <span
        className="w-5 h-5 rounded-full border-[1.5px] transition-colors flex-shrink-0"
        style={{
          borderColor: selected ? "var(--color-ink)" : "var(--color-border)",
          background: selected ? "var(--color-ink)" : "transparent",
        }}
      />
    </button>
  );
}
