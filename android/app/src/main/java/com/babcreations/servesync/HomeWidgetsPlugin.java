package com.babcreations.servesync;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HomeWidgets")
public class HomeWidgetsPlugin extends Plugin {
    private Intent pendingIntent;
    @Override public void load() { pendingIntent = getActivity().getIntent(); }
    @PluginMethod public void setScope(PluginCall call) {
        WidgetStore.setScope(getContext(), call.getString("scope")); call.resolve();
    }
    @PluginMethod public void publish(PluginCall call) {
        JSObject snapshot = call.getObject("snapshot");
        if (snapshot == null || !WidgetStore.publish(getContext(), snapshot)) { call.reject("Widget snapshot owner is no longer active"); return; }
        call.resolve();
    }
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject(); result.put("count", ServeSyncWidgetProvider.widgetIds(getContext()).length); call.resolve(result);
    }
    @Override protected synchronized void handleOnNewIntent(Intent intent) {
        pendingIntent = intent; notifyListeners("widgetOpen", new JSObject());
    }
    @PluginMethod public synchronized void consumeRoute(PluginCall call) {
        JSObject result = new JSObject();
        if (pendingIntent != null) {
            String route = pendingIntent.getStringExtra("widgetRoute");
            String scope = pendingIntent.getStringExtra("widgetScope");
            if (WidgetPolicy.validRoute(route) && scope != null && scope.equals(WidgetStore.scope(getContext()))) {
                result.put("route", route); result.put("scope", scope);
            }
            pendingIntent.removeExtra("widgetRoute"); pendingIntent.removeExtra("widgetScope"); pendingIntent = null;
        }
        call.resolve(result);
    }
}
