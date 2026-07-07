/**
 * Orb — the emotional center of Echo. A glossy olive sphere that breathes.
 *
 * States:
 *   - idle / connecting : slow breathing core
 *   - listening         : spinning conic ring around the core
 *   - speaking          : ripple waves expanding outward
 */
export type OrbState = "idle" | "listening" | "speaking" | "connecting";

export type OrbProps = {
  /** px number, or any CSS size (e.g. "clamp(240px,34vh,360px)"). */
  size?: number | string;
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

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {halo && (
        <div
          className="absolute rounded-full animate-breathe-slow"
          style={{
            inset: "-12%",
            background:
              "radial-gradient(circle at 50% 42%, var(--color-glow), transparent 68%)",
            filter: "blur(20px)",
          }}
        />
      )}

      {/* Listening — spinning conic ring, masked to a thin band. */}
      {listening && (
        <div
          className="absolute rounded-full animate-spin-slow"
          style={{
            inset: "-6%",
            background:
              "conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--color-accent) 60%, transparent), transparent)",
            WebkitMask:
              "radial-gradient(circle, transparent 58%, #000 60%)",
            mask: "radial-gradient(circle, transparent 58%, #000 60%)",
          }}
        />
      )}

      {/* Speaking — ripple waves expanding outward. */}
      {speaking && (
        <>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border:
                "2px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
              animation: "wave 2.4s ease-out infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border:
                "2px solid color-mix(in srgb, var(--color-accent) 28%, transparent)",
              animation: "wave 2.4s ease-out infinite",
              animationDelay: "0.9s",
            }}
          />
        </>
      )}

      {/* Core */}
      <div
        className="absolute inset-0 rounded-full animate-breathe"
        style={{
          background:
            "radial-gradient(circle at 36% 30%, var(--color-orb-a) 0%, var(--color-orb-b) 50%, var(--color-orb-c) 100%)",
          boxShadow:
            "0 34px 80px -24px var(--color-glow), inset 0 -16px 40px rgba(60,74,30,0.45), inset 0 14px 30px rgba(240,248,220,0.55)",
        }}
      />

      {/* Specular highlight */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: "21%",
          top: "16%",
          width: "32%",
          height: "24%",
          background:
            "radial-gradient(circle at 42% 42%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
          filter: "blur(3px)",
        }}
      />
    </div>
  );
}
