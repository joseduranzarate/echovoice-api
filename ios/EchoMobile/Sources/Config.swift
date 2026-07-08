import Foundation

/// App configuration. Copy the two values from `web/.env.local`:
///   - clerkPublishableKey ← NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
///   - apiURL              ← NEXT_PUBLIC_API_URL (the Railway API domain)
enum Config {
    static let clerkPublishableKey = "REPLACE_WITH_pk_..."
    static let apiURL = URL(string: "https://REPLACE-WITH-API.up.railway.app")!

    static var isConfigured: Bool {
        clerkPublishableKey.hasPrefix("pk_")
    }
}
