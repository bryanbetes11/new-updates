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
        String kind = option(context, id, preview, "kind", defaultKind(context, id));
        String style = option(context, id, preview, "style", "minimal");
        String theme = option(context, id, preview, "theme", "system");
        String accent = option(context, id, preview, "accent", "emerald");
        String eventId = option(context, id, preview, "event", "");
        boolean dark = theme.equals("dark") || (theme.equals("system") && (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        boolean bold = style.equals("bold");
        int foreground = Color.parseColor(bold || dark ? "#F7F9FC" : "#172231");
        int secondary = Color.parseColor(bold ? "#E1EDE9" : dark ? "#BAC5D3" : "#4B596B");
        int accentColor = Color.parseColor(accent.equals("blue") ? (dark ? "#8EBBFF" : "#255CA8") : accent.equals("violet") ? (dark ? "#C5A4FF" : "#7540B8") : accent.equals("amber") ? (dark ? "#FBCD82" : "#985009") : (dark ? "#71DEC2" : "#087655"));
        int background = bold ? (accent.equals("blue") ? R.drawable.widget_blue : accent.equals("violet") ? R.drawable.widget_violet : accent.equals("amber") ? R.drawable.widget_amber : R.drawable.widget_emerald) : dark ? R.drawable.widget_dark : R.drawable.widget_light;
        boolean strip = height < 120;
        boolean narrow = width < 120;
        JSONObject data = WidgetStore.snapshot(context);
        boolean signedIn = !WidgetStore.scope(context).isEmpty();
        boolean hasSnapshot = data.has("updatedAt");
        List<JSONObject> cards = cards(data, kind, eventId);
        String feed = kind.equals("news") ? "announcements" : kind.equals("setlist") ? "setlists" : kind.equals("pending") ? "pending" : "assignments";
        boolean unavailable = data.optJSONArray("unavailable") != null && data.optJSONArray("unavailable").toString().contains("\"" + feed + "\"");
        if (cards.isEmpty()) {
            String message = !signedIn ? "Sign in to ServeSync" : !hasSnapshot ? "Open app to refresh" : unavailable ? "Could not refresh" : kind.equals("pending") ? "All caught up" : kind.equals("setlist") ? "No approved setlist" : kind.equals("news") ? "No announcements yet" : "No upcoming assignments";
            cards.add(card(message, !signedIn ? "Tap to get started" : "Tap to open ServeSync", !hasSnapshot ? "Connect to update your widget" : "Your church, at a glance", defaultRoute(kind)));
        }
        int rowCount = kind.equals("next") ? 1 : Math.min(cards.size(), WidgetPolicy.rows(width, height));
        int pages = Math.max(1, (cards.size() + rowCount - 1) / rowCount);
        int page = WidgetPolicy.page(WidgetStore.page(context, id), pages);
        int frame = WidgetStore.prefs(context).getInt(id + ".frame", 0);
        boolean animations = option(context, id, preview, "motion", "on").equals("on")
            && Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0
            && Settings.Global.getFloat(context.getContentResolver(), Settings.Global.TRANSITION_ANIMATION_SCALE, 1f) > 0;
        RemoteViews views = new RemoteViews(context.getPackageName(), strip
            ? (animations ? R.layout.widget_strip : R.layout.widget_strip_still)
            : (animations ? R.layout.widget_shell : R.layout.widget_shell_still));
        views.setInt(R.id.widget_root, "setBackgroundResource", background);
        int padding = Math.round((narrow || strip ? 6 : 12) * context.getResources().getDisplayMetrics().density);
        views.setViewPadding(R.id.widget_root, padding, padding, padding, padding);
        views.setOnClickPendingIntent(R.id.widget_root, open(context, id, cards.get(page * rowCount).optString("route"), "root"));
        if (!animations) {
            // Keep the displayed child fixed: content updates with no transition.
            frame = 0;
        }
        int[] containers = { R.id.widget_page_a, R.id.widget_page_b };
        for (int f = 0; f < 2; f++) {
            views.removeAllViews(containers[f]);
            int displayPage = f == frame ? page : WidgetPolicy.page(page - 1, pages);
            for (int n = displayPage * rowCount; n < Math.min(cards.size(), (displayPage + 1) * rowCount); n++) {
                JSONObject card = cards.get(n);
                RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_item);
                String detail = card.optString("detail");
                row.setTextViewText(R.id.widget_item_title, card.optString("title"));
                row.setTextViewText(R.id.widget_item_subtitle, narrow ? card.optString("subtitle").replace(" · ", "\n") : card.optString("subtitle"));
                row.setTextViewText(R.id.widget_item_detail, detail);
                row.setTextColor(R.id.widget_item_title, foreground);
                row.setTextColor(R.id.widget_item_subtitle, bold ? secondary : accentColor);
                row.setTextColor(R.id.widget_item_detail, secondary);
                row.setTextViewTextSize(R.id.widget_item_title, TypedValue.COMPLEX_UNIT_SP, narrow ? 12 : strip || rowCount > 2 ? 14 : bold ? 20 : 17);
                row.setTextViewTextSize(R.id.widget_item_subtitle, TypedValue.COMPLEX_UNIT_SP, narrow ? 10 : 12);
                row.setInt(R.id.widget_item_title, "setMaxLines", narrow && !strip ? 3 : strip || rowCount > 1 ? 1 : 2);
                row.setInt(R.id.widget_item_subtitle, "setMaxLines", narrow && !strip ? 2 : 1);
                row.setInt(R.id.widget_item_detail, "setMaxLines", rowCount > 1 ? 1 : 3);
                row.setViewVisibility(R.id.widget_item_subtitle, height < 65 ? View.GONE : View.VISIBLE);
                row.setViewVisibility(R.id.widget_item_detail, height < 220 || (rowCount > 1 && height < 260) ? View.GONE : View.VISIBLE);
                row.setContentDescription(R.id.widget_item, card.optString("title") + ", " + card.optString("subtitle") + ", " + detail + ". Tap to open.");
                row.setOnClickPendingIntent(R.id.widget_item, open(context, id, card.optString("route"), "row" + f + "-" + n));
                views.addView(containers[f], row);
            }
        }
        views.setInt(R.id.widget_flipper, "setDisplayedChild", frame);
        views.setTextColor(R.id.widget_next, foreground);
        views.setViewVisibility(R.id.widget_next, pages > 1 && (!strip || width >= 140) ? View.VISIBLE : View.GONE);
        views.setOnClickPendingIntent(R.id.widget_next, pageIntent(context, id, true));
        if (!strip) {
            String church = data.optString("churchName", "ServeSync");
            views.setTextViewText(R.id.widget_brand, style.equals("branded") ? church : "SERVESYNC");
            views.setTextColor(R.id.widget_brand, bold ? secondary : accentColor);
            views.setTextColor(R.id.widget_heading, secondary);
            String heading = kind.equals("pending") && hasSnapshot && !unavailable ? data.optInt("pendingCount") + (width < 230 ? " pending" : " pending responses") : title(kind);
            views.setTextViewText(R.id.widget_heading, narrow ? (kind.equals("next") ? "UP NEXT" : title(kind)) : heading);
            views.setViewVisibility(R.id.widget_settings, width < 220 || height < 220 ? View.GONE : View.VISIBLE);
            views.setTextColor(R.id.widget_settings, secondary);
            Intent configure = new Intent(context, WidgetConfigurationActivity.class).setData(Uri.parse("servesync-widget://configure/" + id)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            views.setOnClickPendingIntent(R.id.widget_settings, PendingIntent.getActivity(context, id, configure, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            String updated = hasSnapshot ? new SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(new Date(data.optLong("updatedAt"))) : "Open to refresh";
            views.setTextViewText(R.id.widget_refresh, width < 230 ? (pages > 1 ? (page + 1) + "/" + pages + "\nRefresh" : "Refresh") : (pages > 1 ? (page + 1) + "/" + pages + " · " : "") + (hasSnapshot ? "Updated " : "") + updated);
            views.setTextColor(R.id.widget_refresh, secondary);
            views.setContentDescription(R.id.widget_refresh, "Open ServeSync to refresh. Last updated " + updated);
            views.setOnClickPendingIntent(R.id.widget_refresh, open(context, id, defaultRoute(kind), "refresh"));
            views.setTextColor(R.id.widget_previous, foreground);
            views.setViewVisibility(R.id.widget_previous, pages > 1 && !narrow ? View.VISIBLE : View.GONE);
            views.setOnClickPendingIntent(R.id.widget_previous, pageIntent(context, id, false));
            views.setViewVisibility(R.id.widget_refresh, narrow && pages > 1 ? View.GONE : View.VISIBLE);
            views.setViewVisibility(R.id.widget_controls, height < 155 ? View.GONE : View.VISIBLE);
            views.setViewVisibility(R.id.widget_brand, narrow || height < 200 ? View.GONE : View.VISIBLE);
        }
        return views;
    }
    static String option(Context context, int id, Bundle preview, String key, String fallback) {
        return preview != null && preview.containsKey(key) ? preview.getString(key, fallback) : WidgetStore.get(context, id, key, fallback);
    }
}
