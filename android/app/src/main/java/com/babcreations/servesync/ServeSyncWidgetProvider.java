package com.babcreations.servesync;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

public class ServeSyncWidgetProvider extends AppWidgetProvider {
    public static class NextAssignment extends ServeSyncWidgetProvider {}
    public static class Schedule extends ServeSyncWidgetProvider {}
    public static class Setlist extends ServeSyncWidgetProvider {}
    public static class News extends ServeSyncWidgetProvider {}
    public static class Pending extends ServeSyncWidgetProvider {}
    public static class Quick extends ServeSyncWidgetProvider {}
    public static class Vertical extends ServeSyncWidgetProvider {}
    public static class Wide extends ServeSyncWidgetProvider {}
    static final Class<?>[] PROVIDERS = { NextAssignment.class, Schedule.class, Setlist.class, News.class, Pending.class, Quick.class, Vertical.class, Wide.class };
    static final String ACTION_NEXT = "com.babcreations.servesync.widget.NEXT";
    static final String ACTION_PREVIOUS = "com.babcreations.servesync.widget.PREVIOUS";
    static final String[] KINDS = { "next", "schedule", "setlist", "news", "pending", "quick" };
    static final String[] TITLES = { "My Next Assignment", "My Schedule", "Upcoming Setlist", "Church Announcements", "Pending Responses", "Quick Access" };

