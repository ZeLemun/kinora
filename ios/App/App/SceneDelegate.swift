import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let controller = CAPBridgeViewController()
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        // Register the custom plugins.
        //
        // Explicit, not relied upon to be discovered: Capacitor auto-registers
        // Cordova-style entries from capacitor.config.json, and a CAPBridgedPlugin
        // that is never registered simply has no proxy on the JS side — so
        // `registerPlugin('BackButton')` would reject every call and the back
        // button would silently never lock, with nothing in the log.
        if let bridge = controller.bridge {
            bridge.registerPluginType(ImmersivePlugin.self)
            bridge.registerPluginType(BackButtonPlugin.self)
            bridge.registerPluginType(NavigationGuardPlugin.self)
        }

        // Install the navigation guards before the bridge's first load.
        //
        // A delegate attached after that first navigation misses it, and the
        // navigation that matters most is the first one: with no delegate in
        // place, a top-level navigation to an advert host goes straight to
        // Safari. This is the iOS equivalent of
        // `MainActivity.installNavigationGuards`, which Android also calls
        // before the WebView settles.
        if let webView = controller.bridgedWebView {
            webView.navigationDelegate = NavigationGuard(config: controller.bridge?.config)
            webView.uiDelegate = PopupGuard()
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
