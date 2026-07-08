import SwiftUI
import UIKit

// MARK: - Session detail (real transcript + corrections)

struct SessionDetailScreen: View {
    @EnvironmentObject var router: Router

    @State private var session: SessionSummary?
    @State private var turns: [TranscriptTurn]?
    @State private var savedTurnIDs: Set<Int> = []
    @State private var failed = false

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack(spacing: 12) {
                        CircleIconButton(systemName: "chevron.left") { router.go(.history) }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(session?.title ?? "Conversación")
                                .font(.jakarta(21, .heavy))
                                .tracking(-0.4)
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                            Text(metaLine)
                                .font(.jakarta(13))
                                .foregroundStyle(Theme.textSoft)
                        }
                    }
                    .padding(.bottom, 18)

                    // Stats strip
                    if let s = session {
                        HStack(spacing: 14) {
                            if let w = s.wordCount {
                                statPair("\(w)", "palabras")
                            }
                            statPair("\(s.durationS / 60)", "min")
                            if let c = s.correctionCount, c > 0 {
                                (Text("\(c)").font(.jakarta(13, .bold))
                                    + Text(" correcciones").font(.jakarta(13)))
                                    .foregroundStyle(Theme.accent)
                            }
                            Spacer()
                        }
                        .padding(.top, 6)
                        .padding(.bottom, 18)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(Theme.chipBdSoft).frame(height: 1)
                        }
                        .padding(.bottom, 22)
                    }

                    if failed {
                        Text("No pudimos cargar esta conversación.")
                            .font(.jakarta(14))
                            .foregroundStyle(Theme.danger)
                    } else if let turns {
                        if turns.isEmpty {
                            Text("No se grabó transcripción para esta conversación.")
                                .font(.jakarta(14))
                                .foregroundStyle(Theme.textMuted)
                        } else {
                            VStack(spacing: 18) {
                                ForEach(turns) { t in
                                    if t.role == "user" {
                                        userTurn(t)
                                    } else {
                                        echoTurn(t)
                                    }
                                }
                            }
                        }
                    } else {
                        ProgressView().padding(.top, 40).frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
        }
        .task(id: router.selectedSessionID) { await load() }
    }

    private var metaLine: String {
        guard let s = session else { return " " }
        return "\(fmtDate(s.startedAt)) · \(max(1, s.durationS / 60)) min"
    }

    private func load() async {
        guard let id = router.selectedSessionID else {
            failed = true
            return
        }
        do {
            async let s = router.api.session(id: id)
            async let t = router.api.transcript(sessionId: id)
            session = try await s
            turns = try await t
        } catch {
            failed = true
        }
    }

    private func savePhrase(_ t: TranscriptTurn) {
        guard let c = t.correction, !savedTurnIDs.contains(t.id) else { return }
        Task {
            _ = try? await router.api.savePhrase(
                c.to,
                note: "En lugar de “\(c.from)”.",
                tag: "Corrección",
                sessionId: router.selectedSessionID
            )
            savedTurnIDs.insert(t.id)
        }
    }

    private func statPair(_ value: String, _ label: String) -> some View {
        (Text(value).font(.jakarta(13, .bold)).foregroundStyle(Theme.inkDark)
            + Text(" \(label)").font(.jakarta(13)).foregroundStyle(Theme.textMuted))
    }

    private func userTurn(_ t: TranscriptTurn) -> some View {
        HStack {
            Spacer(minLength: 50)
            VStack(alignment: .trailing, spacing: 8) {
                Text(t.text)
                    .font(.jakarta(15))
                    .lineSpacing(3)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 17)
                    .padding(.vertical, 13)
                    .background(
                        UnevenRoundedRectangle(
                            topLeadingRadius: 22, bottomLeadingRadius: 22,
                            bottomTrailingRadius: 6, topTrailingRadius: 22,
                            style: .continuous
                        )
                        .fill(Theme.accent)
                    )
                    .shadow(color: Theme.glow, radius: 12, y: 8)

                if let c = t.correction {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text("CORRECCIÓN SUAVE")
                                .font(.jakarta(11, .bold))
                                .tracking(0.6)
                                .foregroundStyle(Theme.accent)
                            Spacer()
                            Button {
                                savePhrase(t)
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: savedTurnIDs.contains(t.id) ? "bookmark.fill" : "bookmark")
                                        .font(.system(size: 11, weight: .semibold))
                                    Text(savedTurnIDs.contains(t.id) ? "Guardada" : "Guardar frase")
                                        .font(.jakarta(12, .semibold))
                                }
                                .foregroundStyle(Theme.accent)
                            }
                            .buttonStyle(.plain)
                            .disabled(savedTurnIDs.contains(t.id))
                        }
                        (Text(c.from).strikethrough().foregroundStyle(Color(hex: 0xA9A38C))
                            + Text("  →  ").foregroundStyle(Color(hex: 0xC4BEA6))
                            + Text(c.to).font(.jakarta(14, .semibold)).foregroundStyle(Theme.inkDark))
                            .font(.jakarta(14))
                            .lineSpacing(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Theme.accentSoft)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color(hex: 0xDBDBBE), lineWidth: 1)
                    )
                }
            }
            .frame(maxWidth: 300, alignment: .trailing)
        }
    }

    private func echoTurn(_ t: TranscriptTurn) -> some View {
        HStack {
            HStack(alignment: .top, spacing: 12) {
                OrbView(size: 34)
                Text(t.text)
                    .font(.jakarta(15))
                    .lineSpacing(4)
                    .foregroundStyle(Theme.textBody)
            }
            Spacer(minLength: 40)
        }
    }
}

