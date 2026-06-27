/**
 * Orb — the emotional center of Echo. A glossy coral sphere that breathes.
 *
 * Sizes used in the design:
 *   - 24 px  : header logo
 *   - 56 px  : summary screen
 *   - 64 px  : sign-in
 *   - 96 px  : compact talk surfaces (live captions)
 *   - 380 px+ : hero / talk surface
 *
 * State drives motion + tint. Sage is RESERVED for the "speaking" cue only.
 */
export type OrbState = "idle" | "listening" | "speaking" | "connecting";

export type OrbProps = {
  size?: number;
  halo?: boolean;
  state?: OrbState;
  className?: string;
};

export function Orb({
  size = 96,
  halo = false,
  state = "idle",
  className = "",
}: OrbProps) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  const connecting = state === "connecting";

  const haloColor = speaking
    ? "rgba(91,140,110,0.42)"
    : "rgba(247,203,177,0.45)";

  const coreGradient = speaking
    ? "radial-gradient(circle at 30% 28%, #E8F1EA 0%, #B6D4C0 24%, #6FA284 60%, #4A7459 100%)"
    : "radial-gradient(circle at 30% 28%, #FFE7D7 0%, #F7CBB1 22%, #E68262 55%, #C5523A 100%)";

  const coreShadow = speaking
    ? "0 28px 64px -20px rgba(74, 116, 89, 0.55), inset -8px -10px 28px rgba(45, 80, 60, 0.45), inset 8px 10px 24px rgba(232, 241, 234, 0.55)"
    : "var(--shadow-orb), inset -8px -10px 28px rgba(154, 56, 35, 0.45), inset 8px 10px 24px rgba(255, 231, 215, 0.55)";

  const coreAnim = speaking
    ? "animate-breathe"
    : listening
    ? "animate-breathe-slow"
    : connecting
    ? "animate-breathe-slow"
    : "animate-breathe";

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {halo && (
        <div
          className="absolute inset-0 rounded-full animate-breathe-slow"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${haloColor} 0%, ${haloColor.replace(/[\d.]+\)$/, "0)")} 60%)`,
            transform: "scale(1.55)",
          }}
        />
      )}

      {/* Listening rings — ripple outward to show mic is hot. */}
      {listening && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-wave"
            style={{ border: "1.5px solid rgba(221,107,78,0.55)" }}
          />
          <div
            className="absolute inset-0 rounded-full animate-wave"
            style={{
              border: "1.5px solid rgba(221,107,78,0.4)",
              animationDelay: "0.6s",
            }}
          />
        </>
      )}

      <div
        className={`absolute inset-0 rounded-full ${coreAnim}`}
        style={{ background: coreGradient, boxShadow: coreShadow }}
      />
    </div>
  );
}
