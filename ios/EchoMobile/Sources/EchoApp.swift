import SwiftUI

@main
struct EchoApp: App {
    @StateObject private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(router)
                .preferredColorScheme(.light)
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

            if router.showNav {
                BottomNavBar()
                    .padding(.bottom, 10)
            }
        }
        .ignoresSafeArea(.keyboard)
        .overlay {
            if router.upsellOpen {
                UpsellSheet()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: router.upsellOpen)
    }
}
