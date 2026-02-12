import UIKit

enum PasteFileManager {

    private static let pasteDir: URL = {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        return tmp.appendingPathComponent("paste", isDirectory: true)
    }()

    /// Maximum age for paste files before cleanup (1 hour).
    private static let maxFileAge: TimeInterval = 3600

    static func save(image: UIImage) throws -> String {
        let data: Data
        let ext: String
        if let png = image.pngData() {
            data = png
            ext = "png"
        } else if let jpg = image.jpegData(compressionQuality: 0.9) {
            data = jpg
            ext = "jpg"
        } else {
            throw NSError(
                domain: "SaveImageError",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Failed to encode image as PNG or JPEG"]
            )
        }

        return try writeToDir(data: data, fileExtension: ext)
    }

    static func save(text: String) throws -> String {
        guard let data = text.data(using: .utf8) else {
            throw NSError(
                domain: "SaveTextError",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to encode text as UTF-8"]
            )
        }

        return try writeToDir(data: data, fileExtension: "txt")
    }

    static func save(data: Data, fileExtension: String) throws -> String {
        let sanitizedExt = fileExtension.trimmingCharacters(in: .whitespacesAndNewlines)
        return try writeToDir(data: data, fileExtension: sanitizedExt)
    }

    // MARK: - Cleanup

    /// Removes paste files older than `maxFileAge`.
    static func cleanupOldFiles() {
        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(
            at: pasteDir,
            includingPropertiesForKeys: [.creationDateKey],
            options: .skipsHiddenFiles
        ) else { return }

        let cutoff = Date().addingTimeInterval(-maxFileAge)
        var removed = 0

        for fileURL in contents {
            guard let attrs = try? fileURL.resourceValues(forKeys: [.creationDateKey]),
                  let created = attrs.creationDate,
                  created < cutoff else { continue }
            try? fileManager.removeItem(at: fileURL)
            removed += 1
        }

        if removed > 0 {
            print("\(LOG_TAG) Cleaned up \(removed) old paste file(s)")
        }
    }

    // MARK: - Private
    private static func writeToDir(data: Data, fileExtension: String) throws -> String {
        let fileManager = FileManager.default

        if !fileManager.fileExists(atPath: pasteDir.path) {
            try fileManager.createDirectory(at: pasteDir, withIntermediateDirectories: true, attributes: nil)
        }

        let fileName = UUID().uuidString + "." + fileExtension
        let fileURL = pasteDir.appendingPathComponent(fileName)

        try data.write(to: fileURL, options: .atomic)

        return fileURL.path
    }
}
