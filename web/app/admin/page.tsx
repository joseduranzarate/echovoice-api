"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/app-shell";
import { getAdminStats, type AdminStats } from "../lib/api";

const VENDOR_COLORS: Record<string, string> = {
  livekit: "#75894E",
  deepgram: "#8A9E5C",
  cartesia: "#AD8C46",
  groq: "#CBD7A6",
  railway: "#5E7040",
};

export default function AdminPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [denied, setDenied] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    getAdminStats(getToken)
      .then((s) => {
        setStats(s);
        setRefreshedAt(new Date());
      })
      .catch(() => setDenied(true));
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    load();
  }, [isLoaded, isSignedIn, load]);

  if (denied) {
    return (
      <AppShell>
        <div className="min-h-full flex items-center justify-center text-[15px] text-[var(--color-text-muted)]">
          Nothing here.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto px-[clamp(22px,4vw,56px)] pt-[clamp(30px,5vw,64px)] pb-20">
        {/* Header + live strip */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-display text-[clamp(28px,3.5vw,40px)]">Admin</h1>
          <div className="flex items-center gap-3">
            {stats && (
              <span className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-2 text-[13px] font-semibold">
                <span
                  className={`w-2 h-2 rounded-full ${stats.live.up ? "animate-dot-pulse" : ""}`}
                  style={{ background: stats.live.up ? "var(--color-accent)" : "#C0563E" }}
                />
                {stats.live.up
                  ? `${stats.live.active_rooms} call${stats.live.active_rooms === 1 ? "" : "s"} live · agent up`
                  : "agent unreachable"}
              </span>
            )}
            <button
              type="button"
              onClick={load}
              className="h-9 px-4 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] text-[13px] font-bold cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
        {refreshedAt && (
          <div className="text-[12px] text-[var(--color-text-faint)] mt-1">
            Updated {refreshedAt.toLocaleTimeString()} · costs are estimates — real
            invoices live in each vendor&apos;s portal
          </div>
        )}

        {!stats && !denied && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5 mt-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-[18px] bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse opacity-60" />
            ))}
          </div>
        )}

        {stats && (
          <>
            {/* ── Users ── */}
            <SectionTitle>Users</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat label="total" value={String(stats.users.total)} />
              <Stat label="premium" value={String(stats.users.premium)} accent />
              <Stat label="free" value={String(stats.users.free)} />
              <Stat label="new this week" value={String(stats.users.new_this_week)} />
              <Stat label="in trial" value={String(stats.users.in_trial)} />
              <Stat label="talked today" value={String(stats.users.active_today)} accent />
            </div>

            {/* ── Usage ── */}
            <SectionTitle>Usage</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="sessions today" value={String(stats.usage.sessions_today)} />
              <Stat label="minutes today" value={fmtMin(stats.usage.seconds_today)} />
              <Stat label="minutes this month" value={fmtMin(stats.usage.seconds_month)} accent />
              <Stat label="avg session" value={fmtClock(stats.usage.avg_session_s)} />
            </div>

            <Card className="mt-3.5">
              <CardTitle>Minutes per day — last 14 days</CardTitle>
              <DailyBars days={stats.usage.days} />
              <div className="flex gap-5 mt-3 text-[12px] text-[var(--color-text-soft)]">
                <LegendDot color="var(--color-accent)" label="daily quota" />
                <LegendDot color="var(--color-gold)" label="trial credit" />
              </div>
            </Card>

            {stats.usage.top_users.length > 0 && (
              <Card className="mt-3.5">
                <CardTitle>Top talkers this month</CardTitle>
                <div className="flex flex-col gap-2 mt-1">
                  {stats.usage.top_users.map((u) => (
                    <div key={u.user_id} className="flex items-center gap-3 text-[14px]">
                      <span className="font-mono text-[12px] text-[var(--color-text-soft)] w-[130px] truncate">
                        {u.user_id.slice(0, 16)}…
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          u.plan === "premium"
                            ? "bg-[var(--color-gold-soft)] text-[var(--color-gold)]"
                            : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        }`}
                      >
                        {u.plan}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-border-soft)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{
                            width: `${Math.min(100, (u.seconds / Math.max(1, stats.usage.top_users[0].seconds)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-[13px] w-16 text-right">
                        {fmtMin(u.seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Cost ── */}
            <SectionTitle>Estimated spend — this month</SectionTitle>
            <div className="grid md:grid-cols-2 gap-3.5">
              <Card>
                <div className="font-display text-[42px] tracking-[-0.02em]">
                  ${stats.cost.estimated_month_usd.toFixed(2)}
                </div>
                <div className="text-[13px] text-[var(--color-text-soft)] -mt-1 mb-4">
                  month to date, all vendors
                </div>
                <CostBar vendors={stats.cost.vendors} />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {Object.entries(stats.cost.vendors).map(([k, v]) => (
                    <LegendDot
                      key={k}
                      color={VENDOR_COLORS[k] ?? "#999"}
                      label={`${k} $${v.toFixed(2)}`}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <CardTitle>LiveKit free tier</CardTitle>
                <Gauge
                  used={stats.cost.livekit_participant_min_used}
                  total={stats.cost.livekit_participant_min_free}
                />
                <div className="text-[13px] text-[var(--color-text-muted)] mt-3">
                  {stats.cost.livekit_participant_min_used.toLocaleString()} /{" "}
                  {stats.cost.livekit_participant_min_free.toLocaleString()} participant-min
                  {stats.cost.livekit_days_left != null && (
                    <span>
                      {" "}· at this pace,{" "}
                      <strong className="text-[var(--color-ink)]">
                        ~{stats.cost.livekit_days_left} days
                      </strong>{" "}
                      until exhausted
                    </span>
                  )}
                </div>
                <div className="h-px bg-[var(--color-border-soft)] my-4" />
                <CardTitle>Unit economics</CardTitle>
                <div className="flex gap-6 mt-1">
                  <div>
                    <div className="text-[12px] text-[var(--color-text-soft)]">MRR</div>
                    <div className="font-display text-[22px]">
                      ${stats.economics.mrr_usd.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[var(--color-text-soft)]">est. margin</div>
                    <div
                      className="font-display text-[22px]"
                      style={{
                        color:
                          stats.economics.est_margin_usd >= 0
                            ? "var(--color-accent)"
                            : "#C0563E",
                      }}
                    >
                      {stats.economics.est_margin_usd >= 0 ? "+" : "−"}$
                      {Math.abs(stats.economics.est_margin_usd).toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* ── Activity ── */}
            <SectionTitle>Recent conversations</SectionTitle>
            <Card>
              <div className="flex flex-col divide-y divide-[var(--color-border-soft)]">
                {stats.recent_sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                    <span className="text-[12px] text-[var(--color-text-faint)] w-[110px] flex-none">
                      {new Date(s.started_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-mono text-[12px] text-[var(--color-text-soft)] w-[110px] truncate flex-none">
                      {s.user_id.slice(0, 14)}…
                    </span>
                    <span className="flex-1 truncate">
                      {s.title ?? <span className="text-[var(--color-text-faint)]">untitled</span>}
                    </span>
                    {(s.correction_count ?? 0) > 0 && (
                      <span className="text-[12px] text-[var(--color-accent)] font-semibold flex-none">
                        {s.correction_count}✎
                      </span>
                    )}
                    <span className="tabular-nums text-[13px] text-[var(--color-text-muted)] w-14 text-right flex-none">
                      {fmtClock(s.duration_s)}
                    </span>
                  </div>
                ))}
                {stats.recent_sessions.length === 0 && (
                  <div className="py-4 text-[14px] text-[var(--color-text-muted)]">
                    No conversations yet.
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Charts (inline SVG, meadow palette) ──────────────────────────────────────

function DailyBars({ days }: { days: AdminStats["usage"]["days"] }) {
  const W = 560;
  const H = 120;
  const gap = 6;
  const bw = (W - gap * (days.length - 1)) / days.length;
  const max = Math.max(60, ...days.map((d) => d.daily_s + d.trial_s));

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full mt-2" role="img" aria-label="Minutes per day">
      {days.map((d, i) => {
        const total = d.daily_s + d.trial_s;
        const h = (total / max) * H;
        const trialH = (d.trial_s / max) * H;
        const x = i * (bw + gap);
        const day = new Date(d.date + "T00:00:00").getDate();
        return (
          <g key={d.date}>
            {total > 0 ? (
              <>
                <rect x={x} y={H - h} width={bw} height={h - trialH} rx={3} fill="var(--color-accent)" />
                {trialH > 0 && (
                  <rect x={x} y={H - trialH} width={bw} height={trialH} rx={3} fill="var(--color-gold)" />
                )}
              </>
            ) : (
              <rect x={x} y={H - 3} width={bw} height={3} rx={1.5} fill="var(--color-border)" />
            )}
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#98937F">
              {day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CostBar({ vendors }: { vendors: Record<string, number> }) {
  const total = Object.values(vendors).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-4 rounded-full overflow-hidden border border-[var(--color-border-soft)]">
      {Object.entries(vendors).map(([k, v]) =>
        v > 0 ? (
          <div
            key={k}
            title={`${k}: $${v.toFixed(2)}`}
            style={{
              width: `${(v / total) * 100}%`,
              background: VENDOR_COLORS[k] ?? "#999",
            }}
          />
        ) : null,
      )}
    </div>
  );
}

function Gauge({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
  const color = pct > 85 ? "#C0563E" : pct > 60 ? "var(--color-gold)" : "var(--color-accent)";
  return (
    <div className="mt-2">
      <div className="h-3.5 rounded-full bg-[var(--color-border-soft)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[12px] font-semibold mt-1" style={{ color }}>
        {pct.toFixed(1)}% used
      </div>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold text-[var(--color-text-soft)] mt-9 mb-3">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] px-5 py-[18px] ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-bold text-[var(--color-text-soft)] mb-2">{children}</div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] px-4 py-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="font-display text-[26px] tracking-[-0.02em]"
        style={accent ? { color: "var(--color-accent)" } : undefined}
      >
        {value}
      </div>
      <div className="text-[12px] text-[var(--color-text-soft)] mt-0.5">{label}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-soft)]">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function fmtMin(s: number): string {
  return `${Math.round(s / 60)}m`;
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