// MARK: - Summary (real, from /sessions/latest)

struct SummaryScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                OrbView(size: 54)
                    .padding(.bottom, 24)

                Text(headline)
                    .font(.jakarta(34, .heavy))
                    .tracking(-0.8)
                    .foregroundStyle(Theme.ink)
                Text(sub)
                    .font(.jakarta(16))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                if let s = router.latest, let t = s.title {
                    Text("“\(t)”")
                        .font(.jakarta(13, .semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Theme.accentSoft))
                        .padding(.top, 10)
                }

                if let s = router.latest {
                    HStack(spacing: 12) {
                        statCard("\(s.wordCount ?? s.durationS / 3)", "palabras dichas", valueColor: Theme.ink)
                        statCard("\(s.correctionCount ?? 0)", "correcciones", valueColor: Theme.accent)
                    }
                    .padding(.top, 28)
                }

                Spacer()

                if router.latest != nil {
                    YellowPillButton(title: "Ver transcripción") {
                        router.selectedSessionID = router.latest?.id
                        router.go(.session)
                    }
                }
                GhostButton(title: "Volver al inicio") { router.go(.home) }
                    .padding(.top, 12)
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
        .onAppear {
            router.refreshLatest()
            router.refreshQuota()
        }
    }

    private var headline: String {
        (router.latest?.durationS ?? 0) >= 30 ? "¡Buen trabajo!" : "Esa fue corta."
    }

    private var sub: String {
        guard let s = router.latest else { return "Cargando tu sesión…" }
        let m = s.durationS / 60
        return m > 0 ? "Hoy hablaste \(m) minuto\(m == 1 ? "" : "s")." : "Hablaste \(s.durationS) segundos."
    }

    private func statCard(_ value: String, _ label: String, valueColor: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.jakarta(30, .heavy))
                .tracking(-0.6)
                .foregroundStyle(valueColor)
            Text(label)
                .font(.jakarta(13))
                .foregroundStyle(Theme.textSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .card(radius: 20)
    }
}

// MARK: - Paywall (real Stripe checkout via API)

struct PaywallScreen: View {
    @EnvironmentObject var router: Router
    @State private var loading = false
    @State private var errorMsg: String? = nil

    private let perks = [
        "30 minutos de práctica al día",
        "Transcripción en vivo e historial guardado",
        "Correcciones suaves después de cada charla",
    ]

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                Text("ESOS FUERON TUS 3 MINUTOS DE HOY")
                    .font(.jakarta(12, .bold))
                    .tracking(0.7)
                    .foregroundStyle(Theme.accent)
                    .padding(.bottom, 14)

                Text("Diste todo por hoy.")
                    .font(.jakarta(30, .heavy))
                    .tracking(-0.7)
                    .foregroundStyle(Theme.ink)

                Text("Echo vuelve a medianoche — o desbloquea más ahora mismo.")
                    .font(.jakarta(16))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: 290)
                    .padding(.top, 12)

                // Premium card
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Echo Premium")
                            .font(.jakarta(22, .heavy))
                            .tracking(-0.4)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        (Text("$14.99").font(.jakarta(13, .bold)).foregroundStyle(Theme.inkDark)
                            + Text("/mo").font(.jakarta(13)).foregroundStyle(Theme.textSoft))
                    }
                    Rectangle()
                        .fill(Theme.chipBdSoft)
                        .frame(height: 1)
                        .padding(.vertical, 16)
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(perks, id: \.self) { p in
                            HStack(spacing: 11) {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundStyle(Theme.accent)
                                Text(p)
                                    .font(.jakarta(14))
                                    .foregroundStyle(Color(hex: 0x3A3742))
                            }
                        }
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card(radius: 22)
                .padding(.top, 26)

                if let errorMsg {
                    Text(errorMsg)
                        .font(.jakarta(13))
                        .foregroundStyle(Theme.danger)
                        .padding(.top, 10)
                }

                Spacer()

                YellowPillButton(title: loading ? "Abriendo el pago…" : "Desbloquear Premium") {
                    upgrade()
                }
                GhostButton(title: "Nos vemos mañana") { router.go(.home) }
                    .padding(.top, 12)
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
    }

    private func upgrade() {
        guard !loading else { return }
        loading = true
        errorMsg = nil
        Task {
            do {
                let url = try await router.api.checkoutURL()
                await UIApplication.shared.open(url)
            } catch {
                errorMsg = "No pudimos abrir el pago. Inténtalo en un momento."
            }
            loading = false
        }
    }
}

func fmtDate(_ iso: String) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
    return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}
