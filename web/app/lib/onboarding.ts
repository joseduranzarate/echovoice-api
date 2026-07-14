/**
 * Onboarding answers live in localStorage for now. When personalization
 * actually drives the agent (Chunk 18+), move this server-side.
 */
const KEY = "echo:onboarding:v1";

export type OnboardingAnswers = {
  level: "beginner" | "intermediate" | "advanced";
  topic: "work" | "travel" | "casual" | "interviews";
  institute?: "britanico" | "icpna" | "self";
  cycle?: string | null; // e.g. "basico-7"; null for "self"
  completedAt: string;
};

export function readOnboarding(): OnboardingAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
  } catch {
    return null;
  }
}

export function writeOnboarding(a: Omit<OnboardingAnswers, "completedAt">) {
  if (typeof window === "undefined") return;
  const full: OnboardingAnswers = { ...a, completedAt: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(full));
}

export function hasOnboarded(): boolean {
  return !!readOnboarding();
}
