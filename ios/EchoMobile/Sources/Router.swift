import Foundation
import ClerkKit

enum Screen {
    case splash, welcome, auth, setup
    case home, conversation, live, session
    case summary, paywall, history, saved, profile
}

/// Clerk-backed token source for EchoAPI.
struct ClerkTokenProvider: TokenProvider {
    func sessionToken() async throws -> String {
        guard let token = try await Clerk.shared.session?.getToken() else {
            throw EchoAPIError.unauthenticated
        }
        return token
    }
}

/// Navigation + app data store. Screens read published data; loaders are
/// fire-and-forget refreshers hitting the same API the web app uses.
@MainActor
final class Router: ObservableObject {
    @Published var screen: Screen = .splash

    let api = EchoAPI(baseURL: Config.apiURL, tokens: ClerkTokenProvider())

    // Shared app data
    @Published var quota: Quota?
    @Published var sessions: [SessionSummary] = []
    @Published var phrases: [SavedPhrase] = []
    @Published var latest: SessionSummary?

    // Cross-screen handoff
    @Published var selectedSessionID: String?
    @Published var pendingScenario: String?
    @Published var pendingResume: SessionSummary?

    var signedIn: Bool { Clerk.shared.user != nil }
    var userName: String { Clerk.shared.user?.firstName ?? "tú" }
    var userEmail: String { Clerk.shared.user?.emailAddresses.first?.emailAddress ?? "—" }
    var isPremium: Bool { quota?.plan == "premium" }

    func go(_ s: Screen) {
        screen = s
        switch s {
        case .home: refreshQuota(); refreshLatest()
        case .history: refreshSessions()
        case .saved: refreshPhrases()
        case .profile: refreshQuota()
        default: break
        }
    }

    /// Where to land after splash: signed-out → welcome; signed-in → home.
    func landAfterSplash() {
        go(signedIn ? .home : .welcome)
    }

    func startTalk(scenario: String? = nil, resume: SessionSummary? = nil) {
        pendingScenario = scenario
        pendingResume = resume
        go(.conversation)
    }

    // MARK: loaders (best-effort; screens show what they have)

    func refreshQuota() {
        Task { [weak self] in
            guard let self else { return }
            if let q = try? await self.api.quota() { self.quota = q }
        }
    }

    func refreshSessions() {
        Task { [weak self] in
            guard let self else { return }
            if let s = try? await self.api.sessions() { self.sessions = s }
        }
    }

    func refreshPhrases() {
        Task { [weak self] in
            guard let self else { return }
            if let p = try? await self.api.phrases() { self.phrases = p }
        }
    }

    func refreshLatest() {
        Task { [weak self] in
            guard let self else { return }
            if let l = try? await self.api.latestSession() { self.latest = l }
        }
    }

    func signOut() {
        Task { [weak self] in
            try? await Clerk.shared.auth.signOut()
            self?.quota = nil
            self?.sessions = []
            self?.phrases = []
            self?.go(.welcome)
        }
    }

    func deleteAccount() async {
        try? await api.deleteAccount()
        try? await Clerk.shared.auth.signOut()
        quota = nil
        sessions = []
        phrases = []
        go(.welcome)
    }
}
