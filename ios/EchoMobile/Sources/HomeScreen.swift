import SwiftUI

struct HomeScreen: View {
    @EnvironmentObject var router: Router
    @State private var classTopic = ""
    @FocusState private var classFocused: Bool

    private var daypart: String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"
    }

    private var remaining: String {
        guard let q = router.quota else { return "…" }
        return fmtClock(q.dailyRemainingS + q.trialRemainingS)
    }

    // Dynamic headline: reacts to the learner's last session.
    private var headline: String {
        guard let last = router.latest, let days = daysSince(last) else {
            return "¿hablamos?"
        }
        switch days {
        case 0: return "¿otra ronda?"
        case 1:
            let mins = last.durationS / 60
            return mins >= 1 ? "ayer hablaste \(mins) min — ¿seguimos?" : "¿seguimos?"
        case 3...: return "te extrañamos — ¿hablamos?"
        default: return "¿hablamos?"
        }
    }

    private func daysSince(_ s: SessionSummary) -> Int? {
        guard let date = sessionDate(s) else { return nil }
        return Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: date),
            to: Calendar.current.startOfDay(for: Date())
        ).day
    }

    private var instituteLabel: String? {
        switch router.prefs?.institute {
        case "britanico": return "Británico"
        case "icpna": return "ICPNA"
        default: return nil
        }
    }

    private var cycleTitle: String? {
        guard let cycle = router.prefs?.cycle else { return nil }
        let parts = cycle.split(separator: "-")
        guard let band = parts.first else { return nil }
        let pretty = band.prefix(1).uppercased() + band.dropFirst()
        return parts.count > 1 ? "\(pretty) \(parts[1])" : pretty
    }

    private var prompts: [String] {
        let band = router.prefs?.cycle?.split(separator: "-").first.map(String.init)
        return band.flatMap { DemoData.bandPrompts[$0] } ?? DemoData.prompts
    }

    private func startClassTopic() {
        let topic = classTopic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !topic.isEmpty else { return }
        classFocused = false
        router.startTalk(scenario: "class: \(topic)")
    }

    private func sessionDate(_ s: SessionSummary) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return iso.date(from: s.startedAt)
            ?? ISO8601DateFormatter().date(from: s.startedAt)
    }

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack {
                        HStack(spacing: 11) {
                            OrbView(size: 44)
                            Text(daypart)
                                .font(.jakarta(15, .bold))
                                .foregroundStyle(Theme.ink)
                        }
                        Spacer()
                        CircleIconButton(systemName: "person") { router.go(.profile) }
                    }
                    .padding(.bottom, 26)

                    Text("Hola \(router.userName),\n\(headline)")
                        .font(.jakarta(28, .heavy))
                        .tracking(-0.7)
                        .lineSpacing(2)
                        .foregroundStyle(Theme.ink)

                    (Text("Te quedan ")
                        + Text(remaining).font(.jakarta(15, .bold)).foregroundStyle(Theme.accent)
                        + Text(" de práctica hoy."))
                        .font(.jakarta(15))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 10)

                    // Academy framing: their institute + ciclo
                    if let inst = instituteLabel {
                        HStack(spacing: 8) {
                            Text(cycleTitle.map { "\(inst) · \($0)" } ?? inst)
                                .font(.jakarta(12, .bold))
                                .foregroundStyle(Theme.accentDeep)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 5)
                                .background(Capsule().fill(Theme.accentSoft))
                                .overlay(Capsule().stroke(Theme.accent, lineWidth: 1))
                            Text("Tu práctica de speaking")
                                .font(.jakarta(13))
                                .foregroundStyle(Theme.textMuted)
                        }
                        .padding(.top, 12)

                        // Practice what their class is covering this week
                        HStack(spacing: 10) {
                            Image(systemName: "book")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.accent)
                            TextField(
                                "¿Qué estás viendo en clase?",
                                text: $classTopic
                            )
                            .font(.jakarta(14))
                            .focused($classFocused)
                            .submitLabel(.go)
                            .onSubmit { startClassTopic() }
                            Button {
                                startClassTopic()
                            } label: {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(Theme.btnText)
                                    .frame(width: 38, height: 38)
                                    .background(Circle().fill(Theme.btnBg))
                            }
                            .buttonStyle(.plain)
                            .disabled(classTopic.trimmingCharacters(in: .whitespaces).isEmpty)
                            .opacity(classTopic.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
                        }
                        .padding(.leading, 16)
                        .padding(.trailing, 7)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(classFocused ? Theme.accent : Theme.chipBdSoft, lineWidth: 1.5)
                        )
                        .padding(.top, 14)
                    }

                    // Prompt chips → scenario roleplay (ciclo-aware for academy)
                    FlowChips(items: prompts) { label in
                        router.startTalk(scenario: label)
                    }
                    .padding(.top, 22)

                    // Exam chips → structured mock-exam prompts
                    HStack(spacing: 9) {
                        ForEach(DemoData.exams) { e in
                            Button {
                                router.startTalk(scenario: e.value)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "graduationcap")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text(e.label)
                                        .font(.jakarta(14, .semibold))
                                    Text("EXAMEN")
                                        .font(.jakarta(10, .bold))
                                        .tracking(0.5)
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 2)
                                        .background(
                                            RoundedRectangle(cornerRadius: 4).fill(Theme.accent)
                                        )
                                }
                                .foregroundStyle(Theme.accentDeep)
                                .padding(.horizontal, 15)
                                .padding(.vertical, 11)
                                .background(Capsule().fill(Theme.accentSoft))
                                .overlay(Capsule().stroke(Theme.accent, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 9)

                    // Talk hero — free talk, no scenario
                    Button {
                        router.startTalk()
                    } label: {
                        HStack(spacing: 15) {
                            OrbView(size: 52)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Habla con Echo")
                                    .font(.jakarta(19, .bold))
                                    .foregroundStyle(.white)
                                Text("Conversación libre, a tu ritmo")
                                    .font(.jakarta(13))
                                    .foregroundStyle(.white.opacity(0.6))
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 38, height: 38)
                                .background(Circle().fill(Theme.accent))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 18)
                        .background(
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .fill(Theme.inkDark)
                        )
                        .shadow(color: Theme.inkDark.opacity(0.7), radius: 22, y: 14)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 24)

                    // Your activity — resume the last conversation with memory
                    if let last = router.latest {
                        HStack {
                            Text("Tu actividad")
                                .font(.jakarta(18, .bold))
                                .tracking(-0.2)
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Button("Historial") { router.go(.history) }
                                .font(.jakarta(14, .semibold))
                                .foregroundStyle(Theme.accent)
                                .buttonStyle(.plain)
                        }
                        .padding(.top, 30)
                        .padding(.bottom, 14)

                        resumeCard(last)
                    }

                    // Scenarios
                    HStack {
                        Text("Escenarios de práctica")
                            .font(.jakarta(18, .bold))
                            .tracking(-0.2)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Button("Ver todo") { router.go(.history) }
                            .font(.jakarta(14, .semibold))
                            .foregroundStyle(Theme.accent)
                            .buttonStyle(.plain)
                    }
                    .padding(.top, 30)
                    .padding(.bottom, 14)

                    HStack(spacing: 12) {
                        ForEach(DemoData.scenarios) { s in
                            scenarioCard(s)
                        }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
    }

    private func resumeCard(_ s: SessionSummary) -> some View {
        Button {
            router.startTalk(resume: s)
        } label: {
            HStack(spacing: 14) {
                OrbView(size: 52)
                VStack(alignment: .leading, spacing: 3) {
                    Text("RETOMA DONDE LO DEJASTE")
                        .font(.jakarta(10, .bold))
                        .tracking(0.9)
                        .foregroundStyle(.white.opacity(0.5))
                    Text(s.title ?? "Tu última conversación")
                        .font(.jakarta(17, .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(resumeMeta(s))
                        .font(.jakarta(13))
                        .foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Image(systemName: "play.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.btnText)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.btnBg))
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Theme.inkDark)
            )
            .shadow(color: Theme.inkDark.opacity(0.6), radius: 18, y: 12)
        }
        .buttonStyle(.plain)
    }

    private func resumeMeta(_ s: SessionSummary) -> String {
        var parts: [String] = []
        if let date = sessionDate(s) {
            if Calendar.current.isDateInToday(date) {
                parts.append("Hoy")
            } else if Calendar.current.isDateInYesterday(date) {
                parts.append("Ayer")
            } else {
                let f = DateFormatter()
                f.locale = Locale(identifier: "es")
                f.dateFormat = "d MMM"
                parts.append(f.string(from: date))
            }
        }
        parts.append("\(max(1, s.durationS / 60)) min")
        if let c = s.correctionCount, c > 0 {
            parts.append("\(c) correcci\(c == 1 ? "ón" : "ones")")
        }
        return parts.joined(separator: " · ")
    }

    private func scenarioCard(_ s: DemoData.Scenario) -> some View {
        Button {
            router.startTalk(scenario: "\(s.title) — \(s.desc)")
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(s.emoji)
                    .font(.system(size: 22))
                    .frame(width: 46, height: 46)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color(hex: s.bg))
                    )
                Text(s.title)
                    .font(.jakarta(16, .bold))
                    .tracking(-0.2)
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 14)
                Text(s.desc)
                    .font(.jakarta(13))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.textSoft)
                    .padding(.top, 5)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 18)
            .card(radius: 22)
        }
        .buttonStyle(.plain)
    }
}

/// Wrapping chip row (simple two-row flow for the five demo prompts).
struct FlowChips: View {
    var items: [String]
    var onTap: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            let rows = splitRows()
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 9) {
                    ForEach(rows[r], id: \.self) { label in
                        Button(action: { onTap(label) }) {
                            Text(label)
                                .font(.jakarta(14, .medium))
                                .foregroundStyle(Theme.textBody)
                                .padding(.horizontal, 17)
                                .padding(.vertical, 11)
                                .background(Capsule().fill(.white))
                                .overlay(Capsule().stroke(Theme.chipBdSoft, lineWidth: 1))
                                .shadow(color: Theme.glow.opacity(0.4), radius: 10, y: 6)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func splitRows() -> [[String]] {
        var rows: [[String]] = [[]]
        var width: CGFloat = 0
        for item in items {
            let w = CGFloat(item.count) * 8 + 44
            if width + w > 360, !rows[rows.count - 1].isEmpty {
                rows.append([])
                width = 0
            }
            rows[rows.count - 1].append(item)
            width += w
        }
        return rows
    }
}
