# ServeSync Google Play build

The next Play bundle uses package `com.babcreations.servesync`, Android version code **33**, and the version name from `package.json` (currently 1.4.12). Its native code excludes the GitHub APK updater and its manifest excludes `REQUEST_INSTALL_PACKAGES`. App settings opens the Play listing for updates. The sideload flavor keeps the existing updater and Android version code 31.

Play build 33 adds a Google Play immediate update check on app launch and resume. When Play reports a newer eligible version, the app blocks use with an Update/Exit dialog and starts Google's immediate update flow. If that flow cannot start, Update opens the Play listing. A failed Play availability check does not lock out the user; the app retries on the next resume. This applies only to Play-installed builds; a new Play release with a higher version code is required for each enforced update. Build 32, already published, cannot enforce updates retroactively. Test the blocker by installing build 33 from Play, publishing a later build with a higher code, and opening build 33 on the same tester device.

## Build

1. Keep the upload keystore and credentials outside this repository. On this machine they live in `C:/Users/Bryan/ServeSyncSigning/`; the build script finds `key.properties` there. On another machine, set `SERVESYNC_SIGNING_PROPERTIES` to a properties file containing `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. The ignored `android/key.properties` is also supported. Back up the keystore and credentials securely before relying on this upload identity. Never commit either file.
2. Run `npm run mobile:play -- --push` from the repository root. The `--push` option includes the existing Firebase Android configuration. The script builds Play web assets, syncs Capacitor, and runs `bundlePlayRelease`.
3. Verify `android/app/build/outputs/bundle/playRelease/app-play-release.aab` has the expected package, version code, permissions, contents, and upload certificate before uploading it to Play Console. Keep the upload certificate distinct from Google's app signing certificate shown in Play Console.

The existing APK testing command is `npm run mobile:apk -- --push`. It builds `assembleSideloadDebug` with the existing sideload update flow. A Play install cannot directly replace existing debug-signed APK installations with this new upload identity. Testers must preserve any needed local data before uninstalling the APK and installing from Play; device migration has not been tested.

Version code 32 was used for the first Play bundle. Raise the sideload code past 33 before distributing any later APK update, and keep every future Play code above every previously uploaded Play code. Build each channel through its npm script so its bundled web assets match the selected native variant.
