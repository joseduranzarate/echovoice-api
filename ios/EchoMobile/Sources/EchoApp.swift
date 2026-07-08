import SwiftUI
import ClerkKit

@main
struct EchoApp: App {
    @StateObject private var router = Router()
    @StateObject private var call = CallController()

    init() {
        if Config.isConfigured {
            Clerk.configure(publishableKey: Config.clerkPublishableKey)
        }
    }

    var body: some Scene {
        WindowGroup {
            if Config.isConfigured {
                RootView()
                    .environmentObject(router)
                    .environmentObject(call)
                    .preferredColorScheme(.light)
            } else {
                ConfigNeededView()
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch router.screen {
                case .splash: SplashScreen()
                case .welcome: WelcomeScreen()
                case .auth: AuthScreen()
                case .setup: SetupScreen()
                case .home: HomeScreen()
                case .conversation: ConversationScreen()
                case .live: LiveTranscriptScreen()
                case .session: SessionDetailScreen()
                case .summary: SummaryScreen()
                case .paywall: PaywallScreen()
                case .history: HistoryScreen()
                case .saved: SavedScreen()
                case .profile: ProfileScreen()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if showNav {
                BottomNavBar()
                    .padding(.bottom, 10)
            }
        }
        .ignoresSafeArea(.keyboard)
    }

    private var showNav: Bool {
        [.home, .history, .saved, .profile].contains(router.screen)
    }
}

/// Shown until Config.swift has real keys — keeps the project buildable
/// and honest about what it needs.
struct ConfigNeededView: View {
    var body: some View {
        ZStack {
            Theme.screenGradient.ignoresSafeArea()
            VStack(spacing: 16) {
                OrbView(size: 72)
                Text("Almost there")
                    .font(.jakarta(26, .heavy))
                    .foregroundStyle(Theme.ink)
                Text("Open Sources/Config.swift and paste your Clerk publishable key and API URL (both are in web/.env.local). Then rebuild.")
                    .font(.jakarta(15))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: 300)
            }
        }
    }
}
