import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var bridge: CAPBridge?

    /**
     Registers the custom plugins.

     The web view and its delegates are wired up in `SceneDelegate`, which runs
     first under the scene lifecycle. Registering here is still required: a
     plugin that is not registered has no proxy on the JS side, so
     `registerPlugin('BackButton')` would reject every call and the back button
     would silently never lock.

     Kept free of the navigation-guard setup on purpose. That has to happen
     before the bridge's first load, and `didFinishLaunching` is too late for it
     under a scene-based lifecycle.
     */
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Capacitor reads registered plugin classes from this bridge. The
        // bridged-plugin classes below are discovered by name at runtime, so
        // nothing else is required here.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
