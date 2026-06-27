"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { Orb, type OrbState } from "../components/orb";
import { ApiError, mintToken, type Quota } from "../lib/api";
import { hasOnboarded } from "../lib/onboarding";

type Phase = "idle" | "connecting" | "live" | "ending" | "error";

export default function TalkPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("idle");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [elapsedS, setElapsedS] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Gate: signed-out → /sign-in. Not onboarded → /onboarding.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (!hasOnboarded()) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isSignedIn, router]);

  // Tick the elapsed counter while live.
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedS(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const endCall = useCallback(
    async (opts?: { goSummary?: boolean }) => {
      setPhase("ending");
      try {
        await roomRef.current?.disconnect();
      } catch {
        // ignore
      }
      roomRef.current = null;
      const duration = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : 0;
      startedAtRef.current = null;
      if (opts?.goSummary !== false) {
        const qs = new URLSearchParams({ s: String(duration) }).toString();
        router.push(`/summary?${qs}`);
      } else {
        setPhase("idle");
        setElapsedS(0);
      }
    },
    [router],
  );

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  async function startCall() {
    setErrorMsg(null);
    setPhase("connecting");
    setOrbState("connecting");

    try {
      const t = await mintToken(getToken);
      setQuota(t.quota);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (
        track: RemoteTrack,
        _pub: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Audio && audioElRef.current) {
          track.attach(audioElRef.current);
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (!speakers.length) {
          setOrbState("idle");
          return;
        }
        // Agent is anyone-not-us. Sage tint reserved for that case.
        const meId = room.localParticipant.identity;
        const remoteTalking = speakers.some((s) => s.identity !== meId);
        if (remoteTalking) setOrbState("speaking");
        else setOrbState("listening");
      });

      room.on(RoomEvent.Disconnected, () => {
        // If we end this from the user button we already handled summary.
        // If LiveKit disconnects us unexpectedly, still try summary.
        if (phase === "live") void endCall();
      });

      await room.connect(t.url, t.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      startedAtRef.current = Date.now();
      setElapsedS(0);
      setPhase("live");
      setOrbState("listening");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        router.push("/paywall");
        return;
      }
      setPhase("error");
      setOrbState("idle");
      setErrorMsg(e instanceof Error ? e.message : "Couldn't connect");
    }
  }

  const greeting = (() => {
    const name = user?.firstName || "you";
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name}.`;
    if (hour < 18) return `Good afternoon, ${name}.`;
    return `Good evening, ${name}.`;
  })();

  return (
    <main className="flex-1 flex flex-col items-center justify-between px-6 py-10 sm:py-14">
      <audio ref={audioElRef} autoPlay playsInline />

      {/* Header */}
      <div className="w-full max-w-[520px] flex items-center justify-between">
        <span className="text-[13px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
          {phase === "live" ? "In conversation" : "Ready"}
        </span>
        <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
          {phase === "live" && (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full animate-dot-pulse"
                style={{ background: "var(--color-coral)" }}
              />
              <span className="tabular-nums">{formatTime(elapsedS)}</span>
            </>
          )}
          {phase !== "live" && quota && (
            <span className="tabular-nums">
              {formatTime(quota.daily_remaining_s + quota.trial_remaining_s)} left today
            </span>
          )}
        </div>
      </div>

      {/* Orb + status */}
      <div className="flex flex-col items-center gap-8 my-8">
        <Orb
          size={300}
          halo={phase === "live"}
          state={phase === "connecting" ? "connecting" : orbState}
        />

        <div className="h-12 flex flex-col items-center gap-1 text-center">
          {phase === "idle" && (
            <>
              <h1 className="font-display font-bold text-[clamp(22px,3.4vw,28px)]">
                {greeting}
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Tap to start a 3-minute conversation.
              </p>
            </>
          )}
          {phase === "connecting" && (
            <p className="text-[15px] text-[var(--color-text-muted)]">
              Connecting…
            </p>
          )}
          {phase === "live" && (
            <p
              className="text-[15px] transition-colors"
              style={{
                color:
                  orbState === "speaking"
                    ? "var(--color-sage)"
                    : orbState === "listening"
                    ? "var(--color-coral)"
                    : "var(--color-text-muted)",
              }}
            >
              {orbState === "speaking"
                ? "Echo is speaking"
                : orbState === "listening"
                ? "Listening"
                : "Take your time"}
            </p>
          )}
          {phase === "ending" && (
            <p className="text-[15px] text-[var(--color-text-muted)]">
              Wrapping up…
            </p>
          )}
          {phase === "error" && (
            <p className="text-[14px] text-[var(--color-coral-deep)]">
              {errorMsg}
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="w-full max-w-[520px] flex flex-col items-center gap-4">
        {(phase === "idle" || phase === "error") && (
          <button
            onClick={startCall}
            className="h-[60px] px-10 rounded-full bg-[var(--color-ink)] text-white text-[15px] font-medium hover:-translate-y-[2px] active:translate-y-0 transition-transform"
            style={{ boxShadow: "var(--shadow-pill)" }}
          >
            {phase === "error" ? "Try again" : "Start talking"}
          </button>
        )}
        {(phase === "live" || phase === "connecting") && (
          <button
            onClick={() => endCall()}
            disabled={phase === "connecting"}
            className="h-[60px] px-10 rounded-full bg-white border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-ink)] disabled:opacity-50 text-[15px] font-medium transition-colors"
          >
            End conversation
          </button>
        )}
        {phase === "idle" && (
          <button
            onClick={() => router.push("/")}
            className="text-[13px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            ← Back home
          </button>
        )}
      </div>
    </main>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
