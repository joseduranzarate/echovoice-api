import Foundation

/// Static product content (same strings the web app hardcodes).
enum DemoData {
    static let prompts = ["Order at a café", "Talk about my weekend", "Job interview", "Describe my city", "Small talk"]

    struct Scenario: Identifiable {
        let id = UUID()
        let emoji: String
        let title: String
        let desc: String
        let bg: UInt32
    }

    static let scenarios: [Scenario] = [
        .init(emoji: "☕", title: "Everyday talk", desc: "Cafes, shops, small daily moments.", bg: 0xE9ECD6),
        .init(emoji: "💼", title: "Work & interviews", desc: "Meetings, intros, tricky questions.", bg: 0xEFE7CB),
    ]

    static let levels = ["Beginner", "Intermediate", "Advanced", "Not sure"]
    static let topics = ["Daily conversation", "Work & professional", "Travel", "Just to chat"]
}
