import SwiftUI

// MARK: - Orb

enum OrbState {
    case idle, listening, speaking
}

/// The Echo orb — olive radial-gradient sphere with breathe animation,
/// optional halo, listening ring and speaking waves.
struct OrbView: View {
    var size: CGFloat
    var halo: Bool = false
    var state: OrbState = .idle

    @State private var breathe = false
    @State private var spin = false
    @State private var wave = false

    var body: some View {
        ZStack {
            if halo {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Theme.glow, .clear],
                            center: .init(x: 0.5, y: 0.42),
                            startRadius: 0, endRadius: size * 0.68
                        )
                    )
                    .frame(width: size * 1.2, height: size * 1.2)
                    .blur(radius: size * 0.06)
                    .scaleEffect(breathe ? 1.12 : 1)
                    .opacity(breathe ? 0.85 : 0.5)
            }

            if state == .listening {
                Circle()
                    .stroke(
                        AngularGradient(
                            colors: [.clear, Theme.accent.opacity(0.6), .clear],
                            center: .center
                        ),
                        lineWidth: size * 0.035
                    )
                    .frame(width: size * 1.04, height: size * 1.04)
                    .rotationEffect(.degrees(spin ? 360 : 0))
                    .onAppear {
                        withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                            spin = true
                        }
                    }
            }

            if state == .speaking {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .stroke(Theme.accent.opacity(0.45 - Double(i) * 0.12), lineWidth: 2)
                        .frame(width: size, height: size)
                        .scaleEffect(wave ? 1.85 : 0.72)
                        .opacity(wave ? 0 : 0.55)
                        .animation(
                            .easeOut(duration: 2.4)
                                .repeatForever(autoreverses: false)
                                .delay(Double(i) * 0.8),
                            value: wave
                        )
                }
                .onAppear { wave = true }
            }

            // Core
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Theme.orbA, Theme.orbB, Theme.orbC],
                        center: .init(x: 0.36, y: 0.30),
                        startRadius: 0, endRadius: size * 0.75
                    )
                )
                .frame(width: size * 0.82, height: size * 0.82)
                .shadow(color: Theme.glow, radius: size * 0.14, y: size * 0.08)
                .overlay(
                    // Specular highlight
                    Ellipse()
                        .fill(
                            RadialGradient(
                                colors: [.white.opacity(0.85), .white.opacity(0)],
                                center: .init(x: 0.42, y: 0.42),
                                startRadius: 0, endRadius: size * 0.15
                            )
                        )
                        .frame(width: size * 0.32, height: size * 0.24)
                        .blur(radius: 2)
                        .offset(x: -size * 0.14, y: -size * 0.22)
                )
                .scaleEffect(breathe ? 1.04 : 0.97)
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) {
                breathe = true
            }
        }
    }
}

// MARK: - Buttons

/// Yellow CTA pill — the primary action across the app.
struct YellowPillButton: View {
    var title: String
    var height: CGFloat = 56
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.jakarta(17, .bold))
                .foregroundStyle(Theme.btnText)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(Theme.btnBg, in: Capsule())
                .shadow(color: Theme.btnShadow, radius: 15, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// Ghost text button under a CTA.
struct GhostButton: View {
    var title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.jakarta(15, .medium))
                .foregroundStyle(Theme.textSoft)
                .frame(height: 44)
        }
        .buttonStyle(.plain)
    }
}

/// Round white icon button with a soft border (back chevrons etc.).
struct CircleIconButton: View {
    var systemName: String
    var size: CGFloat = 40
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: size * 0.42, weight: .medium))
                .foregroundStyle(Theme.textMuted)
                .frame(width: size, height: size)
                .background(Circle().fill(.white))
                .overlay(Circle().stroke(Theme.chipBd, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Cards

/// White card with the design's soft border + glow shadow.
struct CardBackground: ViewModifier {
    var radius: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.cardBd, lineWidth: 1)
            )
            .shadow(color: Theme.glow.opacity(0.5), radius: 14, y: 10)
    }
}

extension View {
    func card(radius: CGFloat = 18) -> some View {
        modifier(CardBackground(radius: radius))
    }
}

// MARK: - Bottom nav

/// Floating pill tab bar shown on Home / History / Saved / Profile.
struct BottomNavBar: View {
    @EnvironmentObject var router: Router

    var body: some View {
        HStack {
            navIcon("house", .home)
            Spacer()
            navIcon("bubble.left.and.text.bubble.right", .history)
            Spacer()
            // Center talk button
            Button {
                router.go(.conversation)
            } label: {
                Image(systemName: "waveform")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Circle().fill(Theme.accent))
                    .shadow(color: Theme.glow, radius: 14, y: 10)
            }
            .buttonStyle(.plain)
            .offset(y: -8)
            Spacer()
            navIcon("bookmark", .saved)
            Spacer()
            navIcon("person", .profile)
        }
        .padding(.horizontal, 24)
        .frame(height: 66)
        .background(Capsule().fill(.white))
        .overlay(Capsule().stroke(Color(hex: 0xF3EAF0), lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 22, y: 14)
        .padding(.horizontal, 16)
    }

    private func navIcon(_ systemName: String, _ screen: Screen) -> some View {
        Button {
            router.go(screen)
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 21, weight: .regular))
                .foregroundStyle(router.screen == screen ? Theme.accent : Color(hex: 0xBCB2BE))
                .frame(width: 46, height: 46)
        }
        .buttonStyle(.plain)
    }
}
