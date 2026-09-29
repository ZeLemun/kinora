package com.ercin.kinora;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import java.util.Map;

/**
 * Keeps playback inside the app.
 *
 * Without this, tapping play in the middle of a provider frame threw the
 * viewer out into Chrome. Two distinct paths caused it, and `allowNavigation`
 * in capacitor.config.ts only closes one of them:
 *
 *  1. A main-frame navigation to a host that is not on the allow-list.
 *     Capacitor's `Bridge.launchIntent` sends those to ACTION_VIEW, which is
 *     the system browser. An advert inside the embed is not on the list, so
 *     clicking it opened Chrome.
 *
 *  2. A `target="_blank"` / `window.open()` popup. Capacitor's
 *     BridgeWebChromeClient does not override `onCreateWindow`, so these are
 *     never seen by the WebViewClient at all.
 *
 * So this class handles both:
 *
 *  - path 1 is blocked outright. Nothing navigates the top frame away from the
 *    app, and the app's own deliberate external links no longer rely on it
 *    because they are all `target="_blank"`.
 *  - path 2 opens the system browser, which is what those links are for: the
 *    broadcaster pages and the FIFA+ watch pages genuinely live on the web.
 *
 * The distinction is therefore *how* the link was written, not which domain it
 * points at: a link the app renders is deliberate and goes to the browser; a
 * navigation the page performs on itself is ad machinery and is dropped.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
        installNavigationGuards();
    }

    private void installNavigationGuards() {
        final Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;
        final WebView webView = bridge.getWebView();

        // Popups only reach onCreateWindow when the WebView is told to support
        // multiple windows; without this they are silently dropped and a
        // target="_blank" link does nothing at all.
        webView.getSettings().setSupportMultipleWindows(true);

        // These must *extend* Capacitor's clients, not replace them:
        // BridgeWebViewClient.shouldInterceptRequest is what serves the app's
        // own bundled assets, so a plain WebViewClient leaves the app unable to
        // load itself at all (net::ERR_CONNECTION_REFUSED).
        webView.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    if (url == null) return true;

                    // The app's own documents, and the embed hosts we declared,
                    // load here. Everything else is blocked rather than handed
                    // to the browser, which is the ad-click path.
                    if (isInApp(url, bridge)) return false;

                    // Returning true without navigating consumes the request.
                    return true;
                }
            }
        );

        webView.setWebChromeClient(
            new BridgeWebChromeClient(bridge) {
                @Override
                public boolean onCreateWindow(
                    WebView view,
                    boolean isDialog,
                    boolean isUserGesture,
                    android.os.Message resultMsg
                ) {
                    // A deliberate target="_blank" link from the app. The URL
                    // only exists on a transport WebView, so one is created,
                    // used to read it, and thrown away.
                    final WebView probe = new WebView(MainActivity.this);
                    probe.setWebViewClient(
                        new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                                openExternally(req.getUrl());
                                return true;
                            }
                        }
                    );

                    try {
                        ((android.webkit.WebView.WebViewTransport) resultMsg.obj).setWebView(probe);
                        resultMsg.sendToTarget();
                    } catch (Exception e) {
                        return false;
                    }
                    return true;
                }
            }
        );
    }

    /** The app origin plus whatever `server.allowNavigation` declared. */
    private boolean isInApp(Uri url, Bridge bridge) {
        String host = url.getHost();
        if (host == null) return false;

        // `getServerUrl()` is only set for live reload and is null in a bundled
        // build, so the app's own origin has to come from the bridge's scheme
        // and host. Getting this wrong blocks the app's own document load.
        String appHost = bridge.getHost();
        if (appHost != null && appHost.equals(host)) return true;

        return bridge.getAppAllowNavigationMask().matches(host);
    }

    private void openExternally(Uri url) {
        if (url == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (Exception ignored) {
            // No browser installed; nothing useful to do.
        }
    }
}
