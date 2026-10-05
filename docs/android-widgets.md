# Android home-screen widgets

Introduced in ServeSync 1.4.16 / Android versionCode 37. Included in both the sideload and Google Play source flavors; this GitHub APK release does not publish a Google Play update.

## Add and customize

1. Install the updated APK and open ServeSync while signed in.
2. Long-press an empty area of the Android home screen, choose **Widgets**, and find **ServeSync**.
3. Add My Next Assignment, My Schedule, Upcoming Setlist, Church Announcements, Pending Responses, or Quick Access. Separate vertical and wide assignment entries provide convenient starting sizes.
4. Choose the purpose, Minimal / Church-branded / Bold design, System / Light / Dark theme, accent color, and animation preference. Setlist widgets can follow the next approved setlist or a selected upcoming event.
5. Save, open ServeSync to populate a newly added widget, then long-press and resize it. Use the gear on larger widgets or the launcher's reconfigure control to edit an existing instance.

Sizes use **columns × rows**. Layouts adapt to the dimensions supplied by the launcher: 1×2, 2×1, 2×2, 4×1, 4×2, 4×3, and larger configurations where supported. Grid-cell dimensions vary by launcher; the configuration screen's size selector previews a layout and does not force the actual home-screen dimensions.

## Interactions and updates

- Tap a row to open its event, announcement, assignment responses, or shortcut destination. Pending responses open the existing response screen; no widget tap directly confirms or declines an assignment.
- Arrows page through saved items locally. The widget uses native pressed feedback and brief fade/slide transitions; disable motion per widget or through the phone's animation setting. Some launchers may replace views instead of animating transitions.
- Each widget keeps its own design, selection, and page. Very small widgets show only essential information and may omit the gear, previous arrow, or update label.
- Information syncs while the authenticated app is active, on resume, online recovery, route changes, and response-count refresh signals. Active widgets refresh at most once per minute on the regular foreground timer. No data queries run without installed widgets.
- Android's periodic widget callback refreshes the saved display; it does not perform background network authentication. Tap the update label or reopen ServeSync for current data. This release does not provide continuous background server refresh.
- Larger widgets display the last successful snapshot time; compact controls show Refresh. Expired snapshots (24 hours), dates that have passed, signed-out states, and unavailable feeds render appropriate placeholders on the next widget update. Android controls update scheduling.
- Displays are bounded to 40 assignments, 40 pending cards (with the full server count), 40 upcoming approved setlists, 30 songs per setlist, and 12 ordinary announcements. Open the app for complete lists.

## Privacy and implementation

The JavaScript loader uses the normal authenticated Supabase client and existing row-level access rules, adds explicit member/church filters, and makes read-only requests. No database migration or privilege change is needed. Leadership-only announcements, message bodies, private notes, and authentication tokens are not included.

The private native snapshot is tied to the same account/church scope as the app's existing device cache. Account switches and sign-out erase it and event selections; queued writes for another scope are rejected. The app disables Android backup. Widget destinations are allowlisted, use immutable pending intents, and must match the active account scope before navigation.

Main files: `src/lib/widgetSnapshot.ts`, `src/lib/loadWidgetSnapshot.ts`, `src/lib/nativeWidgets.ts`, `src/components/NativeWidgetBridge.tsx`, and `android/app/src/main/java/com/babcreations/servesync/*Widget*.java`. Both MainActivity flavors register the shared plugin.

## Verification

- Web tests exercise member/church filtering, unresolved historical invitations, chronological sorting, approved-only setlists, announcement filtering, failed feeds, cancellation, and route validation using isolated fixtures.
- Native Robolectric tests inflate Android RemoteViews across six purposes, three styles, and seven dimensions; assert visible text bounds; exercise tap destinations, paging, motion, configuration Save/Cancel, per-instance settings, sign-out/account changes, and expiry. Native rendered PNGs are generated under `android/app/build/widget-previews/` using fictional data.
- `cd android; ./gradlew :app:testSideloadDebugUnitTest :app:compilePlayDebugJavaWithJavac` checks native tests and both flavors with an installed Android SDK/JDK. Run web typecheck/tests and scoped lint before the APK build.
- Physical launcher placement/resizing, animation presentation, and a complete installed-app update still require a connected Android device. Native rendering tests do not prove physical-device behavior.
