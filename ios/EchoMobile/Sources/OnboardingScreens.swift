import SwiftUI
import ClerkKit

// MARK: - Splash

/// Splash — pink "bloom" bubbles gather, then the olive orb forms.
struct SplashScreen: View {
    @EnvironmentObject var router: Router
    @State private var orbFormed = false
    @State private var textShown = false
    @State private var haloPulse = false

    private let bubbleGradient = RadialGradient(
        colors: [Color(hex: 0xFBD0EA), Color(hex: 0xF03C9E), Color(hex: 0xAC1273)],
        center: .init(x: 0.42, y: 0.36),
        startRadius: 0, endRadius: 60
    )

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 14) {
                ZStack {
                    // Halo
                    Circle()
                        .fill(RadialGradient(colors: [Theme.glow, .clear], center: .center, startRadius: 0, endRadius: 105))
                        .frame(width: 210, height: 210)
                        .blur(radius: 10)
                        .scaleEffect(haloPulse ? 1.15 : 0.9)
                        .opacity(haloPulse ? 0.7 : 0.35)

                    // Bloom bubbles rising into the orb
                    ForEach(0..<6, id: \.self) { i in
                        BloomBubble(
                            gradient: bubbleGradient,
                            radius: [15, 12, 18, 10, 9, 13][i],
                            xOffset: [-22, 18, 0, -12, 24, 8][i],
                            duration: [2.8, 3.3, 3.0, 2.6, 3.5, 3.1][i],
                            delay: Double(i) * 0.5
                        )
                        .offset(y: 62)
                    }

                    // Wobbling core blob behind the orb
                    Circle()
                        .fill(bubbleGradient)
                        .frame(width: 92, height: 92)
                        .blur(radius: 6)
                        .scaleEffect(haloPulse ? 1.08 : 0.94)

                    // Olive orb forms on top
                    OrbView(size: 144)
                        .scaleEffect(orbFormed ? 1 : 0.55)
                        .opacity(orbFormed ? 1 : 0)
                }
                .frame(width: 230, height: 300)

                VStack(spacing: 6) {
                    Text("Echo")
                        .font(.jakarta(34, .heavy))
                        .tracking(-0.5)
                        .foregroundStyle(Theme.ink)
                    Text("Calentando tu voz…")
                        .font(.jakarta(14))
                        .foregroundStyle(Theme.sub)
                }
                .opacity(textShown ? 1 : 0)
                .offset(y: textShown ? 0 : 12)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { router.landAfterSplash() }
        .onAppear {
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                haloPulse = true
            }
            withAnimation(.spring(duration: 1.1).delay(0.8)) { orbFormed = true }
            withAnimation(.easeOut(duration: 0.7).delay(1.3)) { textShown = true }
            Task {
                try? await Task.sleep(nanoseconds: 3_200_000_000)
                if router.screen == .splash { router.landAfterSplash() }
            }
        }
    }
}

private struct BloomBubble: View {
    var gradient: RadialGradient
    var radius: CGFloat
    var xOffset: CGFloat
    var duration: Double
    var delay: Double

    @State private var up = false

    var body: some View {
        Circle()
            .fill(gradient)
            .frame(width: radius * 2, height: radius * 2)
            .blur(radius: 3)
            .offset(x: xOffset, y: up ? -74 : 54)
            .scaleEffect(up ? 0.92 : 0.3)
            .opacity(up ? 0 : 1)
            .animation(
                .easeInOut(duration: duration).repeatForever(autoreverses: false).delay(delay),
                value: up
            )
            .onAppear { up = true }
    }
}

// MARK: - Welcome

struct WelcomeScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                OrbView(size: 170, halo: true)
                    .padding(.bottom, 34)

                Text("PRÁCTICA DE VOZ PRIMERO")
                    .font(.jakarta(12, .bold))
                    .tracking(1)
                    .foregroundStyle(Theme.accent)
                    .padding(.bottom, 16)

                Text("Por fin,\nun lugar\npara hablar.")
                    .font(.jakarta(38, .heavy))
                    .tracking(-1)
                    .multilineTextAlignment(.center)
                    .lineSpacing(0)
                    .foregroundStyle(Theme.ink)

                Text("Practica tu inglés hablado con un compañero de IA paciente. Gratis, tres minutos al día.")
                    .font(.jakarta(16))
                    .lineSpacing(4)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: 280)
                    .padding(.top, 18)

                Spacer()

                VStack(spacing: 14) {
                    YellowPillButton(title: "Empieza a hablar") { router.go(.auth) }
                    Text("Sin citas · Sin juicios · Disponible a las 2am")
                        .font(.jakarta(13))
                        .foregroundStyle(Theme.sub)
                }
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
    }
}

// MARK: - Auth

struct AuthScreen: View {
    @EnvironmentObject var router: Router
    @State private var loading: String? = nil
    @State private var errorMsg: String? = nil

