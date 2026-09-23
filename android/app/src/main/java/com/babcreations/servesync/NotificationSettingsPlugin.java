package com.babcreations.servesync;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.provider.Settings;
import android.os.Build;
import android.net.Uri;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {
    private static final String CHANNEL_ID = "servesync_updates";

    @PluginMethod
    public void status(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        NotificationChannel channel = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? manager.getNotificationChannel(CHANNEL_ID) : null;
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        try {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
                call.resolve();
                return;
            }
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            boolean channelBlocked = channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE;
            Intent intent = new Intent(channelBlocked ? Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS : Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            if (channelBlocked) intent.putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Open Android Settings > Apps > ServeSync > Notifications.");
        }
    }
}
