"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  getPreferences,
  getQuota,
  latestSession,
  type Preferences,
  type Quota,
  type SessionSummary,
} from "../lib/api";
import { formatClock } from "./app-shell";

const PROMPTS = [
  "Pedir en una cafetería",
  "Hablar de mi fin de semana",
  "Entrevista de trabajo",
  "Describir mi ciudad",
  "Charla casual",
];

// Ciclo-aware suggestions for academy students (first taste of the full
// curriculum map — hardcoded per band for now).
const BAND_PROMPTS: Record<string, string[]> = {
  basico: [
    "Presentarme y hablar de mi familia",
    "Mi rutina diaria",
    "Pedir comida en un restaurante",
    "Describir mi casa y mi barrio",
    "Hablar de mis gustos",
  ],
  intermedio: [
    "Contar qué hice el fin de semana",
    "Hacer planes con un amigo",
    "Dar mi opinión sobre una película",
    "Comparar dos ciudades",
    "Contar una anécdota",
  ],
  avanzado: [
    "Debatir un tema de actualidad",
    "Defender una opinión impopular",
    "Negociar un aumento de sueldo",
    "Explicar un problema complejo",
    "Contar una historia con detalle",
  ],
};

const INSTITUTE_LABEL: Record<string, string> = {
  britanico: "Británico",
  icpna: "ICPNA",
};

function cycleLabel(cycle: string | null): string | null {
  if (!cycle) return null;
  const [band, num] = cycle.split("-");
  if (!band) return null;
  const pretty = band.charAt(0).toUpperCase() + band.slice(1);
  return num ? `${pretty} ${num}` : pretty;
}

// Exam chips send a marker; the agent maps it to a structured mock-exam
// prompt (see EXAM_PROMPTS in agent/bot.py).
const EXAMS = [
  { label: "IELTS Speaking", value: "exam:ielts-speaking" },
  { label: "TOEFL Speaking", value: "exam:toefl-speaking" },
];

const SCENARIOS = [
  { emoji: "☕", title: "Vida diaria", desc: "Cafés, tiendas, momentos cotidianos.", bg: "#E9ECD6" },
  { emoji: "💼", title: "Trabajo y entrevistas", desc: "Reuniones, presentaciones, preguntas difíciles.", bg: "#EFE7CB" },
  { emoji: "✈️", title: "Viajes", desc: "Aeropuertos, direcciones, hoteles.", bg: "#E4ECDA" },
  { emoji: "💬", title: "Solo charlar", desc: "Sin agenda — deja que fluya.", bg: "#ECE8D2" },
];

function daysSince(iso: string): number {
  const started = new Date(iso);
  const today = new Date();
  return Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime()) /
      86_400_000,
  );
}

// Dynamic Home headline: reacts to the learner's last session. `undefined`
// means still loading (neutral default); `null` means a brand-new user.
function headline(latest: SessionSummary | null | undefined): string {
  if (latest === undefined) return "¿Hablamos?";
  if (latest === null) return "¿Empezamos?";
  const days = daysSince(latest.started_at);
  if (days === 0) return "¿Otra ronda?";
  if (days === 1) {
    const mins = Math.round(latest.duration_s / 60);
    return mins >= 1 ? `Ayer hablaste ${mins} min. ¿Seguimos?` : "¿Seguimos?";
  }
  if (days >= 3) return "Te extrañamos — ¿hablamos?";
  return "¿Hablamos?";
}

function sessionMeta(s: SessionSummary): string {
  const started = new Date(s.started_at);
  const days = daysSince(s.started_at);
  const when =
    days === 0
      ? "Hoy"
      : days === 1
      ? "Ayer"
      : started.toLocaleDateString("es", { day: "numeric", month: "short" });
  const mins = Math.max(1, Math.round(s.duration_s / 60));
  const parts = [when, `${mins} min`];
  if (s.correction_count) {
    parts.push(
      `${s.correction_count} correcci${s.correction_count === 1 ? "ón" : "ones"}`,
    );
  }
  return parts.join(" · ");
}

