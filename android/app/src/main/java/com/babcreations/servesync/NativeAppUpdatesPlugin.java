package com.babcreations.servesync;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAppUpdates")
public class NativeAppUpdatesPlugin extends Plugin {
    @PluginMethod
    public void openDownload(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.matches("https://github\\.com/bryanbetes11/new-updates/releases/download/android-(?:test-)?v[0-9]+\\.[0-9]+\\.[0-9]+-build[1-9][0-9]*/ServeSync-[0-9]+\\.[0-9]+\\.[0-9]+-android-(?:test|release)-build[1-9][0-9]*\\.apk")) {
            call.reject("Unrecognized Android update source.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));
                call.resolve();
            } catch (Exception error) {
                call.reject("No browser could open the update download.", error);
            }
        });
    }
}
