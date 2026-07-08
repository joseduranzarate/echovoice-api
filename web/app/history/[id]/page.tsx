"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Orb } from "../../components/orb";
import {
  getSession,
  getTranscript,
  savePhrase,
  type SessionSummary,
  type Turn,
} from "../../lib/api";

export default function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [session, setSession] = useState<SessionSummary | null>(null);
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !id) return;
    Promise.all([getSession(getToken, id), getTranscript(getToken, id)])
      .then(([s, t]) => {
        setSession(s);
        setTurns(t);
      })
      .catch(() => setError("No pudimos cargar esta conversación."));
  }, [isLoaded, isSignedIn, getToken, id]);

  async function handleSave(turn: Turn) {
    if (!turn.correction || savedIds.has(turn.id)) return;
    try {
      await savePhrase(getToken, {
        phrase: turn.correction.to,
        note: `En lugar de “${turn.correction.from}”.`,
        tag: "Corrección",
        session_id: id,
      });
      setSavedIds((prev) => new Set(prev).add(turn.id));
    } catch {
      // leave the button active for a retry
    }
  }

  return (
    <AppShell>
      <div className="max-w-[760px] mx-auto px-[clamp(22px,4vw,40px)] pt-[clamp(30px,5vw,60px)] pb-[90px]">
        {/* Header */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/history"
            className="w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center flex-none text-[var(--color-text-muted)] hover:border-[var(--color-accent)] transition-colors"
            aria-label="Volver al historial"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="text-[13px] font-bold tracking-[0.05em] uppercase text-[var(--color-accent)]">
              Transcripción
            </div>
            <h1 className="font-display text-[clamp(22px,3vw,30px)] tracking-[-0.02em] truncate">
              {session?.title ?? "Conversación"}
            </h1>
          </div>
        </div>

        {/* Stats strip */}
        {session && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--color-text-muted)] pt-4 pb-[18px] border-b border-[var(--color-border-soft)] mb-6">
            <span>{formatDate(session.started_at)}</span>
            <span>· {formatDuration(session.duration_s)}</span>
            {session.word_count != null && <span>· {session.word_count} palabras</span>}
            {(session.correction_count ?? 0) > 0 && (
              <span className="text-[var(--color-accent)] font-semibold">
                · {session.correction_count} correccion
                {session.correction_count === 1 ? "" : "es"}
              </span>
            )}
          </div>
        )}

        {error && <p className="text-[14px] text-[#C0563E] py-6">{error}</p>}

        {!error && turns === null && (
          <div className="flex flex-col gap-4 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-12 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-soft)] animate-pulse opacity-60 ${
                  i % 2 ? "self-end w-2/3" : "self-start w-3/4"
                }`}
              />
            ))}
          </div>
        )}

        {turns && turns.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)] py-6">
            No se grabó transcripción para esta conversación.
          </p>
        )}

        {turns && turns.length > 0 && (
          <div className="flex flex-col gap-[22px]">
            {turns.map((t) =>
              t.role === "user" ? (
                <UserTurn
                  key={t.id}
                  turn={t}
                  saved={savedIds.has(t.id)}
                  onSave={() => handleSave(t)}
                />
              ) : (
                <EchoTurn key={t.id} text={t.text} />
              ),
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function UserTurn({
  turn,
  saved,
  onSave,
}: {
  turn: Turn;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end">
      <div className="flex flex-col items-end gap-[9px] max-w-[82%]">
        <div
          className="bg-[var(--color-accent)] text-white px-[19px] py-3.5 text-[16px] leading-[1.5]"
          style={{
            borderRadius: "22px 22px 6px 22px",
            boxShadow: "0 18px 36px -22px var(--color-glow)",
          }}
        >
          {turn.text}
        </div>
        {turn.correction && (
          <div className="w-full bg-[var(--color-accent-soft)] border border-[#DBDBBE] rounded-2xl px-4 py-[13px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold tracking-[0.05em] uppercase text-[var(--color-accent)]">
                Corrección suave
              </span>
              <button
                type="button"
                onClick={onSave}
                disabled={saved}
                className="flex items-center gap-1 text-[12px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-deep)] disabled:opacity-60 cursor-pointer disabled:cursor-default"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                </svg>
                {saved ? "Guardada" : "Guardar frase"}
              </button>
            </div>
            <div className="text-[15px] leading-[1.5] text-left">
              <span className="line-through text-[#A9A38C]">{turn.correction.from}</span>
              <span className="text-[#C4BEA6] mx-[7px]">→</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {turn.correction.to}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EchoTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[78%] flex gap-[13px]">
        <Orb size={34} className="flex-none mt-0.5" />
        <div className="text-[16px] leading-[1.6] text-[#33362A]">{text}</div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m} min`;
}
