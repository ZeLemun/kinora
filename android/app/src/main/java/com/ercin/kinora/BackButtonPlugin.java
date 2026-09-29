package com.ercin.kinora;

import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Routes the hardware / gesture back button to the web app.
 *
 * Without this the player is a trap. Capacitor installs no back handler of its
 * own, so back fell through to the platform default, which finished the
 * activity and dropped the viewer at the launcher. Verified on device.
 *
 * The reason WebView history could not be the fallback: a provider frame covers
 * the entire screen, and by the time someone wants out they are interacting with
 * that frame, not with the app's chrome. A native back callback is the one
 * signal a cross-origin frame cannot swallow.
 *
 * Two APIs are needed, because the old one no longer runs:
 *   - API 33+ routes back through {@link OnBackInvokedDispatcher}, and
 *     `onBackPressed()` is never called. Overriding it in the activity compiles
 *     and does nothing — the symptom is identical, so it is easy to misread as
 *     "the plugin isn't working".
 *   - Below 33 there is no dispatcher, so the activity's onBackPressed is the
 *     only hook. MainActivity handles that path and calls in here too.
 */
@CapacitorPlugin(name = "BackButton")
public class BackButtonPlugin extends Plugin {

    private static volatile BackButtonPlugin instance;

    private boolean locked = false;
    private OnBackInvokedCallback callback;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void lock(PluginCall call) {
        setLocked(Boolean.TRUE.equals(call.getBoolean("locked", true)));
        call.resolve(new JSObject());
    }

    public boolean isLocked() {
        return locked;
    }

    private void setLocked(boolean next) {
        locked = next;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            OnBackInvokedDispatcher dispatcher = getBridge().getActivity().getOnBackInvokedDispatcher();
            if (next) {
                if (callback == null) {
                    callback = () -> notifyListeners("backPressed", new JSObject());
                    dispatcher.registerOnBackInvokedCallback(
                            OnBackInvokedDispatcher.PRIORITY_OVERLAY, callback);
                }
            } else if (callback != null) {
                dispatcher.unregisterOnBackInvokedCallback(callback);
                callback = null;
            }
        }
    }

    /** Called from MainActivity.onBackPressed. Only used below API 33. */
    public static boolean dispatchOnBack() {
        BackButtonPlugin plugin = instance;
        if (plugin == null || !plugin.locked) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return false;
        plugin.notifyListeners("backPressed", new JSObject());
        return true;
    }
}
