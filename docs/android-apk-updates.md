# Android APK updates

The Android app checks public releases in `bryanbetes11/new-updates` on launch and when returning to the app. Successful checks are throttled to once per six hours within the running app; failed checks retry after at least one minute on the next trigger. A foreground timer and reconnect event also trigger a check. Profile's manual check bypasses the throttle and shares any in-flight request.

This is an in-app check, not a background notification while Android has closed the app. Home shows a dismissible notice; Profile keeps the download action available. The current testing channel includes published prereleases.

## Publishing a discoverable APK

1. Increase `android/app/build.gradle`'s `versionCode` for every distributed APK. `package.json` controls the visible version; multiple Android builds can use the same visible version.
2. Build using `npm.cmd run mobile:apk -- --push`, then verify the APK's package, version code and signing certificate. Use the same signing identity for in-place updates; do not uninstall the app to work around a mismatch.
3. With explicit publication authorization, publish a GitHub release tagged `android-test-vVERSION-buildNUMBER`, with uploaded asset `ServeSync-VERSION-android-test-buildNUMBER.apk`. The updater also accepts `android-vVERSION-buildNUMBER` and `ServeSync-VERSION-android-release-buildNUMBER.apk` for a future release channel. Never reuse a build number for different distributed APK contents.
4. Verify an older installed build detects the new release, download opens correctly, Android accepts the in-place update, and the installed build number advances. Draft releases, missing/incomplete assets, older/equal build numbers and unrelated URLs are ignored. Failed checks are never reported as up to date.

The Download update button rechecks the release and opens the repository's HTTPS APK asset using Android's URL handler. The user downloads the file and confirms Update in Android's installer. ServeSync does not silently install or bypass source/installer permissions. Android retains existing app data on a compatible in-place update; installation and data retention must still be checked on the target device.

Users on APKs without the checker need to install the first checker-enabled APK once. Future published releases can then be discovered inside that app. Merely building or copying a local APK does not publish an update to everyone. The website download link remains tied to the last published APK until separately updated for an authorized release.

## Device checks for the Android improvement batch

- Swipe Videos, Songs and Sets immediately after launch, after opening/closing the account menu, and after returning from Live Mode; verify side padding and horizontal filter access.
- Back closes a dialog/preview/drawer before navigating. In Live Mode it opens the existing exit confirmation. At the start of app navigation it minimizes the app.
- Save a safe sample attachment to Downloads, cancel a save, open/share a sample file, and verify a failed download reports an error. Android saving uses the system location picker; it does not require broad storage access.
- Enter Live Mode, confirm the screen stays on, background/resume, and exit Live Mode to restore normal screen timeout. Confirm song/scroll state and unsaved drafts survive the applicable existing resume flows.
- Test Chat with keyboard visible and after returning from a file chooser. Browser-sized checks are not evidence of the physical Android keyboard, installer, native chooser or screen timeout.
