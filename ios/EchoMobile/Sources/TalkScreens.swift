import SwiftUI

// MARK: - Conversation (voice orb — real LiveKit call)

struct ConversationScreen: View {
    @EnvironmentObject var router: Router
    @EnvironmentObject var call: CallController

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar
                HStack {
                    CircleIconButton(systemName: "chevron.left") {
                        Task { _ = await call.end(); router.go(.home) }
                    }
                    Spacer()
                    HStack(spacing: 7) {
                        Image(systemName: "clock")
                            .font(.system(size: 13, weight: .medium))
                        Text(quotaLabel)
                            .font(.jakarta(14, .semibold))
                    }
                    .foregroundStyle(Theme.textSoft)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(.white))
                    .overlay(Capsule().stroke(Theme.chipBdSoft, lineWidth: 1))
                    Spacer()
                    CircleIconButton(systemName: "captions.bubble") {
                        if call.phase == .live { router.go(.live) }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 8)

                // Scenario / resume badge
                if let badge = badgeLabel {
                    Text(badge)
                        .font(.jakarta(12, .semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Theme.accentSoft))
                        .overlay(Capsule().stroke(Theme.accent, lineWidth: 1))
                        .padding(.top, 10)
                        .lineLimit(1)
                        .padding(.horizontal, 30)
                }

                Spacer()

                OrbView(size: 230, halo: true, state: orbState)
                    .id(orbState)
                    .contentShape(Circle())
                    .onTapGesture { startIfIdle() }

                HStack(spacing: 8) {
                    Circle()
                        .fill(stateColor)
                        .frame(width: 7, height: 7)
                    Text(stateLabel)
                        .font(.jakarta(14, .semibold))
                        .foregroundStyle(stateColor)
                    if call.phase == .live {
                        Text("· \(fmtClock(call.elapsedS))")
                            .font(.jakarta(14))
                            .foregroundStyle(Theme.sub)
                    }
                }
                .padding(.top, 30)

                Spacer()

                // Controls
                HStack(spacing: 14) {
                    if call.phase == .idle || call.isError {
                        YellowPillButton(title: call.isError ? "Intentar de nuevo" : "Empezar a hablar") {
                            startIfIdle()
                        }
                        .frame(maxWidth: 260)
                    } else {
                        Button {
                            call.toggleMic()
                        } label: {
                            Image(systemName: call.micOn ? "mic" : "mic.slash")
                                .font(.system(size: 19, weight: .medium))
                                .foregroundStyle(call.micOn ? Color(hex: 0x3A3742) : Theme.danger)
                                .frame(width: 54, height: 54)
                                .background(Circle().fill(.white))
                                .overlay(Circle().stroke(Theme.chipBd, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(call.phase != .live)

                        Button {
                            finishCall()
                        } label: {
                            Text("Terminar")
                                .font(.jakarta(16, .bold))
                                .foregroundStyle(Theme.btnText)
                                .padding(.horizontal, 44)
                                .frame(height: 54)
                                .background(Capsule().fill(Theme.btnBg))
                                .shadow(color: Theme.btnShadow, radius: 15, y: 8)
                        }
                        .buttonStyle(.plain)
                        .disabled(call.phase != .live)
                    }
                }
                .padding(.bottom, 42)
            }
        }
        .onChange(of: call.quotaExhausted) { _, exhausted in
            if exhausted { router.go(.paywall) }
        }
    }

    private var badgeLabel: String? {
        if let scenario = router.pendingScenario { return formatScenario(scenario) }
        if let resume = router.pendingResume {
            return "Continuando: \(resume.title ?? "tu última conversación")"
        }
        return nil
    }

    private func startIfIdle() {
        guard call.phase == .idle || call.isError else { return }
        Task {
            await call.start(
                api: router.api,
                scenario: router.pendingScenario,
                resumeSessionId: router.pendingResume?.id
            )
        }
    }

    private func finishCall() {
        Task {
            _ = await call.end()
            router.pendingScenario = nil
            router.pendingResume = nil
            router.refreshLatest()
            router.go(.summary)
        }
    }

    private var quotaLabel: String {
        guard let q = router.quota else { return "…" }
        return "\(fmtClock(q.dailyRemainingS + q.trialRemainingS)) restantes hoy"
    }

    private var orbState: OrbState {
        switch call.phase {
        case .live:
            switch call.voice {
            case .speaking: return .speaking
            case .listening: return .listening
            case .idle: return .idle
            }
        default:
            return .idle
        }
    }

    private var stateLabel: String {
        switch call.phase {
        case .idle: return "Toca el orbe para empezar"
        case .connecting: return "Conectando…"
        case .waking: return "Despertando a Echo…"
        case .ending: return "Terminando…"
        case .error(let m): return m
        case .live:
            switch call.voice {
            case .speaking: return "Echo está hablando"
            case .listening: return call.micOn ? "Escuchando…" : "Micrófono apagado"
            case .idle: return "Tómate tu tiempo"
            }
        }
    }

