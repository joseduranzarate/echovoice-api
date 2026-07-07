import SwiftUI

enum Screen {
    case splash, welcome, auth, setup
    case home, conversation, live, session
    case summary, paywall, history, saved, profile
}

/// Screen router + live-transcript simulation state, mirroring the design
/// mock's DCLogic component.
@MainActor
final class Router: ObservableObject {
    @Published var screen: Screen = .splash
    @Published var upsellOpen = false

    // Live transcript playback
    @Published var turns: [DemoData.Turn] = []
    @Published var liveIdx = 0
    @Published var liveCount = 0
    @Published var running = false
    @Published var finished = false

    private var tickTask: Task<Void, Never>?

    var showNav: Bool {
        [.home, .history, .saved, .profile].contains(screen)
    }

    func go(_ s: Screen) {
        if s != .live { stopLive() }
        upsellOpen = false
        screen = s
        if s == .live { startLive() }
    }

    // MARK: live transcript playback

    var liveLine: DemoData.Turn { DemoData.script[min(liveIdx, DemoData.script.count - 1)] }
    var liveText: String {
        liveLine.text.split(separator: " ").prefix(liveCount).joined(separator: " ")
    }

    func startLive() {
        stopLive()
        turns = []
        liveIdx = 0
        liveCount = 0
        running = true
        finished = false
        schedule(after: 0.65)
    }

    func stopLive() {
        tickTask?.cancel()
        tickTask = nil
    }

    func togglePause() {
        if finished { startLive(); return }
        if running {
            stopLive()
            running = false
        } else {
            running = true
            schedule(after: 0.25)
        }
    }

    private func schedule(after seconds: Double) {
        tickTask?.cancel()
        tickTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.tick()
        }
    }

    private func tick() {
        guard screen == .live, running else { return }
        let line = DemoData.script[liveIdx]
        let words = line.text.split(separator: " ")
        if liveCount < words.count {
            liveCount += 1
            schedule(after: line.speaker == .you ? 0.195 : 0.115)
        } else {
            turns.append(line)
            let next = liveIdx + 1
            if next >= DemoData.script.count {
                liveCount = 0
                running = false
                finished = true
                return
            }
            liveIdx = next
            liveCount = 0
            schedule(after: 0.72)
        }
    }
}
