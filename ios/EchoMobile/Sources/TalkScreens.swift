import SwiftUI

// MARK: - Conversation (voice orb)

struct ConversationScreen: View {
    @EnvironmentObject var router: Router
    @State private var convo: OrbState = .idle

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar
                HStack {
                    CircleIconButton(systemName: "chevron.left") { router.go(.home) }
                    Spacer()
                    HStack(spacing: 7) {
                        Image(systemName: "clock")
                            .font(.system(size: 13, weight: .medium))
                        Text("2:31 left today")
                            .font(.jakarta(14, .semibold))
                    }
                    .foregroundStyle(Theme.textSoft)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(.white))
                    .overlay(Capsule().stroke(Theme.chipBdSoft, lineWidth: 1))
                    Spacer()
                    CircleIconButton(systemName: "captions.bubble") { router.upsellOpen = true }
                }
                .padding(.horizontal, 22)
                .padding(.top, 8)

                Spacer()

                // Orb
                OrbView(size: 230, halo: true, state: convo)
                    .id(convo)
                    .contentShape(Circle())
                    .onTapGesture { cycleState() }

                HStack(spacing: 8) {
                    Circle()
                        .fill(stateColor)
                        .frame(width: 7, height: 7)
                    Text(stateLabel)
                        .font(.jakarta(14, .semibold))
                        .foregroundStyle(stateColor)
                }
                .padding(.top, 30)

                Spacer()

                // Controls
                HStack(spacing: 14) {
                    Button {
                        cycleState()
                    } label: {
                        Image(systemName: "mic")
                            .font(.system(size: 19, weight: .medium))
                            .foregroundStyle(Color(hex: 0x3A3742))
                            .frame(width: 54, height: 54)
                            .background(Circle().fill(.white))
                            .overlay(Circle().stroke(Theme.chipBd, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        router.go(.summary)
                    } label: {
                        Text("Done")
                            .font(.jakarta(16, .bold))
                            .foregroundStyle(Theme.btnText)
                            .padding(.horizontal, 44)
                            .frame(height: 54)
                            .background(Capsule().fill(Theme.btnBg))
                            .shadow(color: Theme.btnShadow, radius: 15, y: 8)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 42)
            }
        }
    }

    private func cycleState() {
        switch convo {
        case .idle: convo = .listening
        case .listening: convo = .speaking
        case .speaking: convo = .idle
        }
    }

    private var stateLabel: String {
        switch convo {
        case .idle: return "Tap the orb to begin"
        case .listening: return "Listening…"
        case .speaking: return "Echo is speaking"
        }
    }

    private var stateColor: Color {
        switch convo {
        case .idle: return Color(hex: 0xA8A0A6)
        case .listening: return Theme.accent
        case .speaking: return Theme.sage
        }
    }
}

// MARK: - Live transcript

struct LiveTranscriptScreen: View {
    @EnvironmentObject var router: Router
    @State private var blink = false

    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar
                HStack {
                    CircleIconButton(systemName: "chevron.left") { router.go(.conversation) }
                    Spacer()
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 6, height: 6)
                            .opacity(blink ? 1 : 0.3)
                        Text("Live transcript")
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

                OrbView(size: 96, halo: true)
                    .padding(.vertical, 8)

                // Transcript
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 14) {
                            ForEach(router.turns) { t in
                                bubble(t.text, isYou: t.speaker == .you)
                            }
                            if !router.finished {
                                liveBubble
                            }
                            if router.finished {
                                Text("You both wrapped up — nicely done.")
                                    .font(.jakarta(13))
                                    .foregroundStyle(Theme.sub)
                                    .padding(8)
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                    .onChange(of: router.liveCount) {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }

                // Controls
                HStack(spacing: 14) {
                    Button {
                        router.togglePause()
                    } label: {
                        Image(systemName: router.finished ? "arrow.counterclockwise" : router.running ? "pause.fill" : "play.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color(hex: 0x3A3742))
                            .frame(width: 52, height: 52)
                            .background(Circle().fill(.white))
                            .overlay(Circle().stroke(Theme.chipBd, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        router.go(.summary)
                    } label: {
                        Text("Done")
                            .font(.jakarta(16, .bold))
                            .foregroundStyle(Theme.btnText)
                            .padding(.horizontal, 40)
                            .frame(height: 52)
                            .background(Capsule().fill(Theme.btnBg))
                            .shadow(color: Theme.btnShadow, radius: 15, y: 8)
                    }
                    .buttonStyle(.plain)
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

    private func bubble(_ text: String, isYou: Bool) -> some View {
        HStack {
            if isYou { Spacer(minLength: 60) }
            if isYou {
                Text(text)
                    .font(.jakarta(15))
                    .lineSpacing(3)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(youBubbleShape.fill(Theme.accent))
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

    private var liveBubble: some View {
        let isYou = router.liveLine.speaker == .you
        return HStack {
            if isYou { Spacer(minLength: 60) }
            (Text(router.liveText) + Text(" ▍").foregroundStyle(.secondary))
                .font(.jakarta(15))
                .lineSpacing(3)
                .foregroundStyle(isYou ? .white : Theme.textBody)
                .padding(.horizontal, isYou ? 16 : 0)
                .padding(.vertical, isYou ? 12 : 0)
                .background(isYou ? AnyView(youBubbleShape.fill(Theme.accent)) : AnyView(EmptyView()))
            if !isYou { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: isYou ? .trailing : .leading)
    }

    private var youBubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 20, bottomLeadingRadius: 20,
            bottomTrailingRadius: 6, topTrailingRadius: 20,
            style: .continuous
        )
    }
}

// MARK: - Upsell sheet

struct UpsellSheet: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(.sRGB, red: 40 / 255, green: 10 / 255, blue: 30 / 255, opacity: 0.34)
                .ignoresSafeArea()
                .onTapGesture { router.upsellOpen = false }

            VStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color(hex: 0xEADCE4))
                    .frame(width: 40, height: 4)
                    .padding(.bottom, 22)

                OrbView(size: 48)
                    .padding(.bottom, 18)

                Text("See what you and Echo\nare saying")
                    .font(.jakarta(23, .heavy))
                    .tracking(-0.4)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.ink)

                Text("Live transcript and saved conversations are part of Premium.")
                    .font(.jakarta(15))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
                    .padding(.top, 10)

                HStack(spacing: 12) {
                    Button {
                        router.upsellOpen = false
                    } label: {
                        Text("Maybe later")
                            .font(.jakarta(16, .semibold))
                            .foregroundStyle(Theme.inkDark)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .overlay(Capsule().stroke(Theme.chipBd, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)

                    Button {
                        router.go(.live)
                    } label: {
                        Text("Show transcript")
                            .font(.jakarta(16, .bold))
                            .foregroundStyle(Theme.btnText)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Capsule().fill(Theme.btnBg))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 26)
            }
            .padding(.horizontal, 26)
            .padding(.top, 30)
            .padding(.bottom, 40)
            .background(
                UnevenRoundedRectangle(
                    topLeadingRadius: 28, bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0, topTrailingRadius: 28,
                    style: .continuous
                )
                .fill(.white)
                .ignoresSafeArea(edges: .bottom)
            )
            .transition(.move(edge: .bottom))
        }
    }
}
