package com.babcreations.servesync;

import static org.junit.Assert.*;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import android.widget.ViewFlipper;
import android.widget.Spinner;
import org.robolectric.Robolectric;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.io.File;
import java.io.FileOutputStream;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, qualifiers = "mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WidgetRenderingTest {
    private Context context;
    private final int id = 71;
    @Before public void setup() throws Exception {
        context = RuntimeEnvironment.getApplication();
        WidgetStore.prefs(context).edit().clear().commit();
        AppWidgetProviderInfo info = new AppWidgetProviderInfo();
        info.provider = new ComponentName(context, ServeSyncWidgetProvider.NextAssignment.class);
        Shadows.shadowOf(AppWidgetManager.getInstance(context)).addBoundWidget(id, info);
        WidgetStore.setScope(context, "member-a:church-a");
        WidgetStore.publish(context, fixture());
    }
    private JSONObject fixture() throws Exception {
        JSONObject data = new JSONObject();
        data.put("scope", "member-a:church-a"); data.put("updatedAt", System.currentTimeMillis()); data.put("churchName", "Grace Community Church");
        JSONArray assignments = new JSONArray();
        for (int n = 0; n < 7; n++) {
            JSONObject card = ServeSyncWidgetProvider.card(n == 0 ? "Sunday Worship" : "Team Rehearsal " + n, "Oct 11 · 9:00 AM", "Guitarist · Confirmed", "/events/event-" + n);
            card.put("id", "event-" + n); card.put("date", "2099-10-11"); assignments.put(card);
        }
        data.put("assignments", assignments); data.put("pending", assignments); data.put("pendingCount", 7);
        JSONObject setlist = ServeSyncWidgetProvider.card("Sunday Worship", "Oct 11 · 9:00 AM", "Approved", "/events/service-1");
        setlist.put("id", "service-1"); setlist.put("date", "2099-10-11"); setlist.put("items", new JSONArray().put("Great Are You Lord · G").put("Goodness of God · A").put("Build My Life · D"));
        data.put("setlists", new JSONArray().put(setlist));
        data.put("announcements", new JSONArray().put(ServeSyncWidgetProvider.card("Church family gathering", "Church news", "Join us after the service for fellowship and a shared meal.", "/announcements/news-1")));
        data.put("unavailable", new JSONArray()); return data;
    }
    private View inflate(String kind, String style, String theme, int width, int height, String motion) {
        Bundle options = new Bundle(); options.putString("kind", kind); options.putString("style", style); options.putString("theme", theme); options.putString("motion", motion);
        RemoteViews remote = ServeSyncWidgetProvider.render(context, id, width, height, options);
        View view = remote.apply(context, new FrameLayout(context));
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, width, height); return view;
    }
    @Test public void allPurposesSizesStylesInflateAndHaveVisibleContent() {
        int[][] sizes = {{56, 160}, {130, 64}, {160, 180}, {280, 64}, {310, 230}, {310, 360}, {500, 400}};
        for (String kind : ServeSyncWidgetProvider.KINDS) for (String style : new String[]{"minimal", "branded", "bold"}) for (int[] size : sizes) {
            View view = inflate(kind, style, "dark", size[0], size[1], "on");
            ViewFlipper flipper = view.findViewById(R.id.widget_flipper);
            ViewGroup page = (ViewGroup) flipper.getCurrentView();
            assertTrue(kind + " content has height", page.getHeight() > 0);
            assertTrue(page.getChildCount() > 0);
            for (int n = 0; n < page.getChildCount(); n++) {
                TextView title = page.getChildAt(n).findViewById(R.id.widget_item_title);
                assertTrue(kind + " title is visible at " + size[0] + "x" + size[1], title.getHeight() > 0);
                assertTrue(title.getText().length() > 0);
                assertTrue("row stays inside content", page.getChildAt(n).getBottom() <= page.getHeight());
                for (int textId : new int[]{R.id.widget_item_title, R.id.widget_item_subtitle, R.id.widget_item_detail}) {
                    View text = page.getChildAt(n).findViewById(textId);
                    if (text.getVisibility() == View.VISIBLE) {
                        assertTrue(kind + " text fits row at " + size[0] + "x" + size[1], text.getTop() >= 0 && text.getBottom() <= page.getChildAt(n).getHeight());
                    }
                }
            }
        }
    }
    @Test public void producesNativePreviews() throws Exception {
        File directory = new File("build/widget-previews"); directory.mkdirs();
        String[] kinds = {"next", "schedule", "setlist", "news", "pending", "quick"};
        int[][] sizes = {{64, 180}, {310, 230}, {310, 360}, {310, 230}, {160, 180}, {160, 76}};
        for (int i = 0; i < kinds.length; i++) {
            View view = inflate(kinds[i], i % 3 == 0 ? "bold" : i % 3 == 1 ? "branded" : "minimal", i % 2 == 0 ? "dark" : "light", sizes[i][0], sizes[i][1], "off");
            Bitmap bitmap = Bitmap.createBitmap(sizes[i][0], sizes[i][1], Bitmap.Config.ARGB_8888); view.draw(new Canvas(bitmap));
            try (FileOutputStream output = new FileOutputStream(new File(directory, kinds[i] + ".png"))) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); }
        }
    }
    @Test public void pagingIsLocalAndRejectsOtherAccount() {
        Intent next = new Intent(ServeSyncWidgetProvider.ACTION_NEXT).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("widgetScope", "member-a:church-a");
        new ServeSyncWidgetProvider.NextAssignment().onReceive(context, next);
        assertEquals(1, WidgetStore.page(context, id));
        next.putExtra("widgetScope", "member-b:church-b");
        new ServeSyncWidgetProvider.NextAssignment().onReceive(context, next);
        assertEquals(1, WidgetStore.page(context, id));
    }
    @Test public void tappingRowOpensScopedEvent() {
        View view = inflate("next", "minimal", "light", 310, 230, "off");
        ViewFlipper flipper = view.findViewById(R.id.widget_flipper);
        flipper.getCurrentView().findViewById(R.id.widget_item).performClick();
        Intent intent = Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedActivity();
        assertNotNull(intent); assertEquals("/events/event-0", intent.getStringExtra("widgetRoute"));
        assertEquals("member-a:church-a", intent.getStringExtra("widgetScope"));
    }
    @Test public void reducedMotionHasNoAnimations() {
        View view = inflate("next", "bold", "light", 310, 230, "off");
        ViewFlipper flipper = view.findViewById(R.id.widget_flipper);
        assertNull(flipper.getInAnimation()); assertNull(flipper.getOutAnimation());
    }
    @Test public void motionEnabledHasShortTransitionsAndCanReapply() {
        View view = inflate("next", "bold", "light", 310, 230, "on");
        ViewFlipper flipper = view.findViewById(R.id.widget_flipper);
        assertNotNull(flipper.getInAnimation()); assertTrue(flipper.getInAnimation().getDuration() <= 200);
        WidgetStore.setPage(context, id, 1);
        WidgetStore.prefs(context).edit().putInt(id + ".frame", 1).commit();
        Bundle options = new Bundle(); options.putString("kind", "next"); options.putString("style", "bold"); options.putString("theme", "light");
        ServeSyncWidgetProvider.render(context, id, 310, 230, options).reapply(context, view);
        assertEquals(1, flipper.getDisplayedChild());
        assertEquals("Team Rehearsal 1", ((TextView) flipper.getCurrentView().findViewById(R.id.widget_item_title)).getText().toString());
    }
    @Test public void signOutAndSwitchEraseSnapshotAndRejectLateWrites() throws Exception {
        WidgetStore.prefs(context).edit().putString(id + ".event", "service-1").commit();
        WidgetStore.setScope(context, null);
        assertFalse(WidgetStore.snapshot(context).has("assignments")); assertFalse(WidgetStore.publish(context, fixture()));
        WidgetStore.setScope(context, "member-b:church-b");
        assertFalse(WidgetStore.publish(context, fixture())); assertEquals("", WidgetStore.get(context, id, "event", ""));
    }
    @Test public void expiredDataIsNotDisplayed() throws Exception {
        JSONObject expired = fixture(); expired.put("updatedAt", System.currentTimeMillis() - WidgetPolicy.MAX_AGE_MS - 1);
        WidgetStore.publish(context, expired); assertFalse(WidgetStore.snapshot(context).has("assignments"));
        View view = inflate("next", "minimal", "light", 310, 230, "off");
        ViewFlipper flipper = view.findViewById(R.id.widget_flipper);
        assertEquals("Open app to refresh", ((TextView) flipper.getCurrentView().findViewById(R.id.widget_item_title)).getText().toString());
    }
    @Test public void routesAndPaginationHaveSafeBoundaries() {
        assertFalse(WidgetPolicy.validRoute("https://evil.example")); assertFalse(WidgetPolicy.validRoute("/events/../admin"));
        assertTrue(WidgetPolicy.validRoute("/my-assignments?status=pending"));
        assertEquals(2, WidgetPolicy.page(-1, 3)); assertEquals(0, WidgetPolicy.page(30, 0));
        assertFalse(WidgetPolicy.fresh(0, 100));
    }
    private View findText(View root, String text) {
        if (root instanceof TextView && ((TextView) root).getText().toString().equals(text)) return root;
        if (root instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) root).getChildCount(); i++) {
            View result = findText(((ViewGroup) root).getChildAt(i), text); if (result != null) return result;
        }
        return null;
    }
    private Spinner spinner(View root, String label) {
        if (root instanceof Spinner && label.contentEquals(root.getContentDescription())) return (Spinner) root;
        if (root instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) root).getChildCount(); i++) {
            Spinner result = spinner(((ViewGroup) root).getChildAt(i), label); if (result != null) return result;
        }
        return null;
    }
    @Test public void configurationSavesOnlyThisWidgetAndCancelPreservesSettings() {
        Intent intent = new Intent(context, WidgetConfigurationActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        try (var controller = Robolectric.buildActivity(WidgetConfigurationActivity.class, intent).setup().visible()) {
            WidgetConfigurationActivity activity = controller.get(); View root = activity.getWindow().getDecorView();
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            spinner(root, "Design").setSelection(2); spinner(root, "Theme").setSelection(2);
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertEquals("unset", WidgetStore.get(context, id, "style", "unset"));
            findText(root, "Save widget").performClick();
            assertEquals("bold", WidgetStore.get(context, id, "style", "unset"));
            assertEquals("dark", WidgetStore.get(context, id, "theme", "unset"));
            assertEquals("unset", WidgetStore.get(context, 72, "style", "unset"));
            assertEquals(ActivityResult.OK, Shadows.shadowOf(activity).getResultCode());
        }
        try (var controller = Robolectric.buildActivity(WidgetConfigurationActivity.class, intent).setup().visible()) {
            View root = controller.get().getWindow().getDecorView();
            spinner(root, "Design").setSelection(0); Shadows.shadowOf(Looper.getMainLooper()).idle();
            findText(root, "Cancel").performClick();
            assertEquals("bold", WidgetStore.get(context, id, "style", "unset"));
        }
    }
    private static class ActivityResult { static final int OK = android.app.Activity.RESULT_OK; }
}
