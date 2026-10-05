package com.babcreations.servesync;

/** Pure rules shared by native rendering and local JVM regression tests. */
public final class WidgetPolicy {
    public static final long MAX_AGE_MS = 24L * 60 * 60 * 1000;
    private WidgetPolicy() {}
    public static boolean validRoute(String route) {
        return route != null && (route.matches("/(dashboard|events|my-assignments|library|announcements|messages)")
            || route.equals("/my-assignments?status=pending") || route.matches("/(events|announcements)/[a-zA-Z0-9-]+"));
    }
    public static boolean fresh(long updated, long now) {
        return updated > 0 && updated <= now + 60_000 && now - updated < MAX_AGE_MS;
    }
    public static int page(int requested, int count) { return count <= 0 ? 0 : Math.floorMod(requested, count); }
    public static int rows(float width, float height) {
        if (width < 120 || height < 140) return 1;
        return Math.max(1, Math.min(5, (int) ((height - 108) / 58)));
    }
}
