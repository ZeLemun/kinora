import UIKit
import WebKit
import Capacitor

/**
 Keeps playback inside the app.

 The iOS half of the work `MainActivity` does on Android, and the part that
 matters most: without it, tapping play in a provider frame throws the viewer
 out into Safari to an advert. That took three attempts to close on Android and
 both failure paths exist here too.

 ## It extends, it does not replace

 This subclasses Capacitor's own `WebViewDelegationHandler` and calls through to
 `super` for anything it does not specifically block. That is not a stylistic
 choice, it is the whole reason the first build came up black.

 `CAPBridgeViewController` assigns *its* delegate to the web view
 (`aWebView.navigationDelegate = delegationHandler`), and that delegate is what
 serves the app's own bundle. Assigning a bare `WKNavigationDelegate` over the
 top — which is exactly what the first version of this file did — silently
 removed the app's ability to load itself. A black screen with no crash and
 nothing in the log.

 Two paths are blocked, both of which exist on iOS:

 1. A top-level navigation to a host outside `allowNavigation`. The list is read
    through Capacitor's own `shouldAllowNavigation(to:)`, so both platforms are
    configured from `capacitor.config.ts` and cannot drift apart.
 2. `target="_blank"` / `window.open()` popups. Capacitor's default opens *every*
    one of them in the system browser, which is precisely the ad case.

 What is deliberately *not* blocked is a sub-frame navigation, which is the third
 case and the one that caused the player to sit paused. See the note in
 `NavigationGuard.webView(_:decidePolicyFor:)` — it has its own explanation, and
 it is the reason Android and iOS behaved differently on identical code.

 The plugin class exists because Capacitor needs something to register; the
 delegate is installed by `SceneDelegate` because it has to wrap the one
 Capacitor has already assigned.
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
     sports host and the sports section has been removed, so nothing in the app
     links out to a third-party site any more. That makes every popup an advert
     from inside a provider frame, and dropping all of them is correct.

     The list stays as a seam: a popup cannot be told apart from a deliberate
     link by URL alone, so "did the app mean to go here" has to be answered by
     hand. Kept in step with `EXTERNAL_LINK_HOSTS` in the Android MainActivity,
     which is already empty.
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

/**
 Wraps Capacitor's delegate rather than replacing it.

 Everything this does not explicitly block is handed to `super`, which is what
 keeps the local bundle, the script message handler and the scroll behaviour
 working.
 */
final class NavigationGuard: WebViewDelegationHandler {

    private let allowList: InstanceConfiguration?
    /// The exact origin the app boots from, e.g. `kinora://localhost`.
    private let appOrigin: URL?

    init(allowList: InstanceConfiguration?) {
        self.allowList = allowList
        self.appOrigin = allowList?.appStartServerURL
        super.init()
    }

    /// True for the app's own documents and resources.
    private func isAppURL(_ url: URL) -> Bool {
        guard let origin = appOrigin else { return false }
        if url.scheme != origin.scheme { return false }
        // The custom scheme always serves from localhost; the port is not part
        // of the identity, so the host is compared rather than the full origin.
        return url.host == origin.host
    }

    override func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // A nil target frame is a new window: `target="_blank"` or
        // `window.open()`. Dropped outright — that is the advert path, and
        // Capacitor's default for it is the system browser.
        if navigationAction.targetFrame == nil {
            decisionHandler(.cancel)
            return
        }

        /*
         Sub-frames are the provider's own business, and this is the single
         most important line in the file.

         A provider player runs its preroll advert inside a nested iframe, and
         WKNavigationDelegate's `decidePolicyFor` is called for sub-frame
         navigations exactly as it is for the top one. Treating them the same
         — which the first version of this file did — cancels the advert,
         because an ad host is never going to be on `allowNavigation`. VidCore
         then gives up on its preroll and parks the video paused a few seconds
         in, behind its own play button: the app looked like it could not
         autoplay, when in fact it had killed the thing that starts playback.

         Android never saw this, and the asymmetry is the tell. WebView's
         `shouldOverrideUrlLoading` is only ever called for the main frame, so
         the equivalent guard there was correct by default. WKWebView has no
         such default.

         Letting sub-frames through costs nothing: the two things worth blocking
         are a top-level navigation away from the app and a popup, and both are
         handled above and below.
         */
        if navigationAction.targetFrame?.isMainFrame == false {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        guard let url = navigationAction.request.url else {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        // data: and blob: are the player's own media plumbing. Blocking them
        // would break playback outright.
        if url.scheme == "data" || url.scheme == "blob" {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        // The app's own origin, whatever scheme capacitor.config.ts gave it.
        // Getting this wrong is what a black screen looks like.
        if isAppURL(url) {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        if url.scheme == "about" {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        if let host = url.host, allowList?.shouldAllowNavigation(to: host) == true {
            super.webView(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
            return
        }

        // An advert, or any host not on the list. Dropped without a dialog.
        decisionHandler(.cancel)
    }

    /**
     Popups never reach the navigation delegate.

     Capacitor's default opens every one in the system browser, which is the ad
     case. Only a host the app deliberately links to is offered to the browser;
     everything else is dropped, which the default return of nil does.
     */
    override func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url,
           NavigationGuardPlugin.isDeliberateLink(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return nil
    }
}
