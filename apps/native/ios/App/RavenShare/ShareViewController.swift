import UIKit
import UniformTypeIdentifiers

// Share extension: copies each item into the app group, then hands the list to the app as
// raven://?title&description&type&url (SceneDelegate.receiveShare reads it).
final class ShareViewController: UIViewController {
    private let group = "group.raven.thecommit.company"
    private var items: [[String: String]] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        let attachments = (extensionContext?.inputItems.first as? NSExtensionItem)?.attachments ?? []
        Task {
            for (index, provider) in attachments.enumerated() {
                if let item = await load(provider, index: index) { items.append(item) }
            }
            send()
        }
    }

    private func load(_ provider: NSItemProvider, index: Int) async -> [String: String]? {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
            if url.isFileURL { return copy(url) }
            return ["title": url.absoluteString, "description": "", "type": "text/plain", "url": url.absoluteString]
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
           let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
            return ["title": text, "description": text, "type": "text/plain", "url": ""]
        }
        for type in [UTType.movie, UTType.image, UTType.data] where provider.hasItemConformingToTypeIdentifier(type.identifier) {
            // The most specific type offered (public.png, not public.image): only it has a MIME type and extension.
            let concrete = provider.registeredTypeIdentifiers.compactMap { UTType($0) }.first { $0.conforms(to: type) } ?? type
            let loaded = try? await provider.loadItem(forTypeIdentifier: concrete.identifier)
            if let url = loaded as? URL { return copy(url) }
            if let image = loaded as? UIImage, let data = image.pngData() { return write(data, name: "image_\(index).png", type: "image/png") }
            if let data = loaded as? Data {
                return write(data, name: name(provider.suggestedName ?? "shared_\(index)", as: concrete), type: concrete.preferredMIMEType ?? "application/octet-stream")
            }
        }
        return nil
    }

    // In-memory data, such as an unsaved screenshot, can arrive without an extension: it gets its type's.
    private func name(_ base: String, as type: UTType) -> String {
        // A known extension only: a name like "Screenshot at 7.30.12 PM" has a dot but no extension.
        let existing = (base as NSString).pathExtension
        if !existing.isEmpty, UTType(filenameExtension: existing)?.isDynamic == false { return base }
        guard let ext = type.preferredFilenameExtension else { return base }
        return "\(base).\(ext)"
    }

    private func copy(_ url: URL) -> [String: String]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        return write(data, name: url.lastPathComponent, type: type)
    }

    // The app reads the copy from the shared container; the original's grant ends with this extension.
    private func write(_ data: Data, name: String, type: String) -> [String: String]? {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
        let file = container.appendingPathComponent(name)
        guard (try? data.write(to: file)) != nil else { return nil }
        return ["title": name, "description": "", "type": type, "url": file.absoluteString]
    }

    private func send() {
        var components = URLComponents(string: "raven://")!
        components.queryItems = items.flatMap { item in
            ["title", "description", "type", "url"].map { URLQueryItem(name: $0, value: item[$0] ?? "") }
        }
        if let url = components.url { open(url) }
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // An extension has no UIApplication; the responder chain reaches the host's.
    private func open(_ url: URL) {
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication { application.open(url, options: [:], completionHandler: nil); return }
            responder = current.next
        }
    }
}
