package com.babcreations.servesync;

import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "InteractionHaptics")
public class InteractionHapticsPlugin extends Plugin {
    @PluginMethod
    public void tap(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View view = getBridge().getWebView();
            if (view != null && view.isShown() && view.hasWindowFocus()) {
                // No override flags: respect Android's system touch-feedback setting.
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
            }
            call.resolve();
        });
    }
}
