import SwiftUI

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

/// Meadow palette — mirrors the Echo Mobile Screens design tokens.
enum Theme {
    static let accent = Color(hex: 0x75894E)
    static let accentDeep = Color(hex: 0x5E7040)
    static let accentSoft = Color(hex: 0xE9ECD6)

    static let bgTop = Color(hex: 0xF1ECD9)
    static let bgMid = Color(hex: 0xF6F2E3)
    static let bgBot = Color(hex: 0xFAF7EC)

    static let orbA = Color(hex: 0xCBD7A6)
    static let orbB = Color(hex: 0x8A9E5C)
    static let orbC = Color(hex: 0x5E7238)
    static let glow = Color(.sRGB, red: 124 / 255, green: 140 / 255, blue: 90 / 255, opacity: 0.32)

    static let ink = Color(hex: 0x22241B)
    static let inkDark = Color(hex: 0x191A1F)
    static let textBody = Color(hex: 0x33313A)
    static let textMuted = Color(hex: 0x6B6770)
    static let textSoft = Color(hex: 0x8A8592)
    static let sub = Color(hex: 0x98937F)

    static let cardBd = Color(hex: 0xECE6D3)
    static let chipBd = Color(hex: 0xEFE2EA)
    static let chipBdSoft = Color(hex: 0xF1E7ED)

    static let btnBg = Color(hex: 0xEFD24A)
    static let btnText = Color(hex: 0x26281C)
    static let btnShadow = Color(.sRGB, red: 150 / 255, green: 130 / 255, blue: 50 / 255, opacity: 0.4)

    static let gold = Color(hex: 0xAD8C46)
    static let goldSoft = Color(hex: 0xEEE6CD)

    static let sage = Color(hex: 0x5B8C6E)
    static let danger = Color(hex: 0xC5523A)

    /// Full-screen warm gradient used on hero/session screens.
    static var screenGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: bgTop, location: 0),
                .init(color: bgMid, location: 0.45),
                .init(color: bgBot, location: 1),
            ],
            startPoint: .top, endPoint: .bottom
        )
    }

    /// Gradient for scrolling tab screens (fades to white in the middle).
    static var tabGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: bgTop, location: 0),
                .init(color: bgMid, location: 0.36),
                .init(color: .white, location: 0.6),
                .init(color: bgBot, location: 1),
            ],
            startPoint: .top, endPoint: .bottom
        )
    }
}

/// Plus Jakarta Sans helpers. The variable TTF exposes named instances.
extension Font {
    static func jakarta(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .heavy, .black: name = "PlusJakartaSans-ExtraBold"
        case .bold: name = "PlusJakartaSans-Bold"
        case .semibold: name = "PlusJakartaSans-SemiBold"
        case .medium: name = "PlusJakartaSans-Medium"
        default: name = "PlusJakartaSans-Regular"
        }
        return .custom(name, size: size)
    }
}
