"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { AppShell } from "../components/app-shell";
import { deletePhrase, listPhrases, type Phrase } from "../lib/api";

export default function SavedPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    listPhrases(getToken)
      .then(setPhrases)
      .catch(() => setError("Couldn't load your phrases."));
  }, [isLoaded, isSignedIn, getToken]);

  async function handleDelete(id: string) {
    const prev = phrases;
    setPhrases((p) => (p ? p.filter((x) => x.id !== id) : p));
    try {
      await deletePhrase(getToken, id);
    } catch {
      setPhrases(prev); // roll back on failure
    }
  }

  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto px-[clamp(22px,4vw,56px)] pt-[clamp(30px,5vw,64px)] pb-20">
        <h1 className="font-display text-[clamp(28px,3.5vw,40px)]">
          Saved phrases
        </h1>
        <p className="text-[15px] text-[var(--color-text-muted)] mt-2.5">
          The phrases you saved from your conversations.
        </p>

        {error && <p className="text-[14px] text-[#C0563E] mt-7">{error}</p>}

        {!error && phrases === null && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 mt-7">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[140px] rounded-[22px] bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse opacity-60"
              />
            ))}
          </div>
        )}

        {phrases && phrases.length === 0 && (
          <div className="flex flex-col items-center text-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl px-8 py-16 mt-7">
            <div className="w-[52px] h-[52px] rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
              </svg>
            </div>
            <div className="font-bold text-[18px] tracking-[-0.01em]">
              Nothing saved yet
            </div>
            <p className="text-[14px] text-[var(--color-text-soft)] leading-[1.5] max-w-[380px]">
              When Echo gently corrects you, open the transcript and tap
              “Save phrase” — it'll be kept here to review any time.
            </p>
            <Link
              href="/talk"
              className="mt-2 h-12 px-8 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[15px] inline-flex items-center hover:-translate-y-[2px] active:translate-y-0 transition-transform"
              style={{ boxShadow: "var(--shadow-pill)" }}
            >
              Start a conversation
            </Link>
          </div>
        )}

        {phrases && phrases.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 mt-7">
            {phrases.map((p) => (
              <PhraseCard key={p.id} p={p} onDelete={() => handleDelete(p.id)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PhraseCard({ p, onDelete }: { p: Phrase; onDelete: () => void }) {
  return (
    <div
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] px-[22px] py-[22px] flex flex-col"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[17px] font-semibold leading-[1.4] tracking-[-0.01em]">
          {p.phrase}
        </div>
        <button
          type="button"
          onClick={onDelete}
          title="Remove from saved"
          className="flex-none mt-0.5 text-[var(--color-accent)] hover:text-[#C0563E] transition-colors cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </div>
      {p.note && (
        <div className="text-[14px] text-[var(--color-text-soft)] leading-[1.5] mt-[9px]">
          {p.note}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3.5">
        {p.tag && (
          <span className="inline-flex items-center px-3 py-[5px] rounded-full bg-[var(--color-accent-soft)] text-[12px] font-semibold text-[var(--color-accent)]">
            {p.tag}
          </span>
        )}
        {p.session_id && (
          <Link
            href={`/history/${p.session_id}`}
            className="text-[12px] font-semibold text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
          >
            From this conversation →
          </Link>
        )}
      </div>
    </div>
  );
}
