import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Avatars the notification extension has fetched, in the group container both it and the app
/// can read. The same few people send most messages, so each avatar is fetched once.
enum AvatarStore {
    private static let group = "group.raven.thecommit.company"
    // Hundreds of faces, so most pushes take their avatar from disk instead of the network.
    private static let budget = 8 * 1024 * 1024

    /// The avatar already held; reading it marks it as the most recently used.
    static func file(for url: URL) -> URL? {
        guard let file = path(for: url), FileManager.default.fileExists(atPath: file.path) else { return nil }
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
        return file
    }

    /// Keeps a downloaded avatar as an icon-sized jpeg and returns where it landed.
    /// iOS attaches a jpeg, png or gif only, and a profile picture is often neither.
    static func keep(_ downloaded: URL, for url: URL) -> URL? {
        guard let file = path(for: url), let icon = icon(from: downloaded) else { return nil }
        try? FileManager.default.removeItem(at: file)
        guard (try? icon.write(to: file)) != nil else { return nil }
        trim()
        return file
    }

    /// The image at its icon size, as jpeg. ImageIO reads the file a tile at a time, which
    /// matters here: an extension is given a fraction of an app's memory.
    private static func icon(from file: URL) -> Data? {
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 256,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    private static func folder() -> URL? {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
        let folder = container.appendingPathComponent("avatars")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    /// One file per avatar url, named by its hash so it carries no path of its own.
    private static func path(for url: URL) -> URL? {
        var hash: UInt32 = 5381
        for byte in Array(url.absoluteString.utf8) { hash = (hash &* 33) ^ UInt32(byte) }
        return folder()?.appendingPathComponent("\(String(hash, radix: 36)).jpg")
    }

    /// Least recently used first, so the faces of people writing now are the last to go.
    private static func trim() {
        guard let folder = folder(),
              let files = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]) else { return }
        let size = { (url: URL) in (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0 }
        let used = { (url: URL) in (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast }
        var total = files.reduce(0) { $0 + size($1) }
        for file in files.sorted(by: { used($0) < used($1) }) where total > budget {
            total -= size(file)
            try? FileManager.default.removeItem(at: file)
        }
    }
}
