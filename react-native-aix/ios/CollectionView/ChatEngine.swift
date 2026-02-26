import Foundation
import AnyLanguageModel
import os.log

private let log = Logger(subsystem: "AixExample", category: "ChatService")

final class ChatService {

  private static let openAIapiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"]
  ?? ""
  
    private var session: LanguageModelSession

    init() {
        if #available(iOS 26.0, *) {
//            let model = SystemLanguageModel.default
            let model = OpenAILanguageModel(apiKey: Self.openAIapiKey, model: "gpt-5-nano-2025-08-07")
            session = LanguageModelSession(model: model)
        } else {
            let model = OpenAILanguageModel(apiKey: Self.openAIapiKey, model: "gpt-5-nano-2025-08-07")
            session = LanguageModelSession(model: model)
        }
    }

    func streamResponse(to prompt: String) -> AsyncThrowingStream<String, Error> {
        log.info("streamResponse called with prompt: \"\(prompt)\"")
        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let stream = self.session.streamResponse(to: prompt)
                    for try await partial in stream {
                        continuation.yield(partial.content)
                    }
                    continuation.finish()
                } catch {
                    log.error("streamResponse: error: \(error.localizedDescription)")
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
