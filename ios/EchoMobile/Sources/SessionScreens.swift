import SwiftUI

// MARK: - Session detail (transcript + corrections)

struct SessionDetailScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.tabGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack(spacing: 12) {
                        CircleIconButton(systemName: "chevron.left") { router.go(.history) }
                        VStack(alignment: .leading, spacing: 1) {
                            Text("A trip to the market")
                                .font(.jakarta(21, .heavy))
                                .tracking(-0.4)
                                .foregroundStyle(Theme.ink)
                            Text("Today · 6 min")
                                .font(.jakarta(13))
                                .foregroundStyle(Theme.textSoft)
                        }
                    }
                    .padding(.bottom, 18)

                    // Stats strip
                    HStack(spacing: 14) {
                        stat("214", "words", color: Theme.inkDark)
                        stat("6", "min", color: Theme.inkDark)
                        stat("3", "corrections", color: Theme.accent)
                    }
                    .padding(.top, 6)
                    .padding(.bottom, 18)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Theme.chipBdSoft).frame(height: 1)
                    }
                    .padding(.bottom, 22)

                    VStack(spacing: 18) {
                        ForEach(DemoData.sessionDetail) { t in
                            if t.speaker == .you {
                                youTurn(t)
                            } else {
                                echoTurn(t)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
        }
    }

    private func stat(_ value: String, _ label: String, color: Color) -> some View {
        (Text(value).font(.jakarta(13, .bold)).foregroundStyle(color)
            + Text(" \(label)").font(.jakarta(13)).foregroundStyle(color == Theme.accent ? Theme.accent : Theme.textMuted))
    }

    private func youTurn(_ t: DemoData.Turn) -> some View {
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
                        Text("GENTLE CORRECTION")
                            .font(.jakarta(11, .bold))
                            .tracking(0.6)
                            .foregroundStyle(Theme.accent)
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

    private func echoTurn(_ t: DemoData.Turn) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 9) {
                Text(t.text)
                    .font(.jakarta(15))
                    .lineSpacing(4)
                    .foregroundStyle(Theme.textBody)
                HStack(spacing: 16) {
                    Image(systemName: "doc.on.doc")
                    Image(systemName: "hand.thumbsup")
                    Image(systemName: "speaker.wave.2")
                    Image(systemName: "arrow.counterclockwise")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.accent)
            }
            Spacer(minLength: 40)
        }
    }
}

// MARK: - Summary

struct SummaryScreen: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                OrbView(size: 54)
                    .padding(.bottom, 24)

                Text("Nice work.")
                    .font(.jakarta(34, .heavy))
                    .tracking(-0.8)
                    .foregroundStyle(Theme.ink)
                Text("You spoke 4 minutes today.")
                    .font(.jakarta(16))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                HStack(spacing: 12) {
                    statCard("214", "words spoken", valueColor: Theme.ink)
                    statCard("3", "new phrases", valueColor: Theme.accent)
                }
                .padding(.top, 28)

                Spacer()

                YellowPillButton(title: "See transcript") { router.go(.session) }
                GhostButton(title: "Back home") { router.go(.home) }
                    .padding(.top, 12)
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
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

// MARK: - Paywall

struct PaywallScreen: View {
    @EnvironmentObject var router: Router

    private let perks = [
        "30 minutes a day",
        "Live transcript & saved history",
        "Gentle corrections after each chat",
    ]

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                Text("THAT'S TODAY'S 3 MINUTES")
                    .font(.jakarta(12, .bold))
                    .tracking(0.7)
                    .foregroundStyle(Theme.accent)
                    .padding(.bottom, 14)

                Text("You're all in for today.")
                    .font(.jakarta(30, .heavy))
                    .tracking(-0.7)
                    .foregroundStyle(Theme.ink)

                Text("Echo will be here tomorrow at midnight — or unlock more right now.")
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

                Spacer()

                YellowPillButton(title: "Unlock Premium") { router.go(.home) }
                GhostButton(title: "See you tomorrow") { router.go(.home) }
                    .padding(.top, 12)
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 24)
        }
    }
}
