import Foundation

/// Demo content from the Echo Mobile Screens design mock.
enum DemoData {
    enum SpeakerRole { case echo, you }

    struct Turn: Identifiable {
        let id = UUID()
        let speaker: SpeakerRole
        let text: String
        var correction: (from: String, to: String)? = nil
    }

    static let script: [Turn] = [
        .init(speaker: .echo, text: "Hi again — good to hear you. What did you get up to today?"),
        .init(speaker: .you, text: "I went to the market and I buyed some vegetables for dinner."),
        .init(speaker: .echo, text: "Sounds lovely. A small thing — we'd say I bought some vegetables. What are you cooking?"),
        .init(speaker: .you, text: "I want to make a soup, but I am not sure how to say the recipe."),
        .init(speaker: .echo, text: "No problem, let's go through it together. What goes in first?"),
        .init(speaker: .you, text: "First the onions, then carrots and potatoes."),
        .init(speaker: .echo, text: "Nicely said. That sounds like a wonderful dinner."),
    ]

    static let sessionDetail: [Turn] = [
        .init(speaker: .echo, text: "Hi again — good to hear you. What did you get up to today?"),
        .init(speaker: .you, text: "I went to the market and I buyed some vegetables for dinner.",
              correction: (from: "I buyed some vegetables", to: "I bought some vegetables")),
        .init(speaker: .echo, text: "Sounds lovely. What are you planning to cook?"),
        .init(speaker: .you, text: "I will make a soup. I am not so good for cooking, but I try.",
              correction: (from: "not so good for cooking", to: "not very good at cooking")),
        .init(speaker: .echo, text: "That's the best way to get better — just keep trying. What goes in the soup?"),
        .init(speaker: .you, text: "Some carrot, potato, and onions. I cut them very small.",
              correction: (from: "Some carrot, potato", to: "Some carrots and potatoes")),
        .init(speaker: .echo, text: "Perfect. That'll be delicious — tell me how it turns out."),
    ]

    struct Session: Identifiable {
        let id = UUID()
        let date: String
        let title: String
        let preview: String
        let duration: String
    }

    static let sessions: [Session] = [
        .init(date: "Today", title: "A trip to the market", preview: "“…I bought some vegetables for dinner.”", duration: "6 min"),
        .init(date: "Yesterday", title: "Talking about the weekend", preview: "“We went hiking near the lake on Saturday.”", duration: "12 min"),
        .init(date: "Mon", title: "Ordering at a café", preview: "“Could I get a flat white, please?”", duration: "8 min"),
        .init(date: "Sun", title: "My new job", preview: "“I just started as a backend engineer.”", duration: "15 min"),
        .init(date: "Sat", title: "Making weekend plans", preview: "“Maybe we could visit the museum together.”", duration: "9 min"),
        .init(date: "Fri", title: "Describing my hometown", preview: "“It’s a small city right by the sea.”", duration: "11 min"),
    ]

    struct Phrase: Identifiable {
        let id = UUID()
        let phrase: String
        let note: String
        let tag: String
    }

    static let savedPhrases: [Phrase] = [
        .init(phrase: "I bought some vegetables for dinner.", note: "Past tense of ‘buy’ — not ‘buyed’.", tag: "Grammar"),
        .init(phrase: "I'm not very good at cooking.", note: "Use ‘good at’, not ‘good for’, with an activity.", tag: "Prepositions"),
        .init(phrase: "Could I get a flat white, please?", note: "A natural, polite way to order at a café.", tag: "Everyday"),
        .init(phrase: "It's a small city right by the sea.", note: "‘right by’ = very close to.", tag: "Describing"),
        .init(phrase: "My biggest strength is staying calm.", note: "Great phrase for job interviews.", tag: "Work"),
    ]

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