export function HomeDashboard() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [latest, setLatest] = useState<SessionSummary | null | undefined>(
    undefined,
  );
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [classTopic, setClassTopic] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getQuota(getToken).then(setQuota).catch(() => setQuota(null));
    latestSession(getToken).then(setLatest).catch(() => setLatest(null));
    getPreferences(getToken).then(setPrefs).catch(() => setPrefs(null));
  }, [isLoaded, isSignedIn, getToken]);

  const institute = prefs?.institute ? INSTITUTE_LABEL[prefs.institute] : null;
  const cycle = cycleLabel(prefs?.cycle ?? null);
  const band = prefs?.cycle?.split("-")[0];
  const prompts = (band && BAND_PROMPTS[band]) || PROMPTS;

  function startClassTopic() {
    const topic = classTopic.trim();
    if (!topic) return;
    // "class:" marker → the agent builds the conversation around what the
    // student is studying this week (see build_system_prompt in agent/bot.py).
    router.push(`/talk?scenario=${encodeURIComponent(`class: ${topic}`)}`);
  }

  const remaining = quota
    ? quota.daily_remaining_s + quota.trial_remaining_s
    : null;

  const hour = new Date().getHours();
  const daypart =
    hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
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
            {headline(latest)}
          </h1>
          {institute && (
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-accent)] text-[var(--color-accent-deep)] text-[13px] font-bold">
                {institute}
                {cycle ? ` · ${cycle}` : ""}
              </span>
              <span className="text-[14px] text-[var(--color-text-muted)]">
                Tu práctica de speaking, fuera de clase.
              </span>
            </div>
          )}
        </div>
        {remaining !== null && (
          <div className="flex items-center gap-[9px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-[18px] py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.9">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5l3 2" strokeLinecap="round" />
            </svg>
            {formatClock(remaining)} restantes hoy
          </div>
        )}
      </div>

      {/* Academy students: practice what their class is covering this week */}
      {institute && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startClassTopic();
          }}
          className="w-full flex items-center gap-3 bg-[var(--color-surface)] border-[1.5px] border-[var(--color-border)] rounded-[22px] pl-6 pr-3 py-3 mt-[30px] focus-within:border-[var(--color-accent)] transition-colors"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <svg
            className="flex-none"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
          </svg>
          <input
            type="text"
            value={classTopic}
            onChange={(e) => setClassTopic(e.target.value)}
            maxLength={180}
            placeholder='¿Qué estás viendo en clase? p. ej. "Unidad 4: past events"'
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-text-faint)]"
          />
          <button
            type="submit"
            disabled={!classTopic.trim()}
            aria-label="Practicar esto"
            className="flex-none w-[46px] h-[46px] rounded-full bg-[var(--color-btn)] flex items-center justify-center cursor-pointer disabled:opacity-40 hover:-translate-y-[1px] active:translate-y-0 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-btn-text)">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </button>
        </form>
      )}

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
            Habla con Echo
          </div>
          <div className="text-[clamp(14px,1.5vw,17px)] text-white/[0.62] mt-1.5 leading-[1.5]">
            Conversación libre, a tu ritmo. Toca y empieza a hablar.
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
        {prompts.map((label) => (
          <Link
            key={label}
            href={`/talk?scenario=${encodeURIComponent(label)}`}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-[19px] py-[11px] text-[14px] font-semibold text-[#3C3E2E] whitespace-nowrap hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors"
          >
            {label}
          </Link>
        ))}
        {EXAMS.map((e) => (
          <Link
            key={e.value}
            href={`/talk?scenario=${encodeURIComponent(e.value)}`}
            className="flex items-center gap-2 bg-[var(--color-accent-soft)] border border-[var(--color-accent)] rounded-full px-[19px] py-[11px] text-[14px] font-semibold text-[var(--color-accent-deep)] whitespace-nowrap hover:bg-[var(--color-accent)] hover:text-white transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
            </svg>
            {e.label}
            <span className="text-[10px] font-bold tracking-[0.05em] px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white group-hover:bg-white">
              EXAMEN
            </span>
          </Link>
        ))}
      </div>

      {/* Your activity — resume the last conversation with memory */}
      {latest && (
        <>
          <div className="flex items-center justify-between mt-11 mb-[18px]">
            <h2 className="font-display text-[22px] tracking-[-0.02em]">
              Tu actividad
            </h2>
            <Link
              href="/history"
              className="text-[14px] font-semibold text-[var(--color-accent)] hover:underline"
            >
              Historial →
            </Link>
          </div>
          <Link
            href={`/talk?resume=${latest.id}${
              latest.title ? `&resumeTitle=${encodeURIComponent(latest.title)}` : ""
            }`}
            className="w-full flex items-center gap-5 text-left text-white rounded-[26px] px-6 py-5 overflow-hidden relative transition-transform duration-[180ms] hover:-translate-y-[2px]"
            style={{
              background: "linear-gradient(120deg, #23261C, #33381F)",
              boxShadow: "0 26px 56px -30px rgba(30,34,20,0.9)",
            }}
          >
            <div
              className="flex-none rounded-full"
              style={{
                width: 62,
                height: 62,
                background:
                  "radial-gradient(circle at 36% 30%, var(--color-orb-a), var(--color-orb-b) 52%, var(--color-orb-c))",
                boxShadow:
                  "0 14px 30px -12px var(--color-glow), inset 0 -8px 18px rgba(60,74,30,0.5), inset 0 8px 16px rgba(240,248,220,0.5)",
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-[0.09em] text-white/50">
                RETOMA DONDE LO DEJASTE
              </div>
              <div className="font-display text-[clamp(18px,2.2vw,24px)] tracking-[-0.01em] mt-1 truncate">
                {latest.title || "Tu última conversación"}
              </div>
              <div className="text-[14px] text-white/[0.55] mt-0.5">
                {sessionMeta(latest)}
              </div>
            </div>
            <div className="flex-none w-[52px] h-[52px] rounded-full bg-[var(--color-btn)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-btn-text)">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </div>
          </Link>
        </>
      )}

      {/* Scenario grid */}
      <div className="flex items-center justify-between mt-11 mb-[18px]">
        <h2 className="font-display text-[22px] tracking-[-0.02em]">
          Escenarios de práctica
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {SCENARIOS.map((s) => (
          <Link
            key={s.title}
            href={`/talk?scenario=${encodeURIComponent(`${s.title} — ${s.desc}`)}`}
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
