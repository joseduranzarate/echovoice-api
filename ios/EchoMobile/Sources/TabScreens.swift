import SwiftUI

// MARK: - History (real sessions)

struct HistoryScreen: View {
    @EnvironmentObject var router: Router
    @State private var query = ""

    private var filtered: [SessionSummary] {
        let all = router.sessions
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return all }
        let q = query.lowercased()
        return all.filter {
            ($0.title ?? "").lowercased().contains(q)
                || ($0.preview ?? "").lowercased().contains(q)
        }
    }

    private var weekStats: (count: Int, minutes: Int) {
        let weekAgo = Date().addingTimeInterval(-7 * 24 * 3600)
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let recent = router.sessions.filter {
            (f.date(from: $0.startedAt) ?? .distantPast) >= weekAgo
        }
        return (recent.count, recent.reduce(0) { $0 + $1.durationS } / 60)
    }

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("Historial")
                            .font(.jakarta(30, .heavy))
                            .tracking(-0.6)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Button {
                            router.startTalk()
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 19, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 48, height: 48)
                                .background(Circle().fill(Theme.accent))
                                .shadow(color: Theme.glow, radius: 15, y: 8)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.bottom, 20)

                    // Search
                    HStack(spacing: 11) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Theme.sub)
                        TextField("Busca tus conversaciones…", text: $query)
                            .font(.jakarta(15))
                            .autocorrectionDisabled()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .card(radius: 16)
                    .padding(.bottom, 26)

                    // Stats
                    HStack(spacing: 9) {
                        statCard("\(weekStats.count)", "esta semana", color: Theme.ink)
                        statCard("\(weekStats.minutes)", "minutos", color: Theme.ink)
                        statCard("\(router.sessions.count)", "total", color: Theme.accent)
                    }
                    .padding(.bottom, 26)

                    Text("Conversaciones recientes")
                        .font(.jakarta(13, .bold))
                        .tracking(0.2)
                        .foregroundStyle(Theme.textSoft)
                        .padding(.bottom, 12)

                    if router.sessions.isEmpty {
                        Text("Tus conversaciones aparecerán aquí cuando empieces a hablar.")
                            .font(.jakarta(14))
                            .foregroundStyle(Theme.textMuted)
                            .padding(.vertical, 12)
                    } else {
                        VStack(spacing: 10) {
                            ForEach(filtered) { s in
                                sessionRow(s)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
        .onAppear { router.refreshSessions() }
    }

    private func statCard(_ value: String, _ label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.jakarta(24, .heavy))
                .tracking(-0.4)
                .foregroundStyle(color)
            Text(label)
                .font(.jakarta(12))
                .foregroundStyle(Theme.textSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .card(radius: 18)
    }

    private func sessionRow(_ s: SessionSummary) -> some View {
        Button {
            router.selectedSessionID = s.id
            router.go(.session)
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "text.bubble")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 42, height: 42)
                    .background(
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .fill(Theme.accentSoft)
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.title ?? fmtDate(s.startedAt))
                        .font(.jakarta(15, .bold))
                        .tracking(-0.2)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text(s.preview ?? "Conversación de \(max(1, s.durationS / 60)) min")
                        .font(.jakarta(13))
                        .foregroundStyle(Theme.textSoft)
                        .lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(fmtDate(s.startedAt))
                        .font(.jakarta(12))
                        .foregroundStyle(Theme.sub)
                    Text("\(max(1, s.durationS / 60)) min")
                        .font(.jakarta(11))
                        .foregroundStyle(Theme.textSoft)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .card(radius: 18)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Saved phrases (real)

struct SavedScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Frases guardadas")
                        .font(.jakarta(30, .heavy))
                        .tracking(-0.6)
                        .foregroundStyle(Theme.ink)
                        .padding(.bottom, 6)
                    Text("Las frases que guardaste de tus conversaciones.")
                        .font(.jakarta(14))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.bottom, 24)

                    if router.phrases.isEmpty {
                        emptyState
                    } else {
                        VStack(spacing: 11) {
                            ForEach(router.phrases) { p in
                                phraseCard(p)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
        .onAppear { router.refreshPhrases() }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "bookmark")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(Theme.accent)
                .frame(width: 52, height: 52)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Theme.accentSoft)
                )
            Text("Aún no has guardado nada")
                .font(.jakarta(18, .bold))
                .foregroundStyle(Theme.ink)
            Text("Cuando Echo te corrija suavemente, abre la transcripción y toca “Guardar frase”.")
                .font(.jakarta(14))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textSoft)
                .frame(maxWidth: 300)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .card(radius: 24)
    }

    private func phraseCard(_ p: SavedPhrase) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Text(p.phrase)
                    .font(.jakarta(16, .semibold))
                    .tracking(-0.2)
                    .lineSpacing(3)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Button {
                    Task {
                        try? await router.api.deletePhrase(id: p.id)
                        router.refreshPhrases()
                    }
                } label: {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.accent)
                }
                .buttonStyle(.plain)
            }
            if let note = p.note {
                Text(note)
                    .font(.jakarta(13))
                    .lineSpacing(3)
                    .foregroundStyle(Theme.textSoft)
                    .padding(.top, 7)
            }
            if let tag = p.tag {
                Text(tag)
                    .font(.jakarta(12, .semibold))
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Theme.accentSoft))
                    .padding(.top, 12)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .card(radius: 20)
    }
}

