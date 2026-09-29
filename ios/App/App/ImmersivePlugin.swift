import UIKit
import Capacitor

/**
 Full-screen video behaviour.

 Mirror of the Android `ImmersivePlugin`. The web app calls this through
 `src/services/immersive.ts`, which wraps every call in a try/catch, so a
 missing or failing implementation degrades to "no immersive mode" rather than
 breaking the player.

 Two things are done here that the Android version gets for free:

 - Hiding the status bar. On iOS the home indicator also needs
   `prefersHomeIndicatorAutoHidden`, which is why the plugin supplies a
   view-controller override instead of only touching the window.
 - Landscape lock. iOS has no "lock orientation" call that survives a rotation
   the way `setRequestedOrientation` does, so the supported mask is swapped
   instead: the app is portrait-only until the player asks for landscape, and
   the mask is restored on the way out.
 */
@objc(ImmersivePlugin)
public class ImmersivePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "ImmersivePlugin"
    public let jsName = "Immersive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reapply", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLandscape", returnType: CAPPluginReturnPromise)
    ]

    private var orientationMask: UIInterfaceOrientationMask = .portrait
    private var immersive = false

    @objc func enter(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.setImmersive(true)
            call.resolve()
        }
    }

    @objc func exit(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.setImmersive(false)
            call.resolve()
        }
    }

    /**
     Re-hides the bars after a transient swipe.

     A no-op on iOS: iOS does not bring the bars back on a swipe the way Android
     does, and the notification this mirrors on Android has no equivalent here.
     Kept so the JS side does not need a platform check.
     */
    @objc func reapply(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func setLandscape(_ call: CAPPluginCall) {
        let locked = call.getBool("locked") ?? false
        DispatchQueue.main.async {
            self.orientationMask = locked ? .landscape : .allButUpsideDown
            self.applyOrientation()
            call.resolve()
        }
    }

    /**
     Applies the supported orientation mask to the active window scene.

     Two APIs, because the deployment target is iOS 15 and
     `requestGeometryUpdate(_:)` only exists from 16.0. The older path is the
     long-documented way to force a rotation — set the device orientation and
     ask the responder chain to re-evaluate — and it is what Capacitor's own
     ScreenOrientation plugin used before 16 existed.

     This compiled as an error rather than a warning, so it is not optional.
     */
    private func applyOrientation() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else { return }

        if #available(iOS 16.0, *) {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientationMask))
        } else {
            let raw: UIInterfaceOrientation = orientationMask == .landscape
                ? .landscapeRight
                : .portrait
            UIDevice.current.setValue(raw.rawValue, forKey: "orientation")
            UIViewController.attemptRotationToDeviceOrientation()
        }
    }

    private func setImmersive(_ on: Bool) {
        // Written to the shared state, because that is what the view-controller
        // subclass reads. Writing only the instance property would leave the UI
        // untouched while the flag claimed to be set.
        ImmersivePluginState.isImmersive = on
        immersive = on
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else { return }
        window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
        window.rootViewController?.setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
}

/// Hides the status bar and home indicator while the player is open.
///
/// iOS decides this per view controller, so the plugin cannot answer for the
/// controller Capacitor installed. This subclass exists to be adopted by that
/// controller; `ImmersivePlugin` sets the flag it reads.
final class ImmersiveViewController: UIViewController {
    override var prefersStatusBarHidden: Bool { ImmersivePluginState.isImmersive }
    override var prefersHomeIndicatorAutoHidden: Bool { ImmersivePluginState.isImmersive }
}

/// Shared so the controller subclass and the plugin agree without a back
/// reference into the plugin instance.
enum ImmersivePluginState {
    static var isImmersive = false
}
