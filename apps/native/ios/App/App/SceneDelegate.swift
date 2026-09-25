import UIKit
import Capacitor
import SendIntentPlugin

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // The window and its RavenBridgeViewController root come from Main.storyboard.
        window?.applyStoredTheme()
        // A cold-start share arrives here, not in openURLContexts; the proxy replays
        // the URL only into its own handler.
        for context in connectionOptions.urlContexts where context.url.scheme == "raven" { receiveShare(context.url) }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // Re-read on every foreground so a theme changed in-app applies without a relaunch.
    func sceneWillEnterForeground(_ scene: UIScene) {
        window?.applyStoredTheme()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Share extension handoff (`raven://?title=…&type=…&url=…`, see README manual
        // step 2). Scene-based apps never get application(_:open:), where send-intent's
        // README puts this, so it lives here.
        let shares = URLContexts.filter { $0.url.scheme == "raven" }
        for context in shares { receiveShare(context.url) }
        let rest = URLContexts.subtracting(shares)
        if !rest.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: rest) }
    }

    private func receiveShare(_ url: URL) {
        guard let params = URLComponents(url: url, resolvingAgainstBaseURL: true)?.queryItems else { return }
        let field = { (name: String) in params.filter { $0.name == name }.map { $0.value ?? "" } }
        let titles = field("title"), descriptions = field("description"), types = field("type"), urls = field("url")
        let store = ShareStore.store
        store.shareItems.removeAll()
        for index in titles.indices {
            var item = JSObject()
            item["title"] = titles[index]
            item["description"] = index < descriptions.count ? descriptions[index] : ""
            item["type"] = index < types.count ? types[index] : ""
            item["url"] = index < urls.count ? urls[index] : ""
            store.shareItems.append(item)
        }
        store.processed = false
        // send-intent's plugin turns this into the `sendIntentReceived` DOM event.
        NotificationCenter.default.post(name: Notification.Name("triggerSendIntent"), object: nil)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

extension UIWindow {
    // In-app theme choice, mirrored by the web app into Capacitor Preferences.
    // Drives the WebView's prefers-color-scheme and the canvas colors alike.
    func applyStoredTheme() {
        switch UserDefaults.standard.string(forKey: "CapacitorStorage.appTheme") {
        case "dark": overrideUserInterfaceStyle = .dark
        case "light": overrideUserInterfaceStyle = .light
        default: overrideUserInterfaceStyle = .unspecified
        }
    }
}