    static int[] widgetIds(Context context) {
        List<Integer> ids = new ArrayList<>();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : PROVIDERS) for (int id : manager.getAppWidgetIds(new ComponentName(context, provider))) ids.add(id);
        return ids.stream().mapToInt(Integer::intValue).toArray();
    }
    static boolean owns(Context context, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
        if (info == null) return false;
        for (Class<?> provider : PROVIDERS) if (info.provider.equals(new ComponentName(context, provider))) return true;
        return false;
    }
    static String defaultKind(Context context, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
        String name = info == null ? "" : info.provider.getClassName();
        if (name.endsWith("$Schedule")) return "schedule";
        if (name.endsWith("$Setlist")) return "setlist";
        if (name.endsWith("$News")) return "news";
        if (name.endsWith("$Pending")) return "pending";
        if (name.endsWith("$Quick")) return "quick";
        return "next";
    }
    static String kind(Context context, int id) { return WidgetStore.get(context, id, "kind", defaultKind(context, id)); }
    static String title(String kind) {
        for (int i = 0; i < KINDS.length; i++) if (KINDS[i].equals(kind)) return TITLES[i];
        return TITLES[0];
    }
    static void updateAll(Context context) { for (int id : widgetIds(context)) update(context, id); }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { for (int id : ids) update(context, id); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        WidgetStore.setPage(context, id, 0); update(context, id);
    }
    @Override public void onDeleted(Context context, int[] ids) { for (int id : ids) WidgetStore.delete(context, id); }
    @Override public void onRestored(Context context, int[] oldIds, int[] newIds) {
        for (int id : oldIds) WidgetStore.delete(context, id);
        for (int id : newIds) update(context, id);
    }
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_NEXT.equals(action) || ACTION_PREVIOUS.equals(action)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            if (!owns(context, id) || !WidgetStore.scope(context).equals(intent.getStringExtra("widgetScope"))) return;
            WidgetStore.setPage(context, id, WidgetStore.page(context, id) + (ACTION_NEXT.equals(action) ? 1 : -1));
            int frame = WidgetStore.prefs(context).getInt(id + ".frame", 0);
            WidgetStore.prefs(context).edit().putInt(id + ".frame", 1 - frame).apply();
            update(context, id);
        } else if (Intent.ACTION_CONFIGURATION_CHANGED.equals(action) || Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            updateAll(context);
        } else super.onReceive(context, intent);
    }
    static void update(Context context, int id) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Bundle options = manager.getAppWidgetOptions(id);
        if (Build.VERSION.SDK_INT >= 31) {
            ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            Map<SizeF, RemoteViews> layouts = new LinkedHashMap<>();
            if (sizes != null) for (SizeF size : sizes) {
                if (layouts.size() >= 16) break;
                layouts.put(size, render(context, id, size.getWidth(), size.getHeight(), null));
            }
            if (!layouts.isEmpty()) { manager.updateAppWidget(id, new RemoteViews(layouts)); return; }
        }
        int minW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 160);
        int maxH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 160);
        int maxW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minW);
        int minH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, maxH);
        manager.updateAppWidget(id, new RemoteViews(render(context, id, maxW, minH, null), render(context, id, minW, maxH, null)));
    }
    static String today() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US); format.setTimeZone(TimeZone.getTimeZone("Asia/Manila")); return format.format(new Date());
    }
    static JSONObject card(String title, String subtitle, String detail, String route) {
        JSONObject card = new JSONObject();
        try { card.put("title", title); card.put("subtitle", subtitle); card.put("detail", detail); card.put("route", route); } catch (Exception ignored) {}
        return card;
    }
    static List<JSONObject> cards(JSONObject data, String kind, String eventId) {
        List<JSONObject> result = new ArrayList<>();
        if (kind.equals("quick")) {
            result.add(card("My Schedule", "Your assignments", "Open schedule →", "/my-assignments"));
            result.add(card("Setlists", "Songs for your team", "Open library →", "/library"));
            result.add(card("Announcements", "Church news", "Open announcements →", "/announcements"));
            result.add(card("Chat", "Your conversations", "Open chat →", "/messages"));
            return result;
        }
        String key = kind.equals("news") ? "announcements" : kind.equals("setlist") ? "setlists" : kind.equals("pending") ? "pending" : "assignments";
        JSONArray array = data.optJSONArray(key);
        if (array == null) return result;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i); if (item == null) continue;
            String date = item.optString("date");
            if (!kind.equals("pending") && !date.isEmpty() && date.compareTo(today()) < 0) continue;
            if (kind.equals("setlist")) {
                if (!eventId.isEmpty() && !eventId.equals(item.optString("id"))) continue;
                JSONArray songs = item.optJSONArray("items");
                if (songs != null) for (int n = 0; n < songs.length(); n++) result.add(card(
                    (n + 1) + ". " + songs.optString(n), item.optString("title"), item.optString("subtitle") + " · Approved", item.optString("route")));
                if (result.isEmpty()) result.add(card(item.optString("title"), item.optString("subtitle"), "No songs yet", item.optString("route")));
                break;
            } else result.add(item);
        }
        return result;
    }
    static String defaultRoute(String kind) {
        if (kind.equals("news")) return "/announcements";
        if (kind.equals("setlist")) return "/library";
        if (kind.equals("pending")) return "/my-assignments?status=pending";
        return "/my-assignments";
    }
    static PendingIntent open(Context context, int id, String route, String slot) {
        if (!WidgetPolicy.validRoute(route)) route = "/dashboard";
        Intent intent = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("servesync-widget://open/" + id + "/" + slot))
            .putExtra("widgetRoute", route).putExtra("widgetScope", WidgetStore.scope(context))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent pageIntent(Context context, int id, boolean next) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
        ComponentName receiver = info == null ? new ComponentName(context, NextAssignment.class) : info.provider;
        Intent intent = new Intent(next ? ACTION_NEXT : ACTION_PREVIOUS).setComponent(receiver)
            .setData(Uri.parse("servesync-widget://page/" + id + "/" + next))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("widgetScope", WidgetStore.scope(context));
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static RemoteViews render(Context context, int id, float width, float height, Bundle preview) {
        return WidgetDesign.render(context, id, width, height, preview);
    }
    static String option(Context context, int id, Bundle preview, String key, String fallback) {
        return preview != null && preview.containsKey(key) ? preview.getString(key, fallback) : WidgetStore.get(context, id, key, fallback);
    }
}
