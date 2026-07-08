import Foundation
import LiveKit

struct CaptionTurn: Identifiable, Equatable {
    let id = UUID()
    let role: String // "user" | "assistant"
    let text: String
}

/// One live conversation with Echo — mirrors the web /talk page's phases.
@MainActor
final class CallController: ObservableObject {
    enum Phase: Equatable {
        case idle, connecting, waking, live, ending
        case error(String)
    }

    enum Voice: Equatable { case idle, listening, speaking }

    @Published var phase: Phase = .idle
    @Published var voice: Voice = .idle
    @Published var micOn = true
    @Published var captionsOn = false
    @Published var elapsedS = 0
    @Published var quotaExhausted = false

    // Captions (fed by the agent over the data channel)
    @Published var userLine = ""
    @Published var echoLine = ""
    @Published var turns: [CaptionTurn] = []

    private let room = Room()
    private var ticker: Task<Void, Never>?
    private var startedAt: Date?

    func start(api: EchoAPI, scenario: String?) async {
        guard phase == .idle || isError else { return }
        reset()
        phase = .connecting

        do {
            let t = try await api.mintToken(scenario: scenario)
            room.add(delegate: self)
            try await room.connect(url: t.url, token: t.token)
            try await room.localParticipant.setMicrophone(enabled: true)
            micOn = true

            // Wait for the agent — same 12s ceiling as web.
            phase = .waking
            let deadline = Date().addingTimeInterval(12)
            while room.remoteParticipants.isEmpty, Date() < deadline {
                try await Task.sleep(nanoseconds: 250_000_000)
            }
            guard !room.remoteParticipants.isEmpty else {
                throw NSError(
                    domain: "echo", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Echo didn't join in time"]
                )
            }

            startedAt = Date()
            phase = .live
            voice = .listening
            startTicker()
        } catch EchoAPIError.quotaExhausted {
            quotaExhausted = true
            phase = .idle
        } catch EchoAPIError.agentUnavailable {
            await room.disconnect()
            phase = .error("Echo is unavailable right now — try again in a minute.")
        } catch {
            await room.disconnect()
            phase = .error(error.localizedDescription)
        }
    }

    /// Ends the call; returns the elapsed seconds for the summary screen.
    func end() async -> Int {
        phase = .ending
        ticker?.cancel()
        await room.disconnect()
        let duration = startedAt.map { Int(Date().timeIntervalSince($0)) } ?? 0
        startedAt = nil
        phase = .idle
        voice = .idle
        return duration
    }

    func toggleMic() {
        guard phase == .live else { return }
        let next = !micOn
        Task {
            try? await room.localParticipant.setMicrophone(enabled: next)
            micOn = next
        }
    }

    var isError: Bool {
        if case .error = phase { return true }
        return false
    }

    var errorMessage: String? {
        if case let .error(m) = phase { return m }
        return nil
    }

    private func reset() {
        userLine = ""
        echoLine = ""
        turns = []
        elapsedS = 0
        quotaExhausted = false
    }

    private func startTicker() {
        ticker?.cancel()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 500_000_000)
                guard let self, let started = self.startedAt else { return }
                self.elapsedS = Int(Date().timeIntervalSince(started))
            }
        }
    }

    private func handleCaption(role: String, text: String, final: Bool) {
        if role == "user" {
            userLine = text
            if final { turns.append(.init(role: "user", text: text)) }
        } else if role == "assistant" {
            echoLine = text
            if final { turns.append(.init(role: "assistant", text: text)) }
        }
    }
}

// MARK: - RoomDelegate

extension CallController: RoomDelegate {
    nonisolated func room(
        _ room: Room, participant: RemoteParticipant?,
        didReceiveData data: Data, forTopic topic: String,
        encryptionType: EncryptionType
    ) {
        guard
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            obj["type"] as? String == "transcript",
            let role = obj["role"] as? String,
            let text = obj["text"] as? String
        else { return }
        let final = obj["final"] as? Bool ?? true
        Task { @MainActor [weak self] in
            self?.handleCaption(role: role, text: text, final: final)
        }
    }

    nonisolated func room(_ room: Room, didUpdateSpeakingParticipants participants: [Participant]) {
        let remoteTalking = participants.contains { $0 is RemoteParticipant }
        let localTalking = participants.contains { $0 is LocalParticipant }
        Task { @MainActor [weak self] in
            guard let self, self.phase == .live else { return }
            if remoteTalking {
                self.voice = .speaking
            } else if localTalking {
                self.voice = .listening
            } else {
                self.voice = .idle
            }
        }
    }
}
