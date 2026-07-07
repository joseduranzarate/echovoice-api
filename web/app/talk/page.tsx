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
import { AppShell } from "../components/app-shell";
import { ApiError, mintToken, type Quota } from "../lib/api";
import { hasOnboarded } from "../lib/onboarding";

type Phase = "idle" | "connecting" | "waking" | "live" | "ending" | "error";

export default function TalkPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("idle");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [elapsedS, setElapsedS] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [userLine, setUserLine] = useState("");
  const [echoLine, setEchoLine] = useState("");

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
    setUserLine("");
    setEchoLine("");
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

      // Resolve when a remote participant (the agent) appears. Wired BEFORE
      // room.connect() so we never miss the event if the agent is already in
      // the room — the SDK replays ParticipantConnected for current peers.
      const agentReady = new Promise<void>((resolve) => {
        room.on(RoomEvent.ParticipantConnected, () => resolve());
      });

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
        // Agent is anyone-not-us.
        const meId = room.localParticipant.identity;
        const remoteTalking = speakers.some((s) => s.identity !== meId);
        if (remoteTalking) setOrbState("speaking");
        else setOrbState("listening");
      });

      // Live captions — the agent publishes {type:"transcript", role, text,
      // final} on the room's data channel for every turn.
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg?.type !== "transcript") return;
          if (msg.role === "user") setUserLine(msg.text);
          else if (msg.role === "assistant") setEchoLine(msg.text);
        } catch {
          // non-JSON data message — ignore
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        // If we end this from the user button we already handled summary.
        // If LiveKit disconnects us unexpectedly, still try summary.
        if (phase === "live") void endCall();
      });

      await room.connect(t.url, t.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicOn(true);

      // Don't go live until the agent is actually in the room — otherwise
      // the user's first words land in a one-person room and are lost.
      setPhase("waking");
      if (room.remoteParticipants.size === 0) {
        await Promise.race([
          agentReady,
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Echo didn't join in time")), 12_000),
          ),
        ]);
      }

      startedAtRef.current = Date.now();
      setElapsedS(0);
      setPhase("live");
      setOrbState("listening");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        router.push("/paywall");
        return;
      }
      await roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
      setPhase("error");
      setOrbState("idle");
      setErrorMsg(e instanceof Error ? e.message : "Couldn't connect");
    }
  }

  async function toggleMic() {
    const room = roomRef.current;
    if (!room || phase !== "live") return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    } catch {
      // ignore
    }
  }

  const greeting = (() => {
    const name = user?.firstName || "you";
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name}.`;
    if (hour < 18) return `Good afternoon, ${name}.`;
    return `Good evening, ${name}.`;
  })();

  const stateLabel = (() => {
    switch (phase) {
      case "connecting":
        return "Connecting…";
      case "waking":
        return "Waking up Echo…";
      case "ending":
        return "Wrapping up…";
      case "error":
        return errorMsg ?? "Couldn't connect";
      case "live":
        return orbState === "speaking"
          ? "Echo is speaking"
          : !micOn
          ? "Mic is off"
          : orbState === "listening"
          ? "Listening…"
          : "Take your time";
      default:
        return "Tap the orb to start speaking";
    }
  })();

  const busy = phase === "connecting" || phase === "waking";
  const canStart = phase === "idle" || phase === "error";

  return (
    <AppShell>
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 relative">
        <audio ref={audioElRef} autoPlay playsInline />

        {/* Status line */}
        <div className="absolute top-[30px] left-0 right-0 flex items-center justify-center gap-[9px] text-[var(--color-text-muted)] text-[14px] font-semibold">
          <span
            className="w-[7px] h-[7px] rounded-full animate-dot-pulse"
            style={{
              background: phase === "error" ? "#C0563E" : "var(--color-accent)",
            }}
          />
          <span className={phase === "error" ? "text-[#C0563E]" : undefined}>
            {stateLabel}
          </span>
          {phase === "live" && (
            <span className="tabular-nums text-[var(--color-text-faint)]">
              · {formatTime(elapsedS)}
            </span>
          )}
          {phase !== "live" && quota && (
            <span className="tabular-nums text-[var(--color-text-faint)]">
              · {formatTime(quota.daily_remaining_s + quota.trial_remaining_s)} left today
            </span>
          )}
        </div>

        {/* Orb stage */}
        <button
          type="button"
          onClick={canStart ? startCall : undefined}
          className={`relative flex items-center justify-center border-none bg-transparent p-0 ${
            canStart ? "cursor-pointer" : "cursor-default"
          }`}
          aria-label={canStart ? "Start talking" : "Conversation orb"}
        >
          <Orb
            size="clamp(240px, 34vh, 360px)"
            halo
            state={busy ? "connecting" : phase === "live" ? orbState : "idle"}
          />
        </button>

        {/* Under the orb: greeting when idle, caption strip when live */}
        <div className="min-h-12 mt-8 flex flex-col items-center gap-1 text-center max-w-[680px]">
          {canStart && (
            <>
              <h1 className="font-display text-[clamp(22px,3.4vw,28px)]">
                {greeting}
              </h1>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Tap the orb — or the button below — to start.
              </p>
            </>
          )}
          {phase === "live" && captionsOn && (
            <div className="flex flex-col items-center gap-2 animate-fade-up">
              {userLine && (
                <p className="text-[15px] leading-snug text-[var(--color-text-soft)]">
                  <span className="font-bold mr-1.5">You</span>
                  {userLine}
                </p>
              )}
              {echoLine && (
                <p className="font-display text-[clamp(18px,2.4vw,26px)] leading-snug text-[var(--color-ink)]">
                  <span className="text-[var(--color-accent)] mr-2">Echo</span>
                  {echoLine}
                </p>
              )}
              {!userLine && !echoLine && (
                <p className="text-[14px] text-[var(--color-text-faint)]">
                  Captions will appear as you talk.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 sm:gap-4 mt-4">
          {canStart && (
            <button
              type="button"
              onClick={startCall}
              className="h-[60px] px-[52px] rounded-full border-none bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[17px] cursor-pointer hover:-translate-y-[2px] active:translate-y-0 transition-transform"
              style={{ boxShadow: "var(--shadow-pill)" }}
            >
              {phase === "error" ? "Try again" : "Start talking"}
            </button>
          )}
          {(phase === "live" || busy || phase === "ending") && (
            <>
              <button
                type="button"
                onClick={toggleMic}
                disabled={phase !== "live"}
                title={micOn ? "Mute mic" : "Unmute mic"}
                className="w-[60px] h-[60px] rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[#3C3E2E] flex items-center justify-center cursor-pointer disabled:opacity-50 hover:border-[var(--color-accent)] transition-colors"
              >
                {micOn ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0563E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    <path d="M4 4l16 16" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCaptionsOn((v) => !v)}
                disabled={phase !== "live"}
                title={captionsOn ? "Hide captions" : "Show captions"}
                className={`w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors border ${
                  captionsOn
                    ? "bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[#3C3E2E] hover:border-[var(--color-accent)]"
                }`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="5" width="18" height="14" rx="4" />
                  <path d="M7 11h3M7 14.5h2M14 11h3M14 14.5h2" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => endCall()}
                disabled={phase !== "live"}
                className="h-[60px] px-7 sm:px-[52px] rounded-full border-none bg-[var(--color-btn)] text-[var(--color-btn-text)] font-bold text-[16px] sm:text-[17px] cursor-pointer disabled:opacity-50 hover:-translate-y-[2px] active:translate-y-0 transition-transform whitespace-nowrap"
                style={{ boxShadow: "var(--shadow-pill)" }}
              >
                End &amp; review
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
