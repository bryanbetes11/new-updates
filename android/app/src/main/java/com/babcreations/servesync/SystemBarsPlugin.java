package com.babcreations.servesync;

import android.graphics.Color;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    private static final String STATUS_BAR_PROTECTION_TAG = "servesync-status-bar-protection";

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

            window.getDecorView().setBackgroundColor(color);
            getBridge().getWebView().setBackgroundColor(color);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                applyStatusBarProtection(window, color);
            } else {
                window.setStatusBarColor(color);
            }

            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!darkBackground);
            call.resolve();
        });
    }

    private void applyStatusBarProtection(Window window, int color) {
        ViewGroup decorView = (ViewGroup) window.getDecorView();
        View protection = decorView.findViewWithTag(STATUS_BAR_PROTECTION_TAG);

        if (protection == null) {
            protection = new View(getActivity());
            protection.setTag(STATUS_BAR_PROTECTION_TAG);
            protection.setClickable(false);
            protection.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                Gravity.TOP
            );
            decorView.addView(protection, params);

            View statusBarProtection = protection;
            ViewCompat.setOnApplyWindowInsetsListener(statusBarProtection, (view, insets) -> {
                Insets statusBars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                ViewGroup.LayoutParams currentParams = view.getLayoutParams();
                if (currentParams.height != statusBars.top) {
                    currentParams.height = statusBars.top;
                    view.setLayoutParams(currentParams);
                }
                return insets;
            });
        }

        protection.setBackgroundColor(color);
        protection.bringToFront();
        ViewCompat.requestApplyInsets(protection);
    }
}
