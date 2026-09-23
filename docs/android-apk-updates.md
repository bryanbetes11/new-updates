# Android APK updates

The Android app checks public releases in `bryanbetes11/new-updates` on launch and when returning to the app. Successful checks are throttled to once per six hours within the running app; failed checks retry after at least one minute on the next trigger. A foreground timer and reconnect event also trigger a check. App settings' manual check bypasses the throttle and shares any in-flight request.

This is an in-app check, not a background notification while Android has closed the app. Home shows a dismissible notice; App settings keeps the download action available (mobile sidebar: App updates). The current testing channel includes published prereleases.

## Publishing a discoverable APK

1. Increase `android/app/build.gradle`'s `versionCode` for every distributed APK. `package.json` controls the visible version; multiple Android builds can use the same visible version.
2. Build using `npm.cmd run mobile:apk -- --push`, then verify the APK's package, version code and signing certificate. Use the same signing identity for in-place updates; do not uninstall the app to work around a mismatch.
3. With explicit publication authorization, publish a GitHub release tagged `android-vVERSION-buildNUMBER`, with uploaded asset `ServeSync-VERSION.apk`. The updater also accepts the older test and release filenames for existing published builds. Never reuse a build number for different distributed APK contents.
4. Verify an older installed build detects the new release, download opens correctly, Android accepts the in-place update, and the installed build number advances. Draft releases, missing/incomplete assets, older/equal build numbers and unrelated URLs are ignored. Failed checks are never reported as up to date.

The Download update button rechecks the release and opens the repository's HTTPS APK asset using Android's URL handler. The user downloads the file and confirms Update in Android's installer. ServeSync does not silently install or bypass source/installer permissions. Android retains existing app data on a compatible in-place update; installation and data retention must still be checked on the target device.

Users on APKs without the checker need to install the first checker-enabled APK once. Future published releases can then be discovered inside that app. Merely building or copying a local APK does not publish an update to everyone. The website download link remains tied to the last published APK until separately updated for an authorized release.

## Device checks for the Android improvement batch

### Android 1.3.2 device cache

The first 1.3.2 APK uses Android versionCode 9 so it can update installed build 8. The display version is 1.3.2; release tags and APK filenames continue using the monotonically increasing Android code for compatibility with the existing updater.

Starting with build 12, Android keeps account-and-church-scoped snapshots without time-based expiration for Library songs/sets, video metadata, event lists, and event details including approved set charts. Pages display saved content while refreshing from Supabase. Event/Library edit controls requiring current data stay unavailable until a fresh read succeeds. Video/audio playback, attendance confirmations, permissions, and authentication are not supplied by these snapshots.

Starting with Android build 10, snapshots use IndexedDB (32 MiB total, 512 entries, 8 MiB maximum per entry). Profile pictures and song/event/video thumbnail images use app-private files (480 MiB retained total, 5 MiB per image, up to three downloads at once). The combined allowance is 512 MiB; storage grows as content is saved rather than being reserved upfront. Thumbnail downloads begin near the viewport. Successful public artwork lookup URLs are reused too. The limits apply across saved accounts; older content may be evicted. Clearing Android app storage or uninstalling also removes these files. This is faster repeat loading, not a complete offline application.

Signing out or switching accounts revokes access and cancels old cache responses without deleting that account's saved content. Returning to the same account and church restores its cache after auth hydration. App settings’ **Clear this account’s cache** removes only the current account/church snapshots and images; server content and drafts remain unchanged.

Device validation: open Songs, Sets, Videos and an event online, reopen them and restart the app, check that thumbnails and saved content return quickly; switch to another account and verify it cannot see the first account's saved content; switch back and verify it is retained. Test a network interruption after login, then reconnect and verify fresh content replaces saved data. Use App settings to clear only the current account's cache. Browser fixtures simulate native bridges and do not establish physical Android filesystem or installer behavior.

- Swipe Videos, Songs and Sets immediately after launch, after opening/closing the account menu, and after returning from Live Mode; verify side padding and horizontal filter access.
- Back closes a dialog/preview/drawer before navigating. In Live Mode it opens the existing exit confirmation. At the start of app navigation it minimizes the app.
- Save a safe sample attachment to Downloads, cancel a save, open/share a sample file, and verify a failed download reports an error. Android saving uses the system location picker; it does not require broad storage access.
- Enter Live Mode, confirm the screen stays on, background/resume, and exit Live Mode to restore normal screen timeout. Confirm song/scroll state and unsaved drafts survive the applicable existing resume flows.
- Test Chat with keyboard visible and after returning from a file chooser. Browser-sized checks are not evidence of the physical Android keyboard, installer, native chooser or screen timeout.

## Offline reading (Android 1.4.0, build 14)

After a successful online sign-in and church verification, Android can reopen the last signed-in account with its usual app navigation and page layouts when connectivity is unavailable, including when its access token needs renewal. Sign-out revokes offline access without deleting account caches; switching accounts requires internet. Cached profile data never grants online permissions. A restored connection revalidates the user and current church before online actions resume; App settings also has Reconnect.

While online, the app saves Home, Library songs/sets, video information, and the event list. It prepares up to 80 nearby events with their approved set charts, including linked service charts for rehearsals. Events and Live Mode render their usual layouts from saved content. Edits and live team cues require a server connection. YouTube video playback and other streamed media are not stored offline. Images are saved as they are viewed. The account-and-church cache has finite storage and older entries can be removed when full, so this does not guarantee that every historical item remains available.

The global connection banner, event cache readiness notice, and saved-data status banners are removed. APK assets are bundled; the browser PWA is not granted the Android offline identity fallback. Test a real device by signing in online, opening Home, Library, and an event; enable airplane mode, force-close and reopen, navigate the same tabs, read a chart in Live Mode, then reconnect and confirm fresh data returns. Confirm that edits cannot be sent while offline and that another account cannot see the first account's saved content.
