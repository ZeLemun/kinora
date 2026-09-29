import UIKit
import Capacitor

/**
 Routes the back gesture / button to the web app.

 Mirror of the Android `BackButtonPlugin`, and it exists for the same reason.
 On Android, back on the player route finished the activity and dropped the
 viewer at the launcher. iOS has the equivalent trap: the player holds a
 landscape lock and a provider frame covers the whole screen, so the app's own
 back control can be unreachable exactly when someone wants out.

 The player takes a lock while mounted; while locked the swipe-back gesture is
 intercepted and delivered to JS instead. `isModalInPresentation` is the only
 supported way to suppress the interactive pop on iOS, and it is what makes
 this work when the app root is a `UINavigationController`.

 Unlocked, nothing is touched and iOS behaves normally — which is the escape
 hatch that stops this from ever making the app impossible to leave.
 */
@objc(BackButtonPlugin)
public class BackButtonPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "BackButtonPlugin"
    public let jsName = "BackButton"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lock", returnType: CAPPluginReturnPromise)
    ]

    static var shared: BackButtonPlugin?

    private var locked = false

    override public func load() {
        super.load()
        BackButtonPlugin.shared = self
    }

    /// Consulted by `NavigationGuard` before allowing an interactive pop.
    static var isLocked: Bool { shared?.locked ?? false }

    @objc func lock(_ call: CAPPluginCall) {
        locked = call.getBool("locked") ?? true
        DispatchQueue.main.async {
            BackButtonPlugin.applyToRoot()
        }
        call.resolve()
    }

    /// The actual gesture handler, invoked by the navigation guard.
    @discardableResult
    static func handleBack() -> Bool {
        guard let plugin = shared, plugin.locked else { return false }
        plugin.notifyListeners("backPressed", data: [:])
        return true
    }

    /// Toggles the interactive pop gesture on whichever navigation controller
    /// sits at the root. A no-op when there is not one, so this cannot trap a
    /// build that uses a different root controller.
    private static func applyToRoot() {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }),
              let nav = window.rootViewController as? UINavigationController else { return }

        nav.interactivePopGestureRecognizer?.isEnabled = !isLocked
    }
}
