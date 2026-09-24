import Intents
import UserNotifications

/// Dresses a push before iOS shows it: it becomes a message from a person, with their face,
/// their name and the conversation it belongs to (contract: raven/notification.py). It runs only
/// because the relay marks the push mutable, and shows it as sent if it cannot finish in time.
final class NotificationService: UNNotificationServiceExtension {
    // Held so the timeout can deliver what has been built so far. The download's thread and the
    // timeout both reach them, so every touch is on this queue and the push is handed over once.
    private let queue: DispatchQueue = {
        let queue = DispatchQueue(label: "raven.notification.service")
        queue.setSpecific(key: NotificationService.onQueue, value: true)
        return queue
    }()
    private static let onQueue = DispatchSpecificKey<Bool>()
    // Who sent the message, which names the person the notification is shown as coming from.
    private var sender: String?
    // The site, named beside the sender when this device has more than one to tell apart.
    private var site: String?
    private var manySites: Bool {
        (UserDefaults(suiteName: "group.raven.thecommit.company")?.integer(forKey: "siteCount") ?? 0) > 1
    }
    private var deliver: ((UNNotificationContent) -> Void)?
    private var content: UNMutableNotificationContent?
    private var downloads: [URLSessionTask] = []
    // iOS gives the extension seconds: a face is worth a short wait, never the notification.
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 5
        return URLSession(configuration: configuration)
    }()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            return contentHandler(request.content)
        }
        deliver = contentHandler
        self.content = content
        let info = request.content.userInfo

        // The site travels on the title of a push the device draws. It moves under the sender,
        // where it stays only if this push is not turned into a message below.
        site = host(from: info)
        if let site = site {
            content.subtitle = site
            content.title = content.title.replacingOccurrences(of: " · \(site)", with: "")
        }
        // One thread per conversation, so iOS stacks a channel's notifications together.
        if content.threadIdentifier.isEmpty, let tag = info["tag"] as? String { content.threadIdentifier = tag }

        sender = info["from_user"] as? String
        // Both pictures at once: the sender's face on the left, a channel's workspace logo on the right.
        var face: URL?
        var logo: URL?
        let both = DispatchGroup()
        obtain(url(from: info), into: both) { face = $0 }
        obtain(logoURL(from: info), into: both) { logo = $0 }
        both.notify(queue: queue) { self.finish(face: face, logo: logo) }
    }

    /// A picture from the store, or fetched into it; nil when there is none or it fails.
    private func obtain(_ url: URL?, into group: DispatchGroup, done: @escaping (URL?) -> Void) {
        guard let url = url else { return }
        if let cached = AvatarStore.file(for: url) { return done(cached) }
        group.enter()
        let task = Self.session.downloadTask(with: url) { location, _, _ in
            done(location.flatMap { AvatarStore.keep($0, for: url) })
            group.leave()
        }
        queue.sync { downloads.append(task) }
        task.resume()
    }

    // iOS is about to show the push as it arrived; hand over what is ready.
    override func serviceExtensionTimeWillExpire() {
        queue.sync { downloads.forEach { $0.cancel() } }
        finish()
    }

    /// The push as a message from a person, which is what puts the sender's face where the app's
    /// icon would be. It needs the communication notifications capability; without it, or without a
    /// sender to name, the notification is shown as it stands.
    private func asMessage(_ content: UNMutableNotificationContent, face: URL?) -> UNNotificationContent {
        guard !content.title.isEmpty else { return content }
        // A message notification has room for the sender alone: the site comes along only when
        // this device is signed in to more than one and the name would be ambiguous.
        let name = manySites ? [content.title, site].compactMap { $0 }.joined(separator: " · ") : content.title
        let image = face.flatMap { try? Data(contentsOf: $0) }.map { INImage(imageData: $0) }
        let handle = INPersonHandle(value: sender ?? content.title, type: .unknown)
        let person = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: name,
            image: image,
            contactIdentifier: nil,
            customIdentifier: handle.value
        )
        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: nil,
            conversationIdentifier: content.threadIdentifier.isEmpty ? nil : content.threadIdentifier,
            serviceName: nil,
            sender: person,
            attachments: nil
        )
        if let image = image { intent.setImage(image, forParameterNamed: \.sender) }
        // Donated, so iOS ties this push to the ones before it from the same person.
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)
        return (try? content.updating(from: intent)) ?? content
    }

    private func finish(face: URL? = nil, logo: URL? = nil) {
        let body: () -> Void = {
            guard let deliver = self.deliver, let content = self.content else { return }
            self.deliver = nil
            deliver(self.withLogo(self.asMessage(content, face: face), logo: logo))
        }
        // The pictures arriving call this on the queue already; the timeout calls it from elsewhere.
        if DispatchQueue.getSpecific(key: Self.onQueue) == true { body() } else { queue.sync(execute: body) }
    }

    /// The workspace logo as the picture on the right, a copy since iOS moves an attachment away.
    private func withLogo(_ content: UNNotificationContent, logo: URL?) -> UNNotificationContent {
        guard let logo = logo, let dressed = content.mutableCopy() as? UNMutableNotificationContent else { return content }
        let copy = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
        guard (try? FileManager.default.copyItem(at: logo, to: copy)) != nil,
              let attachment = try? UNNotificationAttachment(identifier: "workspace", url: copy) else { return content }
        dressed.attachments = [attachment]
        return dressed
    }

    /// The site's hostname, which is the name it puts on a title it words itself.
    private func host(from info: [AnyHashable: Any]) -> String? {
        if let base = info["base_url"] as? String, let host = URL(string: base)?.host { return host }
        let sitename = info["sitename"] as? String
        return sitename?.isEmpty == false ? sitename : nil
    }

    /// A channel's workspace logo; a direct message has none.
    private func logoURL(from info: [AnyHashable: Any]) -> URL? {
        guard let logo = info["workspace_image"] as? String, !logo.isEmpty else { return nil }
        return URL(string: logo)
    }

    /// The sender's face: the site puts it in the data, and the relay in its own options.
    private func url(from info: [AnyHashable: Any]) -> URL? {
        if let image = info["image"] as? String, !image.isEmpty { return URL(string: image) }
        guard let options = info["fcm_options"] as? [AnyHashable: Any], let image = options["image"] as? String else { return nil }
        return URL(string: image)
    }
}
