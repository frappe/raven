import AuthenticationServices
import Foundation
import Capacitor

/// Shell plugin for the bundled Raven page (contract: packages/lib/utils/ravenShell.ts):
/// foreground notifications for other saved sites. Share intents come from send-intent's
/// extension here, so the Android-only methods resolve as no-ops.
@objc(RavenShellPlugin)
public class RavenShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RavenShellPlugin"
    public let jsName = "RavenShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getShareIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearShareIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "applyTheme", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSiteCount", returnType: CAPPluginReturnPromise),
    ]

    // Held for the sheet's lifetime: a released session closes itself.
    private var signIn: ASWebAuthenticationSession?

    override public func load() {
        // Taps on notifications posted here route to the push handler, so the page
        // gets the same notificationActionPerformed event as for a push.
        bridge?.notificationRouter.localNotificationHandler = self
    }

    // MARK: - Sign-in

    /// The site's sign-in page in a private session, for OAuth (contract: apps/web/src/native/auth.ts).
    /// Safari's own cookies would sign the same account in again with no way to choose another.
    @objc func authorize(_ call: CAPPluginCall) {
        guard let address = call.getString("url"), let url = URL(string: address), let scheme = call.getString("scheme") else {
            return call.reject("A sign-in needs a url and a callback scheme")
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.signIn = nil
                if let callback = callback { return call.resolve(["url": callback.absoluteString]) }
                let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                if cancelled { return call.resolve(["cancelled": true]) }
                call.reject(error?.localizedDescription ?? "Sign-in failed")
            }
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = self
            self.signIn = session
            session.start()
        }
    }

    // MARK: - Foreground notifications

    // A foreground push is handed to the page (presentationOptions []); the page
    // re-posts the ones from another saved site through here.
    // The canvas behind the page follows the app's own theme; launch and foreground read the same mirror.
    @objc func applyTheme(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.bridge?.webView?.window?.applyStoredTheme()
            call.resolve()
        }
    }

    @objc func showNotification(_ call: CAPPluginCall) {
        let content = UNMutableNotificationContent()
        content.title = call.getString("title") ?? ""
        content.subtitle = call.getString("site") ?? ""
        content.body = call.getString("body") ?? ""
        content.userInfo = call.getObject("data") ?? [:]
        content.sound = .default
        // One thread per conversation, so iOS stacks its notifications together.
        if let tag = call.getString("tag") { content.threadIdentifier = tag }
        let identifier = call.getString("tag") ?? UUID().uuidString
        let post = {
            // A tagged post replaces the previous one for the same conversation.
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
            UNUserNotificationCenter.current().add(request) { _ in call.resolve() }
        }
        // Sender avatar as the attachment; a missing or slow image just leaves it out.
        guard let image = call.getString("image"), let url = URL(string: image) else { return post() }
        URLSession.shared.downloadTask(with: url) { location, _, _ in
            if let location = location {
                let file = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).\(url.pathExtension.isEmpty ? "jpg" : url.pathExtension)")
                try? FileManager.default.moveItem(at: location, to: file)
                if let attachment = try? UNNotificationAttachment(identifier: "avatar", url: file) { content.attachments = [attachment] }
            }
            post()
        }.resume()
    }

    // MARK: - Android-only surface

    @objc func getShareIntent(_ call: CAPPluginCall) {
        // iOS shares arrive through send-intent's share extension.
        call.resolve([:])
    }

    @objc func clearShareIntent(_ call: CAPPluginCall) {
        // send-intent marks a delivered share as processed itself.
        call.resolve()
    }

    @objc func setSiteCount(_ call: CAPPluginCall) {
        // The notification extension reads this: it names the site only when several are signed in.
        UserDefaults(suiteName: "group.raven.thecommit.company")?.set(call.getInt("count") ?? 0, forKey: "siteCount")
        call.resolve()
    }

    @objc func watchNotifications(_ call: CAPPluginCall) {
        // iOS hands every push to the page while the app is open; nothing here decides.
        call.resolve()
    }
}

extension RavenShellPlugin: NotificationHandlerProtocol {
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {
        bridge?.notificationRouter.pushNotificationHandler?.didReceive(response: response)
    }
}

extension RavenShellPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