// MARK: - Profile (real account)

struct ProfileScreen: View {
    @EnvironmentObject var router: Router
    @State private var deleteArmed = false
    @State private var deleting = false

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Identity
                    VStack(spacing: 0) {
                        OrbView(size: 76)
                            .padding(.bottom, 14)
                        Text(router.userName)
                            .font(.jakarta(22, .heavy))
                            .tracking(-0.2)
                            .foregroundStyle(Theme.ink)
                        HStack(spacing: 5) {
                            Circle()
                                .fill(router.isPremium ? Theme.accent : Theme.gold)
                                .frame(width: 5, height: 5)
                            Text(router.isPremium ? "PREMIUM" : "PLAN GRATIS")
                                .font(.jakarta(12, .bold))
                                .tracking(0.4)
                                .foregroundStyle(router.isPremium ? Theme.accent : Theme.gold)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(
                            Capsule().fill(router.isPremium ? Theme.accentSoft : Theme.goldSoft)
                        )
                        .padding(.top, 6)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 26)

                    sectionHeader("Cuenta")
                    settingsCard {
                        settingsRow("Sesión iniciada como", value: router.userEmail)
                        divider
                        settingsRow(
                            "Plan",
                            value: router.isPremium ? "Premium · 30 min/día" : "Gratis · 3 min/día",
                            valueColor: Theme.accent, valueBold: true
                        )
                    }
                    .padding(.bottom, 20)

                    sectionHeader("Práctica")
                    settingsCard {
                        settingsRow("Idioma", value: "Inglés")
                        divider
                        settingsRow("Voz", value: "Echo (predeterminada)")
                    }
                    .padding(.bottom, 20)

                    settingsCard {
                        Button {
                            router.signOut()
                        } label: {
                            Text("Cerrar sesión")
                                .font(.jakarta(15))
                                .foregroundStyle(Theme.inkDark)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 15)
                        }
                        .buttonStyle(.plain)
                        divider
                        Button {
                            handleDelete()
                        } label: {
                            Text(deleteLabel)
                                .font(.jakarta(15))
                                .foregroundStyle(Theme.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 15)
                        }
                        .buttonStyle(.plain)
                        .disabled(deleting)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
        .onAppear { router.refreshQuota() }
    }

    private var deleteLabel: String {
        if deleting { return "Eliminando tu cuenta…" }
        if deleteArmed { return "¿Estás seguro? Toca de nuevo para eliminar todo permanentemente" }
        return "Eliminar cuenta"
    }

    private func handleDelete() {
        if !deleteArmed {
            deleteArmed = true
            return
        }
        deleting = true
        Task {
            await router.deleteAccount()
            deleting = false
            deleteArmed = false
        }
    }

    private var divider: some View {
        Rectangle().fill(Color(hex: 0xF4EBF0)).frame(height: 1).padding(.leading, 16)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.jakarta(13, .bold))
            .foregroundStyle(Theme.textSoft)
            .padding(.horizontal, 4)
            .padding(.bottom, 10)
    }

    private func settingsCard(@ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: 0) { content() }
            .card(radius: 18)
    }

    private func settingsRow(
        _ label: String, value: String,
        valueColor: Color = Theme.textSoft, valueBold: Bool = false
    ) -> some View {
        HStack {
            Text(label)
                .font(.jakarta(15))
                .foregroundStyle(Theme.ink)
            Spacer()
            Text(value)
                .font(.jakarta(valueBold ? 14 : 15, valueBold ? .semibold : .regular))
                .foregroundStyle(valueColor)
                .lineLimit(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
    }
}