    private var stateColor: Color {
        if call.isError { return Theme.danger }
        switch call.phase {
        case .live where call.voice == .speaking: return Theme.sage
        case .live: return Theme.accent
        default: return Color(hex: 0xA8A0A6)
        }
    }
}

// MARK: - Live transcript (real captions during the call)

struct LiveTranscriptScreen: View {
    @EnvironmentObject var router: Router
    @EnvironmentObject var call: CallController
    @State private var blink = false

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    CircleIconButton(systemName: "chevron.left") { router.go(.conversation) }
                    Spacer()
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 6, height: 6)
                            .opacity(blink ? 1 : 0.3)
                        Text("Transcripción en vivo")
                            .font(.jakarta(12, .semibold))
                            .foregroundStyle(Color(hex: 0x3A3742))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(.white))
                    .overlay(Capsule().stroke(Theme.chipBdSoft, lineWidth: 1))
                    Spacer()
                    Color.clear.frame(width: 40, height: 40)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                OrbView(size: 96, halo: true, state: call.voice == .speaking ? .speaking : .idle)
                    .padding(.vertical, 8)

                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 14) {
                            ForEach(call.turns) { t in
                                bubble(t.text, isYou: t.role == "user")
                            }
                            if call.phase == .live {
                                liveLine
                            }
                            if call.phase != .live && call.turns.isEmpty {
                                Text("Inicia una conversación para ver la transcripción aquí.")
                                    .font(.jakarta(13))
                                    .foregroundStyle(Theme.sub)
                                    .padding(8)
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                    .onChange(of: call.userLine) { proxy.scrollTo("bottom", anchor: .bottom) }
                    .onChange(of: call.echoLine) { proxy.scrollTo("bottom", anchor: .bottom) }
                }

                HStack(spacing: 14) {
                    Button {
                        call.toggleMic()
                    } label: {
                        Image(systemName: call.micOn ? "mic" : "mic.slash")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(call.micOn ? Color(hex: 0x3A3742) : Theme.danger)
                            .frame(width: 52, height: 52)
                            .background(Circle().fill(.white))
                            .overlay(Circle().stroke(Theme.chipBd, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(call.phase != .live)

                    Button {
                        Task {
                            _ = await call.end()
                            router.refreshLatest()
                            router.go(.summary)
                        }
                    } label: {
                        Text("Terminar")
                            .font(.jakarta(16, .bold))
                            .foregroundStyle(Theme.btnText)
                            .padding(.horizontal, 40)
                            .frame(height: 52)
                            .background(Capsule().fill(Theme.btnBg))
                            .shadow(color: Theme.btnShadow, radius: 15, y: 8)
                    }
                    .buttonStyle(.plain)
                    .disabled(call.phase != .live)
                }
                .padding(.top, 8)
                .padding(.bottom, 42)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                blink = true
            }
        }
    }

    @ViewBuilder
    private var liveLine: some View {
        let isYou = !call.userLine.isEmpty && call.echoLine.isEmpty
            || call.turns.last?.role == "assistant"
        let text = isYou ? call.userLine : call.echoLine
        if !text.isEmpty {
            bubble(text + " ▍", isYou: isYou)
        }
    }

    private func bubble(_ text: String, isYou: Bool) -> some View {
        HStack {
            if isYou { Spacer(minLength: 50) }
            if isYou {
                Text(text)
                    .font(.jakarta(15))
                    .lineSpacing(3)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(
                        UnevenRoundedRectangle(
                            topLeadingRadius: 20, bottomLeadingRadius: 20,
                            bottomTrailingRadius: 6, topTrailingRadius: 20,
                            style: .continuous
                        )
                        .fill(Theme.accent)
                    )
                    .shadow(color: Theme.glow, radius: 12, y: 8)
            } else {
                Text(text)
                    .font(.jakarta(15))
                    .lineSpacing(4)
                    .foregroundStyle(Theme.textBody)
            }
            if !isYou { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: isYou ? .trailing : .leading)
    }
}

func fmtClock(_ s: Int) -> String {
    "\(s / 60):" + String(format: "%02d", s % 60)
}

func formatScenario(_ s: String) -> String {
    switch s {
    case "exam:ielts-speaking": return "Examen de práctica: IELTS Speaking"
    case "exam:toefl-speaking": return "Examen de práctica: TOEFL Speaking"
    default:
        if s.lowercased().hasPrefix("class:") {
            return "Tu clase: \(s.dropFirst(6).trimmingCharacters(in: .whitespaces))"
        }
        return "Practicando: \(s)"
    }
}
