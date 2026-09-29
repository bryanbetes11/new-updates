package com.babcreations.servesync;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void applyTheme(PluginCall call) {
        boolean darkBackground = Boolean.TRUE.equals(call.getBoolean("darkBackground", true));
        String fallbackColor = darkBackground ? "#050505" : "#f8f8fa";
        String requestedColor = call.getString("backgroundColor", fallbackColor);

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int color;
            try {
                color = Color.parseColor(requestedColor);
            } catch (IllegalArgumentException error) {
                color = Color.parseColor(fallbackColor);
            }

            window.setStatusBarColor(color);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!darkBackground);
            call.resolve();
        });
    }
}
