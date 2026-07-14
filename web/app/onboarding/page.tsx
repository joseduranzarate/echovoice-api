"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Orb } from "../components/orb";
import { updatePreferences } from "../lib/api";
import { writeOnboarding, type OnboardingAnswers } from "../lib/onboarding";

type Level = OnboardingAnswers["level"];
type Topic = OnboardingAnswers["topic"];
type Institute = NonNullable<OnboardingAnswers["institute"]>;

const INSTITUTES: Array<{ id: Institute; label: string; hint: string }> = [
  { id: "britanico", label: "Británico", hint: "Estudio en el Británico" },
  { id: "icpna", label: "ICPNA", hint: "Estudio en el ICPNA" },
  { id: "self", label: "Por mi cuenta", hint: "Practico a mi ritmo" },
];

const BANDS: Array<{ id: string; label: string }> = [
  { id: "basico", label: "Básico" },
  { id: "intermedio", label: "Intermedio" },
  { id: "avanzado", label: "Avanzado" },
];

// Cycle band → self-study level (keeps the level field coherent for
// academy students without asking twice).
const BAND_LEVEL: Record<string, Level> = {
  basico: "beginner",
  intermedio: "intermediate",
  avanzado: "advanced",
};

const LEVELS: Array<{ id: Level; label: string; hint: string }> = [
  { id: "beginner", label: "Recién empiezo", hint: "Conozco algunas palabras" },
  { id: "intermediate", label: "En camino", hint: "Puedo mantener una charla" },
  { id: "advanced", label: "Puliendo", hint: "Quiero que fluya" },
];

const TOPICS: Array<{ id: Topic; label: string; hint: string }> = [
  { id: "casual", label: "Vida diaria", hint: "Charla casual, día a día" },
  { id: "work", label: "En el trabajo", hint: "Reuniones, correos, standups" },
  { id: "travel", label: "Viajando", hint: "Preguntar, pedir, explorar" },
  { id: "interviews", label: "Entrevistas", hint: "Conversaciones de trabajo" },
];

// Steps: 0 institute → 1 cycle (academy) | level (self) → 2 topic
export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [cycleNum, setCycleNum] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);

  const isAcademy = institute === "britanico" || institute === "icpna";

  function pickInstitute(i: Institute) {
    setInstitute(i);
    setTimeout(() => setStep(1), 220);
  }

  function pickCycle(b: string, n: number) {
    setBand(b);
    setCycleNum(n);
    setLevel(BAND_LEVEL[b]);
    setTimeout(() => setStep(2), 220);
  }

  function pickLevel(l: Level) {
    setLevel(l);
    setTimeout(() => setStep(2), 220);
  }

  function pickTopic(t: Topic) {
    setTopic(t);
    if (!institute || !level) return;
    const cycle = isAcademy && band && cycleNum ? `${band}-${cycleNum}` : null;
    writeOnboarding({ level, topic: t, institute, cycle });
    // Persist server-side too — the agent paces and frames the conversation
    // from these. Best-effort: localStorage is the gate.
    void updatePreferences(getToken, {
      level,
      topic: t,
      institute,
      cycle,
    }).catch(() => {});
    setTimeout(() => router.push("/talk"), 220);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[480px] flex flex-col items-center gap-9">
        <Orb size={72} />

        <div className="w-full flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{
                background: step >= i ? "var(--color-ink)" : "var(--color-border)",
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                ¿Dónde estudias inglés?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Así practicamos el speaking de tu ciclo.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              {INSTITUTES.map((i) => (
                <OptionCard
                  key={i.id}
                  label={i.label}
                  hint={i.hint}
                  selected={institute === i.id}
                  onClick={() => pickInstitute(i.id)}
                />
              ))}
            </div>
          </section>
        )}

        {step === 1 && isAcademy && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                ¿En qué ciclo estás?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Echo hablará al nivel de tu ciclo. Puedes cambiarlo después.
              </p>
            </div>

            <div className="w-full flex flex-col gap-4">
              {BANDS.map((b) => (
                <div key={b.id} className="w-full">
                  <div className="text-[13px] font-semibold text-[var(--color-text-muted)] mb-2">
                    {b.label}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                      const selected = band === b.id && cycleNum === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => pickCycle(b.id, n)}
                          className="h-10 rounded-xl border-[1.5px] text-[14px] font-semibold transition-all bg-white"
                          style={{
                            borderColor: selected
                              ? "var(--color-ink)"
                              : "var(--color-border)",
                            background: selected ? "var(--color-ink)" : "white",
                            color: selected ? "white" : "var(--color-ink)",
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <BackButton onClick={() => setStep(0)} />
          </section>
        )}

        {step === 1 && !isAcademy && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                ¿Cómo vas con el inglés?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Elige la que más se acerque. Puedes cambiarlo después.
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

            <BackButton onClick={() => setStep(0)} />
          </section>
        )}

        {step === 2 && (
          <section className="w-full flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-display font-bold text-[clamp(26px,4.5vw,34px)]">
                ¿De qué quieres hablar?
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Empezaremos por ahí. La conversación va a donde tú la lleves.
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

            <BackButton onClick={() => setStep(1)} />
          </section>
        )}
      </div>
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
    >
      ← Atrás
    </button>
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
