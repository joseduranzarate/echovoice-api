import Foundation

/// Static product content (mirrors the web app's Spanish copy). Values sent
/// to the API stay English — only labels are localized.
enum DemoData {
    static let prompts = ["Pedir en una cafetería", "Hablar de mi fin de semana", "Entrevista de trabajo", "Describir mi ciudad", "Charla casual"]

    struct Exam: Identifiable {
        let id = UUID()
        let label: String
        let value: String
    }

    static let exams: [Exam] = [
        .init(label: "IELTS Speaking", value: "exam:ielts-speaking"),
        .init(label: "TOEFL Speaking", value: "exam:toefl-speaking"),
    ]

    struct Scenario: Identifiable {
        let id = UUID()
        let emoji: String
        let title: String
        let desc: String
        let bg: UInt32
    }

    static let scenarios: [Scenario] = [
        .init(emoji: "☕", title: "Vida diaria", desc: "Cafés, tiendas, momentos cotidianos.", bg: 0xE9ECD6),
        .init(emoji: "💼", title: "Trabajo y entrevistas", desc: "Reuniones, presentaciones, preguntas difíciles.", bg: 0xEFE7CB),
    ]

    struct Option: Identifiable {
        let id = UUID()
        let label: String
        let value: String
    }

    static let levels: [Option] = [
        .init(label: "Principiante", value: "beginner"),
        .init(label: "Intermedio", value: "intermediate"),
        .init(label: "Avanzado", value: "advanced"),
        .init(label: "No estoy seguro", value: "notsure"),
    ]

    static let topics: [Option] = [
        .init(label: "Conversación diaria", value: "daily"),
        .init(label: "Trabajo y profesional", value: "work"),
        .init(label: "Viajes", value: "travel"),
        .init(label: "Solo charlar", value: "chat"),
    ]
}
