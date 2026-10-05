# Android home-screen widgets

Introduced in ServeSync 1.4.16 / Android versionCode 37. Included in both the sideload and Google Play source flavors; this GitHub APK release does not publish a Google Play update.

Paper / Pulse, Mono / Signal, and the redesigned Widget Studio are included in 1.4.17 / Android versionCode 38.

## Add and customize

1. Install the updated APK and open ServeSync while signed in.
2. Long-press an empty area of the Android home screen, choose **Widgets**, and find **ServeSync**.
3. Add My Next Assignment, My Schedule, Upcoming Setlist, Church Announcements, Pending Responses, or Quick Access. Separate vertical and wide assignment entries provide convenient starting sizes.
4. Choose Paper / Pulse or Mono / Signal, the widget purpose, theme, accent, spacing, text size, and content switches. Setlist widgets can follow the next approved setlist or a selected upcoming event.
5. Save, open ServeSync to populate a newly added widget, then long-press and resize it. Use the sliders icon on list widgets or the launcher's reconfigure control to edit an existing instance.

Sizes use **columns × rows**. Layouts adapt to the dimensions supplied by the launcher: 1×2, 2×1, 2×2, 4×1, 4×2, 4×3, and larger configurations where supported. Grid-cell dimensions vary by launcher; the configuration screen's size selector previews a layout and does not force the actual home-screen dimensions.

## Widget studio

The editor follows the phone's light/dark theme. The widget has an independent **Design default / Follow phone / Light / Dark** setting. Design default uses warm paper/coral for Paper; Mono uses charcoal/lime for assignment, pending, setlist, and news, with light schedule and shortcut cards.

The fixed preview uses the same Android renderer and saved snapshot as the home-screen widget. **Current** reads the launcher-provided dimensions; comparison chips offer 1×2 through 4×3. **Expand** opens a larger view. Preview arrows browse locally without changing the live widget or opening destinations. Empty, expired, and signed-out previews remain truthful; no fictitious personal data is inserted.

Visual style cards show native thumbnails. Options include seven accent choices (including the style default), compact/balanced/roomy spacing, three text settings, church-name visibility, extra details, artwork, a week strip on larger schedule widgets, and animation. Display titles and large numbers fit available space automatically; supporting type follows the text preference. Available space can hide secondary details. Setlist selection and purpose remain independent of appearance.

**Save widget** applies the draft to only this instance. **Cancel** discards it. Rotation retains the draft and selected preview size. **Reset design** resets appearance while preserving purpose and selected setlist. Older widget settings migrate visually to Paper (Minimal/Church-branded) or Mono (Bold), retaining existing theme/accent choices.

The orange date tile uses white lettering on deeper coral (#D93B1D); lime uses dark lettering. Decorative assets are generated illustrations/photos, not images of the user's event. Native line icons derive from Lucide; its license is in `docs/licenses/lucide-widget-icons.txt`.

## Interactions and updates

- Tap a row to open its event, announcement, assignment responses, or shortcut destination. Pending responses open the existing response screen; no widget tap directly confirms or declines an assignment.
- Arrows page through saved items locally. The widget uses native pressed feedback and brief fade/slide transitions; disable motion per widget or through the phone's animation setting. Some launchers may replace views instead of animating transitions.
- Each widget keeps its own design, selection, and page. Very small widgets show only essential information and may omit the gear, previous arrow, or update label.
- Information syncs while the authenticated app is active, on resume, online recovery, route changes, and response-count refresh signals. Active widgets refresh at most once per minute on the regular foreground timer. No data queries run without installed widgets.
- Android's periodic widget callback refreshes the saved display; it does not perform background network authentication. Tap the update label or reopen ServeSync for current data. This release does not provide continuous background server refresh.
- Most larger widgets display the snapshot time; assignment cards combine status and time. Pending count cards prioritize the invitation count and Review action. Compact widgets may omit timestamps. Expired snapshots (24 hours), dates that have passed, signed-out states, and unavailable feeds render appropriate placeholders on the next widget update. Android controls update scheduling.
- Displays are bounded to 40 assignments, 40 pending cards (with the full server count), 40 upcoming approved setlists, 30 songs per setlist, and 12 ordinary announcements. Open the app for complete lists.

## Privacy and implementation

The JavaScript loader uses the normal authenticated Supabase client and existing row-level access rules, adds explicit member/church filters, and makes read-only requests. No database migration or privilege change is needed. Leadership-only announcements, message bodies, private notes, and authentication tokens are not included.

The private native snapshot is tied to the same account/church scope as the app's existing device cache. Account switches and sign-out erase it and event selections; queued writes for another scope are rejected. The app disables Android backup. Widget destinations are allowlisted, use immutable pending intents, and must match the active account scope before navigation.

Main files: `src/lib/widgetSnapshot.ts`, `src/lib/loadWidgetSnapshot.ts`, `src/lib/nativeWidgets.ts`, `src/components/NativeWidgetBridge.tsx`, and `android/app/src/main/java/com/babcreations/servesync/*Widget*.java`. Both MainActivity flavors register the shared plugin.

## Verification

- Web tests exercise member/church filtering, unresolved historical invitations, chronological sorting, approved-only setlists, announcement filtering, failed feeds, cancellation, and route validation using isolated fixtures.
- Native Robolectric tests inflate Android RemoteViews across six purposes, two design families, and seven dimensions; assert visible text bounds; exercise tap destinations, paging, motion, configuration Save/Cancel, per-instance settings, sign-out/account changes, and expiry. Native rendered PNGs are generated under `android/app/build/widget-previews/` using fictional data.
- `cd android; ./gradlew :app:testSideloadDebugUnitTest :app:compilePlayDebugJavaWithJavac` checks native tests and both flavors with an installed Android SDK/JDK. Run web typecheck/tests and scoped lint before the APK build.
- Physical launcher placement/resizing, animation presentation, and a complete installed-app update still require a connected Android device. Native rendering tests do not prove physical-device behavior.
