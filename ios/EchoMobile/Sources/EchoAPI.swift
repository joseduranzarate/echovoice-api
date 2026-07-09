import Foundation

/// Echo backend client — mirrors `web/app/lib/api.ts` one-to-one.
///
/// Auth: every call sends `Authorization: Bearer <Clerk session JWT>`.
/// The token comes from a `TokenProvider` so this file has no Clerk
/// dependency; when the Clerk iOS SDK is configured, implement the
/// protocol with `Clerk.shared.session?.getToken()` and the whole API
/// surface lights up. Until then, screens keep using DemoData.
protocol TokenProvider {
    func sessionToken() async throws -> String
}

enum EchoAPIError: Error {
    case unauthenticated
    case quotaExhausted(QuotaExhausted)
    case agentUnavailable
    case http(status: Int, body: String)
}

// MARK: - Models (match the FastAPI response shapes)

struct Quota: Codable {
    let plan: String
    let dailyRemainingS: Int
    let trialRemainingS: Int
}

struct QuotaExhausted: Codable {
    let plan: String
    let dailyCapS: Int
    let retryAfterS: Int
}

struct TokenResponse: Codable {
    let token: String
    let url: String
    let room: String
    let identity: String
    let quota: Quota
}

struct SessionSummary: Codable, Identifiable {
    let id: String
    let roomName: String
    let startedAt: String
    let endedAt: String?
    let durationS: Int
    let title: String?
    let preview: String?
    let wordCount: Int?
    let correctionCount: Int?
}

struct Correction: Codable {
    let from: String
    let to: String
}

struct TranscriptTurn: Codable, Identifiable {
    let id: Int
    let role: String
    let text: String
    let correction: Correction?
}

struct SavedPhrase: Codable, Identifiable {
    let id: String
    let sessionId: String?
    let phrase: String
    let note: String?
    let tag: String?
    let createdAt: String
}

struct Preferences: Codable {
    let level: String?
    let topic: String?
}

// MARK: - Client

final class EchoAPI {
    let baseURL: URL
    let tokens: TokenProvider

    init(baseURL: URL, tokens: TokenProvider) {
        self.baseURL = baseURL
        self.tokens = tokens
    }

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private func request(
        _ path: String,
        method: String = "GET",
        json: [String: Any?]? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        var req = URLRequest(url: baseURL.appending(path: path))
        req.httpMethod = method
        let token = try await tokens.sessionToken()
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(
                withJSONObject: json.compactMapValues { $0 }
            )
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let http = resp as! HTTPURLResponse
        if http.statusCode == 401 { throw EchoAPIError.unauthenticated }
        return (data, http)
    }

    private func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        let (data, http) = try await request(path)
        guard (200..<300).contains(http.statusCode) else {
            throw EchoAPIError.http(
                status: http.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
        return try Self.decoder.decode(T.self, from: data)
    }

    // MARK: endpoints

    /// POST /token — starts a call: quota gate + per-call room + agent dispatch.
    func mintToken(
        scenario: String? = nil,
        resumeSessionId: String? = nil
    ) async throws -> TokenResponse {
        var body: [String: Any?] = [:]
        if let scenario { body["scenario"] = scenario }
        if let resumeSessionId { body["resume_session_id"] = resumeSessionId }
        let (data, http) = try await request(
            "/token", method: "POST",
            json: body.isEmpty ? nil : body
        )
        switch http.statusCode {
        case 200..<300:
            return try Self.decoder.decode(TokenResponse.self, from: data)
        case 429:
            throw EchoAPIError.quotaExhausted(
                try Self.decoder.decode(QuotaExhausted.self, from: data)
            )
        case 503:
            throw EchoAPIError.agentUnavailable
        default:
            throw EchoAPIError.http(
                status: http.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
    }

    func quota() async throws -> Quota {
        try await get("/quota", as: Quota.self)
    }

    func sessions() async throws -> [SessionSummary] {
        struct Wrapper: Codable { let sessions: [SessionSummary] }
        return try await get("/sessions", as: Wrapper.self).sessions
    }

    func latestSession() async throws -> SessionSummary? {
        let (data, http) = try await request("/sessions/latest")
        if http.statusCode == 404 { return nil }
        return try Self.decoder.decode(SessionSummary.self, from: data)
    }

    func session(id: String) async throws -> SessionSummary {
        try await get("/sessions/\(id)", as: SessionSummary.self)
    }

    func transcript(sessionId: String) async throws -> [TranscriptTurn] {
        struct Wrapper: Codable { let turns: [TranscriptTurn] }
        return try await get("/sessions/\(sessionId)/transcript", as: Wrapper.self).turns
    }

    func phrases() async throws -> [SavedPhrase] {
        struct Wrapper: Codable { let phrases: [SavedPhrase] }
        return try await get("/phrases", as: Wrapper.self).phrases
    }

    func savePhrase(
        _ phrase: String, note: String? = nil, tag: String? = nil,
        sessionId: String? = nil
    ) async throws -> SavedPhrase {
        let (data, _) = try await request(
            "/phrases", method: "POST",
            json: ["phrase": phrase, "note": note, "tag": tag, "session_id": sessionId]
        )
        return try Self.decoder.decode(SavedPhrase.self, from: data)
    }

    func deletePhrase(id: String) async throws {
        _ = try await request("/phrases/\(id)", method: "DELETE")
    }

    func preferences() async throws -> Preferences {
        try await get("/me/preferences", as: Preferences.self)
    }

    func updatePreferences(level: String? = nil, topic: String? = nil) async throws -> Preferences {
        let (data, _) = try await request(
            "/me/preferences", method: "PATCH",
            json: ["level": level, "topic": topic]
        )
        return try Self.decoder.decode(Preferences.self, from: data)
    }

    func checkoutURL() async throws -> URL {
        struct Wrapper: Codable { let url: String }
        let (data, _) = try await request("/billing/checkout", method: "POST")
        return URL(string: try Self.decoder.decode(Wrapper.self, from: data).url)!
    }

    func deleteAccount() async throws {
        _ = try await request("/me", method: "DELETE")
    }
}
