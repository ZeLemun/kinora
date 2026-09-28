package com.ercin.kinora;

import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

/**
 * True immersive mode for the video player.
 *
 * Capacitor's StatusBar plugin only hides the status bar; the gesture/nav bar
 * needs WindowInsetsController. Bars reappear on a swipe and fade out again,
 * which is what the official Netflix/YouTube apps do.
 */
@com.getcapacitor.annotation.CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    @PluginMethod
    public void enter(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, window.getDecorView());
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            call.resolve(new JSObject());
        });
    }

    @PluginMethod
    public void exit(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            Window windowView = window;
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(windowView, window.getDecorView());
            controller.show(WindowInsetsCompat.Type.systemBars());
            call.resolve(new JSObject());
        });
    }

    /** Keeps the bars hidden after a transient swipe without a JS round-trip. */
    @PluginMethod
    public void reapply(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(getActivity().getWindow(), decor);
            if (decor.getSystemUiVisibility() == 0) {
                controller.hide(WindowInsetsCompat.Type.systemBars());
            }
            call.resolve(new JSObject());
        });
    }
}
