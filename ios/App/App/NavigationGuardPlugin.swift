import UIKit
import WebKit
import Capacitor

/**
 Keeps playback inside the app.

 The iOS half of the work `MainActivity` does on Android, and the part that
 matters most: without it, tapping play in a provider frame throws the viewer
 out into Safari to an advert. That took three attempts to close on Android and
 both failure paths exist here too.

 Two paths, both closed:

 1. A top-level navigation to a host outside `allowNavigation`. WKWebView's
    default is to hand that to the system browser. The list is read through
    Capacitor's own `shouldAllowNavigation(to:)`, so the two platforms are
    configured from the single place — `capacitor.config.ts` — and cannot drift.

 2. `target="_blank"` / `window.open()` popups. These never reach the navigation
    delegate at all, so `WKUIDelegate.createWebViewWith` has to catch them. It
    cannot tell a link the app rendered from an advert the page opened, so the
    same explicit allow-list is used, and everything else is dropped.

 The plugin class exists so Capacitor has something to register; the delegates
 are installed by `SceneDelegate` because they must be in place before the
 bridge's first load.
 */
@objc(NavigationGuardPlugin)
public class NavigationGuardPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NavigationGuardPlugin"
    public let jsName = "NavigationGuard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hosts", returnType: CAPPluginReturnPromise)
    ]

    /**
     The only hosts allowed to open in the system browser.

     Intentionally empty, and that is the point. Every entry here was a
     sports host, and the sports section has been removed, so nothing in the
     app links out to a third-party site any more. That makes every popup an
     advert from inside a provider frame, and dropping all of them is the
     correct behaviour.

     The list stays as a seam: a popup cannot be told apart from a deliberate
     link by URL alone, so "did the app mean to go here" has to be answered by
     hand. Populating it means adverts may open those hosts in Safari.

     Kept in step with `EXTERNAL_LINK_HOSTS` in the Android MainActivity, which
     is already empty.
     */
    private static let externalLinkHosts: Set<String> = []

    @objc func hosts(_ call: CAPPluginCall) {
        call.resolve(["hosts": NavigationGuardPlugin.externalLinkHosts.sorted()])
    }

    static func isDeliberateLink(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return externalLinkHosts.contains(host)
    }
}

/// Watches every navigation leaving the web view.
final class NavigationGuard: NSObject, WKNavigationDelegate {

    private let config: InstanceConfiguration?

    init(config: InstanceConfiguration?) {
        self.config = config
        super.init()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // data: and blob: are the player's own media plumbing. Blocking them
        // would break playback outright.
        if url.scheme == "about" || url.scheme == "data" || url.scheme == "blob" {
            decisionHandler(.allow)
            return
        }

        if url.host == "localhost" {
            decisionHandler(.allow)
            return
        }

        if let host = url.host, config?.shouldAllowNavigation(to: host) == true {
            decisionHandler(.allow)
            return
        }

        // Everything else is an advert or an unlisted host. Dropped silently.
        decisionHandler(.cancel)
    }
}

/// Catches popups, which never reach the navigation delegate.
final class PopupGuard: NSObject, WKUIDelegate {

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {

        // Returning nil blocks the popup. Before blocking, hand the browser only
        // a host the app deliberately links to.
        if let url = navigationAction.request.url,
           NavigationGuardPlugin.isDeliberateLink(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return nil
    }
}
