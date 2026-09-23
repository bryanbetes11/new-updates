package com.babcreations.servesync;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenAwake")
public class ScreenAwakePlugin extends Plugin {
    private boolean enabled = false;
    private boolean foreground = true;

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean requested = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            enabled = requested;
            applyFlag(enabled && foreground);
            call.resolve();
        });
    }

    @Override
    protected void handleOnPause() {
        getActivity().runOnUiThread(() -> {
            foreground = false;
            applyFlag(false);
        });
    }

    @Override
    protected void handleOnResume() {
        getActivity().runOnUiThread(() -> {
            foreground = true;
            applyFlag(enabled);
        });
    }

    @Override
    protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> {
            foreground = false;
            applyFlag(false);
        });
    }

    private void applyFlag(boolean keepAwake) {
        if (keepAwake) {
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }
}
