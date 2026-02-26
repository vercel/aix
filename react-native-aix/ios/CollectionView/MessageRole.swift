import Foundation

enum MessageRole {
    case user
    case assistant
    case loadingIndicator
}

enum MessageStatus {
    case streaming
    case complete
}

struct ChatMessage: Identifiable, Hashable {
    let id: UUID
    let role: MessageRole
    var text: String
    var status: MessageStatus

    init(role: MessageRole, text: String, status: MessageStatus = .complete) {
        self.id = UUID()
        self.role = role
        self.text = text
        self.status = status
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}
