package com.babcreations.servesync;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

final class WidgetStore {
    private WidgetStore() {}
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("servesync_widgets_v1", Context.MODE_PRIVATE); }
    static String scope(Context context) { return prefs(context).getString("scope", ""); }
    static synchronized void setScope(Context context, String next) {
        String value = next == null ? "" : next;
        if (value.equals(scope(context))) return;
        SharedPreferences.Editor editor = prefs(context).edit().putString("scope", value).remove("snapshot");
        // Appearance survives switching, but selections and page positions do not.
        for (String key : prefs(context).getAll().keySet()) {
            if (key.endsWith(".event") || key.endsWith(".page")) editor.remove(key);
        }
        editor.commit();
        ServeSyncWidgetProvider.updateAll(context);
    }
    static synchronized boolean publish(Context context, JSONObject snapshot) {
        String owner = scope(context);
        if (owner.isEmpty() || !owner.equals(snapshot.optString("scope"))) return false;
        if (snapshot.toString().length() > 180_000) return false;
        prefs(context).edit().putString("snapshot", snapshot.toString()).commit();
        ServeSyncWidgetProvider.updateAll(context);
        return true;
    }
    static synchronized JSONObject snapshot(Context context) {
        try {
            JSONObject data = new JSONObject(prefs(context).getString("snapshot", "{}"));
            if (scope(context).isEmpty() || !scope(context).equals(data.optString("scope")) ||
                !WidgetPolicy.fresh(data.optLong("updatedAt"), System.currentTimeMillis())) return new JSONObject();
            return data;
        } catch (Exception ignored) { return new JSONObject(); }
    }
    static String get(Context context, int id, String key, String fallback) { return prefs(context).getString(id + "." + key, fallback); }
    static int page(Context context, int id) { return prefs(context).getInt(id + ".page", 0); }
    static void setPage(Context context, int id, int page) { prefs(context).edit().putInt(id + ".page", page).apply(); }
    static void delete(Context context, int id) {
        SharedPreferences.Editor editor = prefs(context).edit();
        for (String key : prefs(context).getAll().keySet()) if (key.startsWith(id + ".")) editor.remove(key);
        editor.apply();
    }
}
