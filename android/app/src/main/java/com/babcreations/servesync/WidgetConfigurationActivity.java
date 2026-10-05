package com.babcreations.servesync;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Each home-screen instance owns its settings; Cancel never changes them. */
public class WidgetConfigurationActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final Bundle draft = new Bundle();
    private FrameLayout preview;
    private LinearLayout content;
    private LinearLayout eventGroup;
    private Spinner size;
    private final int[][] SIZES = { {64, 180}, {160, 76}, {160, 180}, {310, 76}, {310, 230}, {310, 360} };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!ServeSyncWidgetProvider.owns(this, widgetId)) { finish(); return; }
        if (saved != null && saved.getBundle("draft") != null) draft.putAll(saved.getBundle("draft"));
        content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(24), dp(20), dp(24), dp(28));
        content.setBackgroundColor(Color.rgb(245, 247, 250));
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.addView(content); setContentView(scroll);
        // Target SDK 36 enforces edge-to-edge: keep every control inside system bars.
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        label("YOUR HOME SCREEN", 11, true);
        label("Make it yours", 30, true);
        label("Choose what matters, pick a style, then resize the widget on your home screen.", 14, false);
        preview = new FrameLayout(this);
        LinearLayout.LayoutParams previewParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(230));
        previewParams.topMargin = dp(20); previewParams.bottomMargin = dp(12); content.addView(preview, previewParams);
        size = select("Preview size · columns × rows", new String[]{"1 × 2 · Vertical", "2 × 1 · Compact", "2 × 2 · Square", "4 × 1 · Wide", "4 × 2 · Expanded", "4 × 3 · Agenda"}, 4, position -> renderPreview());
        String initialKind = value("kind", ServeSyncWidgetProvider.defaultKind(this, widgetId));
        select("Widget purpose", ServeSyncWidgetProvider.TITLES, index(ServeSyncWidgetProvider.KINDS, initialKind), position -> {
            draft.putString("kind", ServeSyncWidgetProvider.KINDS[position]);
            if (eventGroup != null) eventGroup.setVisibility(position == 2 ? View.VISIBLE : View.GONE);
            renderPreview();
        });
        selectOption("Design", "style", new String[]{"minimal", "branded", "bold"}, new String[]{"Minimal · clean and focused", "Church-branded · church name and accent", "Bold · rich color and larger type"}, "minimal");
        selectOption("Theme", "theme", new String[]{"system", "light", "dark"}, new String[]{"Follow phone theme", "Light", "Dark"}, "system");
        selectOption("Accent color", "accent", new String[]{"emerald", "blue", "violet", "amber"}, new String[]{"Emerald", "Blue", "Violet", "Amber"}, "emerald");
        eventGroup = new LinearLayout(this); eventGroup.setOrientation(LinearLayout.VERTICAL);
        content.addView(eventGroup);
        LinearLayout outer = content; content = eventGroup;
        List<String> eventIds = new ArrayList<>(Arrays.asList(""));
        List<String> eventLabels = new ArrayList<>(Arrays.asList("Next approved setlist · automatic"));
        JSONArray setlists = WidgetStore.snapshot(this).optJSONArray("setlists");
        if (setlists != null) for (int i = 0; i < setlists.length(); i++) {
            JSONObject event = setlists.optJSONObject(i); if (event == null || event.optString("date").compareTo(ServeSyncWidgetProvider.today()) < 0) continue;
            eventIds.add(event.optString("id")); eventLabels.add(event.optString("title") + " · " + event.optString("subtitle"));
        }
        String selectedEvent = value("event", "");
        if (!eventIds.contains(selectedEvent)) { eventIds.add(selectedEvent); eventLabels.add("Previously selected event · refresh app to check"); }
        select("Setlist event", eventLabels.toArray(new String[0]), Math.max(0, eventIds.indexOf(selectedEvent)), position -> { draft.putString("event", eventIds.get(position)); renderPreview(); });
        content = outer;
        eventGroup.setVisibility(initialKind.equals("setlist") ? View.VISIBLE : View.GONE);
        Switch motion = new Switch(this); motion.setText("Animate item changes"); motion.setTextColor(Color.rgb(23, 34, 49)); motion.setMinHeight(dp(56));
        motion.setChecked(value("motion", "on").equals("on"));
        motion.setOnCheckedChangeListener((button, enabled) -> { draft.putString("motion", enabled ? "on" : "off"); renderPreview(); }); content.addView(motion);
        label("Tap an item to open it. Use the arrows to browse. Larger sizes show more items; small sizes keep the essentials. Available sizes depend on your launcher.", 13, false);
        label("Widgets use the account currently signed in. Updates sync while ServeSync is open; tap the update label to open and refresh. Saved content expires after 24 hours. Leadership-only news and chat messages are never shown.", 12, false);
        if (!WidgetStore.snapshot(this).has("updatedAt")) label("Open ServeSync after adding this widget to load your church information.", 13, true);
        Button save = new Button(this); save.setText("Save widget"); save.setMinHeight(dp(52));
        save.setOnClickListener(view -> {
            if (!ServeSyncWidgetProvider.owns(this, widgetId)) { finish(); return; }
            android.content.SharedPreferences.Editor editor = WidgetStore.prefs(this).edit();
            for (String key : new String[]{"kind", "style", "theme", "accent", "event", "motion"}) if (draft.containsKey(key)) editor.putString(widgetId + "." + key, draft.getString(key));
            editor.putInt(widgetId + ".page", 0).putInt(widgetId + ".frame", 0).commit();
            ServeSyncWidgetProvider.update(this, widgetId);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)); finish();
        }); content.addView(save);
        Button cancel = new Button(this); cancel.setText("Cancel"); cancel.setOnClickListener(view -> finish()); content.addView(cancel);
        renderPreview();
    }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); out.putBundle("draft", draft); }
    private String value(String key, String fallback) { return draft.containsKey(key) ? draft.getString(key, fallback) : WidgetStore.get(this, widgetId, key, fallback); }
    private int index(String[] values, String value) { return Math.max(0, Arrays.asList(values).indexOf(value)); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void label(String text, int size, boolean bold) {
        TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(Color.rgb(23, 34, 49));
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        view.setPadding(0, dp(8), 0, dp(6)); content.addView(view);
    }
    private interface Selection { void select(int position); }
    private Spinner select(String label, String[] values, int selected, Selection onSelect) {
        label(label, 13, true);
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, values);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); spinner.setAdapter(adapter); spinner.setSelection(selected);
        spinner.setContentDescription(label); spinner.setMinimumHeight(dp(48)); content.addView(spinner);
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            public void onItemSelected(AdapterView<?> parent, View view, int position, long itemId) { onSelect.select(position); }
            public void onNothingSelected(AdapterView<?> parent) {}
        }); return spinner;
    }
    private void selectOption(String label, String key, String[] values, String[] labels, String fallback) {
        select(label, labels, index(values, value(key, fallback)), position -> { draft.putString(key, values[position]); renderPreview(); });
    }
    private void renderPreview() {
        if (preview == null || size == null) return;
        int[] dimensions = SIZES[size.getSelectedItemPosition()];
        int available = Math.max(dp(64), getResources().getDisplayMetrics().widthPixels - dp(48));
        int width = Math.min(dp(dimensions[0]), available);
        preview.removeAllViews();
        preview.getLayoutParams().height = dp(dimensions[1]);
        View rendered = ServeSyncWidgetProvider.render(this, widgetId, width / getResources().getDisplayMetrics().density, dimensions[1], draft).apply(this, preview);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, dp(dimensions[1]), android.view.Gravity.CENTER);
        preview.addView(rendered, params);
        // Preview cannot submit actions or unexpectedly navigate away.
        disableClicks(rendered);
        preview.requestLayout();
    }
    private void disableClicks(View view) {
        view.setOnClickListener(null); view.setClickable(false);
        if (view instanceof ViewGroup) { ViewGroup group = (ViewGroup) view; for (int i = 0; i < group.getChildCount(); i++) disableClicks(group.getChildAt(i)); }
    }
}
