import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = RavenBridgeViewController()
        applyStoredTheme()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // In-app theme choice, mirrored by the web app into Capacitor Preferences.
    // Drives the WebView's prefers-color-scheme and the canvas colors alike.
    private func applyStoredTheme() {
        switch UserDefaults.standard.string(forKey: "CapacitorStorage.appTheme") {
        case "dark": window?.overrideUserInterfaceStyle = .dark
        case "light": window?.overrideUserInterfaceStyle = .light
        default: window?.overrideUserInterfaceStyle = .unspecified
        }
    }

    // Re-read on every foreground so a theme changed in-app applies without a relaunch.
    func sceneWillEnterForeground(_ scene: UIScene) {
        applyStoredTheme()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
