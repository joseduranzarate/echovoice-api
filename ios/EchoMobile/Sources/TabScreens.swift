import SwiftUI

// MARK: - History

struct HistoryScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack {
                        Text("History")
                            .font(.jakarta(30, .heavy))
                            .tracking(-0.6)
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Button {
                            router.go(.conversation)
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
                        Text("Search your conversations…")
                            .font(.jakarta(15))
                        Spacer()
                    }
                    .foregroundStyle(Theme.sub)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .card(radius: 16)
                    .padding(.bottom, 26)

                    // Stats
                    HStack(spacing: 9) {
                        statCard("5", "this week", color: Theme.ink)
                        statCard("47", "minutes", color: Theme.ink)
                        statCard("26", "phrases", color: Theme.accent)
                    }
                    .padding(.bottom, 26)

                    Text("Recent conversations")
                        .font(.jakarta(13, .bold))
                        .tracking(0.2)
                        .foregroundStyle(Theme.textSoft)
                        .padding(.bottom, 12)

                    VStack(spacing: 10) {
                        ForEach(DemoData.sessions) { s in
                            sessionRow(s)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
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

    private func sessionRow(_ s: DemoData.Session) -> some View {
        Button {
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
                    Text(s.title)
                        .font(.jakarta(15, .bold))
                        .tracking(-0.2)
                        .foregroundStyle(Theme.ink)
                    Text(s.preview)
                        .font(.jakarta(13))
                        .foregroundStyle(Theme.textSoft)
                        .lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(s.date)
                        .font(.jakarta(12))
                        .foregroundStyle(Theme.sub)
                    Text(s.duration)
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

// MARK: - Saved phrases

struct SavedScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Saved phrases")
                        .font(.jakarta(30, .heavy))
                        .tracking(-0.6)
                        .foregroundStyle(Theme.ink)
                        .padding(.bottom, 6)
                    Text("The phrases you bookmarked — tap to hear Echo say them.")
                        .font(.jakarta(14))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.bottom, 24)

                    VStack(spacing: 11) {
                        ForEach(DemoData.savedPhrases) { p in
                            phraseCard(p)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
        }
    }

    private func phraseCard(_ p: DemoData.Phrase) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Text(p.phrase)
                    .font(.jakarta(16, .semibold))
                    .tracking(-0.2)
                    .lineSpacing(3)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Image(systemName: "bookmark.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.accent)
                    .padding(.top, 2)
            }
            Text(p.note)
                .font(.jakarta(13))
                .lineSpacing(3)
                .foregroundStyle(Theme.textSoft)
                .padding(.top, 7)
            Text(p.tag)
                .font(.jakarta(12, .semibold))
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 11)
                .padding(.vertical, 5)
                .background(Capsule().fill(Theme.accentSoft))
                .padding(.top, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .card(radius: 20)
    }
}

// MARK: - Profile

struct ProfileScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Identity
                    VStack(spacing: 0) {
                        OrbView(size: 76)
                            .padding(.bottom, 14)
                        Text("George")
                            .font(.jakarta(22, .heavy))
                            .tracking(-0.2)
                            .foregroundStyle(Theme.ink)
                        HStack(spacing: 5) {
                            Circle().fill(Theme.gold).frame(width: 5, height: 5)
                            Text("PREMIUM")
                                .font(.jakarta(12, .bold))
                                .tracking(0.4)
                                .foregroundStyle(Theme.gold)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Theme.goldSoft))
                        .padding(.top, 6)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 26)

                    sectionHeader("Account")
                    settingsCard {
                        settingsRow("Signed in as", value: "george@gmail.com")
                        divider
                        settingsRow("Subscription", value: "$14.99/mo", valueColor: Theme.accent, valueBold: true)
                    }
                    .padding(.bottom, 20)

                    sectionHeader("Practice")
                    settingsCard {
                        settingsRow("Language pair", value: "English", chevron: true)
                        divider
                        settingsRow("Daily reminder", value: "8:00 PM", chevron: true)
                    }
                    .padding(.bottom, 20)

                    settingsCard {
                        Button {
                            router.go(.welcome)
                        } label: {
                            Text("Sign out")
                                .font(.jakarta(15))
                                .foregroundStyle(Theme.inkDark)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 15)
                        }
                        .buttonStyle(.plain)
                        divider
                        Text("Delete account")
                            .font(.jakarta(15))
                            .foregroundStyle(Theme.danger)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 15)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 118)
            }
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
        valueColor: Color = Theme.textSoft, valueBold: Bool = false, chevron: Bool = false
    ) -> some View {
        HStack {
            Text(label)
                .font(.jakarta(15))
                .foregroundStyle(Theme.ink)
            Spacer()
            Text(value)
                .font(.jakarta(valueBold ? 14 : 15, valueBold ? .semibold : .regular))
                .foregroundStyle(valueColor)
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xC9B7C2))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
    }
}
