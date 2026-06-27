"use client";

import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { Orb } from "../components/orb";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  async function ssoFlow(strategy: "oauth_google" | "oauth_apple") {
    if (!signIn) return;
    setLoading(strategy === "oauth_google" ? "google" : "apple");
    try {
      // signIn.sso returns { error }; it does NOT throw. Must inspect result.
      const result = await signIn.sso({
        strategy,
        redirectUrl: "/",
        redirectCallbackUrl: "/sign-in/sso-callback",
      });
      if (result.error) {
        console.error("SSO flow error:", result.error);
        setLoading(null);
      }
      // On success the SDK navigates the window away — no further code runs.
    } catch (err) {
      console.error("SSO flow threw:", err);
      setLoading(null);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-7">
        <Orb size={64} />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display font-bold text-[clamp(28px,5vw,38px)] leading-[1.05]">
            Let&apos;s get you talking.
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] max-w-[320px]">
            One tap sign-in. No forms, no passwords — we keep it simple.
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 pt-2">
          <button
            onClick={() => ssoFlow("oauth_google")}
            disabled={!signIn || loading !== null}
            className="h-[56px] rounded-full bg-white border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-ink)] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 text-[15px] font-medium"
          >
            <GoogleDot />
            {loading === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <button
            onClick={() => ssoFlow("oauth_apple")}
            disabled={!signIn || loading !== null}
            className="h-[56px] rounded-full bg-white border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-ink)] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 text-[15px] font-medium"
          >
            <span className="w-5 h-5 rounded-full bg-[var(--color-ink)]" />
            {loading === "apple" ? "Opening Apple…" : "Continue with Apple"}
          </button>
        </div>

        <Link
          href="/"
          className="text-[14px] text-[var(--color-text-soft)] hover:text-[var(--color-ink)] transition-colors pt-1"
        >
          Not now
        </Link>
      </div>
    </main>
  );
}

function GoogleDot() {
  return (
    <span
      className="w-5 h-5 rounded-full"
      style={{
        background:
          "conic-gradient(from 0deg, #EA4335 0deg, #FBBC05 162deg, #34A853 270deg, #4285F4 360deg)",
      }}
    />
  );
}
