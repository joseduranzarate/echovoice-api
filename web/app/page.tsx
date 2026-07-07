import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Orb } from "./components/orb";
import { AppShell } from "./components/app-shell";
import { HomeDashboard } from "./components/home-dashboard";

export default async function Landing() {
  const { userId } = await auth();

  if (userId) {
    return (
      <AppShell>
        <HomeDashboard />
      </AppShell>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="w-full max-w-[1180px] mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Orb size={28} />
          <span className="font-display text-[22px]">Echo</span>
        </Link>
        <Link
          href="/sign-in"
          className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 w-full max-w-[1180px] mx-auto px-6 sm:px-10 grid md:grid-cols-2 gap-12 md:gap-8 items-center py-12 md:py-0">
        <section className="flex flex-col gap-7 max-w-[520px]">
          <div className="flex items-center gap-2.5">
            <span className="block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent)]">
              Voice-first practice
            </span>
          </div>

          <h1 className="font-display text-[clamp(40px,7vw,76px)] leading-[1.02]">
            Finally, somewhere to&nbsp;speak.
          </h1>

          <p className="text-[17px] leading-relaxed text-[var(--color-text-muted)] max-w-[420px]">
            Practice speaking English with a patient AI partner. Free, three
            minutes a day.
          </p>

          <div className="flex flex-wrap items-center gap-5 pt-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center h-[56px] px-9 rounded-full bg-[var(--color-btn)] text-[var(--color-btn-text)] text-[16px] font-bold hover:-translate-y-[2px] active:translate-y-0 transition-transform"
              style={{ boxShadow: "var(--shadow-pill)" }}
            >
              Start talking
            </Link>
            <span className="text-[13px] text-[var(--color-text-soft)]">
              No appointment&nbsp;·&nbsp;No judgment&nbsp;·&nbsp;Available at 2am
            </span>
          </div>
        </section>

        <section className="flex items-center justify-center md:justify-end">
          <Orb size={380} halo />
        </section>
      </main>
    </div>
  );
}