    private func sso(_ provider: OAuthProvider, label: String) {
        loading = label
        errorMsg = nil
        Task {
            do {
                _ = try await Clerk.shared.auth.signInWithOAuth(provider: provider)
                if Clerk.shared.user != nil {
                    // New users go through setup; returning users go home.
                    router.go(.setup)
                } else {
                    loading = nil
                }
            } catch {
                loading = nil
                errorMsg = "No se completó el inicio de sesión — inténtalo de nuevo."
            }
        }
    }

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                OrbView(size: 62)
                    .padding(.bottom, 28)

                Text("Empecemos a hablar.")
                    .font(.jakarta(30, .heavy))
                    .tracking(-0.7)
                    .foregroundStyle(Theme.ink)

                Text("Inicia sesión con un toque. Sin formularios, sin contraseñas.")
                    .font(.jakarta(15))
                    .foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: 280)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                Spacer()

                VStack(spacing: 12) {
                    if let errorMsg {
                        Text(errorMsg)
                            .font(.jakarta(13))
                            .foregroundStyle(Theme.danger)
                    }
                    ssoButton(label: loading == "Google" ? "Abriendo Google…" : "Continuar con Google") {
                        sso(.google, label: "Google")
                    } icon: {
                        AnyView(
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color(hex: 0xEA4335), Color(hex: 0xFBBC05), Color(hex: 0x34A853), Color(hex: 0x4285F4)],
                                        startPoint: .topLeading, endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 22, height: 22)
                        )
                    }
                    ssoButton(label: loading == "Apple" ? "Abriendo Apple…" : "Continuar con Apple") {
                        sso(.apple, label: "Apple")
                    } icon: {
                        AnyView(
                            Circle().fill(Theme.inkDark).frame(width: 22, height: 22)
                        )
                    }
                    GhostButton(title: "Ahora no") { router.go(.welcome) }
                        .padding(.top, 6)
                }
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
    }

    private func ssoButton(
        label: String,
        action: @escaping () -> Void,
        icon: @escaping () -> AnyView
    ) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: 12) {
                icon()
                Text(label)
                    .font(.jakarta(16, .semibold))
                    .foregroundStyle(Theme.inkDark)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Theme.chipBd, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Setup (2 questions)

struct SetupScreen: View {
    @EnvironmentObject var router: Router
    @State private var step = 0
    @State private var level: String? = nil
    @State private var topic: String? = nil

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Top bar: back + progress dots
                HStack {
                    CircleIconButton(systemName: "chevron.left", size: 42) {
                        if step == 1 { step = 0 } else { router.go(.auth) }
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        progressDot(on: true)
                        progressDot(on: step == 1)
                    }
                }
                .padding(.bottom, 24)

                Spacer()

                if step == 0 {
                    question(
                        kicker: "PREGUNTA 1 DE 2",
                        title: "¿Cuál es tu nivel actual?",
                        sub: "Solo ayuda a Echo a marcar el ritmo.",
                        options: DemoData.levels,
                        selected: level
                    ) { pick in
                        level = pick
                        withAnimation(.easeInOut(duration: 0.2)) { step = 1 }
                    }
                } else {
                    question(
                        kicker: "PREGUNTA 2 DE 2",
                        title: "¿Qué quieres practicar?",
                        sub: "Echo seguirá tu ritmo de todas formas.",
                        options: DemoData.topics,
                        selected: topic
                    ) { pick in
                        withAnimation(.easeInOut(duration: 0.2)) { topic = pick }
                    }
                }

                Spacer()

                if topic != nil {
                    YellowPillButton(title: "Entrar a Echo") {
                        // Persist server-side — the agent paces by level.
                        // level/topic hold English ids (Option.value).
                        Task { try? await router.api.updatePreferences(level: level, topic: topic) }
                        router.go(.home)
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 20)
        }
    }

    private func progressDot(on: Bool) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(on ? Theme.accent : Color(hex: 0xE7DCE3))
            .frame(width: 26, height: 4)
    }

    private func question(
        kicker: String, title: String, sub: String,
        options: [DemoData.Option], selected: String?,
        onPick: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(kicker)
                .font(.jakarta(12, .bold))
                .tracking(0.7)
                .foregroundStyle(Theme.accent)
                .padding(.bottom, 12)
            Text(title)
                .font(.jakarta(30, .heavy))
                .tracking(-0.6)
                .foregroundStyle(Theme.ink)
            Text(sub)
                .font(.jakarta(15))
                .foregroundStyle(Theme.textMuted)
                .padding(.top, 10)
                .padding(.bottom, 26)

            VStack(spacing: 11) {
                ForEach(options) { opt in
                    choiceCard(label: opt.label, selected: selected == opt.value) {
                        onPick(opt.value)
                    }
                }
            }
        }
    }

    private func choiceCard(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(label)
                    .font(.jakarta(16, .semibold))
                    .foregroundStyle(Theme.inkDark)
                Spacer()
                ZStack {
                    Circle()
                        .fill(selected ? Theme.accent : .clear)
                        .frame(width: 22, height: 22)
                    Circle()
                        .stroke(selected ? Theme.accent : Color(hex: 0xD9CFD5), lineWidth: 1.5)
                        .frame(width: 22, height: 22)
                    if selected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(.white)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(selected ? Theme.accentSoft : .white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(selected ? Theme.accent : Theme.chipBd, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
