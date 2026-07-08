import SwiftUI

struct HomeScreen: View {
    @EnvironmentObject var router: Router

    private var daypart: String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
    }

    private var remaining: String {
        guard let q = router.quota else { return "…" }
        return fmtClock(q.dailyRemainingS + q.trialRemainingS)
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

                    Text("Hey \(router.userName),\nready to speak?")
                        .font(.jakarta(28, .heavy))
                        .tracking(-0.7)
                        .lineSpacing(2)
                        .foregroundStyle(Theme.ink)

                    (Text("You've got ")
                        + Text(remaining).font(.jakarta(15, .bold)).foregroundStyle(Theme.accent)
                        + Text(" of practice left today."))
                        .font(.jakarta(15))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 10)

                    // Prompt chips → scenario roleplay, same as web
                    FlowChips(items: DemoData.prompts) { label in
                        router.startTalk(scenario: label)
                    }
                    .padding(.top, 22)

                    // Talk hero — free talk, no scenario
                    Button {
                        router.startTalk()
                    } label: {
                        HStack(spacing: 15) {
                            OrbView(size: 52)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Talk to Echo")
                                    .font(.jakarta(19, .bold))
                                    .foregroundStyle(.white)
                                Text("Free-flowing conversation, your pace")
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

                    // Scenarios
                    HStack {
                        Text("Practice scenarios")
                            .font(.jakarta(18, .bold))
                            .tracking(-0.2)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Button("See all") { router.go(.history) }
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
