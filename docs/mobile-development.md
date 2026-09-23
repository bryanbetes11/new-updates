# ServeSync mobile development

Updated: 2026-09-23. Status: Android development package compiled; NOT store-ready. iOS source prepared; NOT compiled.

## What is saved

- `capacitor.config.ts`: bundled web assets, ServeSync name, provisional `com.babcreations.servesync` identity, HTTPS Android local origin, mixed content disabled.
- `android/`: native Android project, version 1.3.0/build 1, API 36 target, camera/microphone permission declarations for existing QR and Voice Key Assist flows. Android cloud backup disabled to avoid restoring app session data.
- `ios/`: generated Xcode/Swift Package Manager project, version 1.3.0/build 1, camera/microphone purpose strings. Signing/team selection and native verification remain pending.
- `src/lib/nativePlatform.ts` and native guards: native packages cannot install web-service-worker updates. Native profile update checks explain the separate update mechanism.
- Native push controls show a test-build limitation instead of an unusable browser-permission flow. No native push registration or delivery has been implemented.
- Existing website behavior stays on the web branch. Unrelated pre-existing `Layout.tsx` edits remain untouched and are included in the working-tree build.

## Local prerequisites

Node 22+, Java 21 recommended, Android SDK platform 36, Android build tools, and platform-tools/adb.

This Windows machine now has Android Studio and Temurin Java 21 installed. SDK root: `%LOCALAPPDATA%/Android/Sdk`. Scripts locate Temurin 21 without changing the machine's default Java. Gradle 8.14.3 does not support the Java 25 bundled with the installed Android Studio; select Temurin 21 as Android Studio's Gradle JDK if building there.

Both tracked npm and pnpm lockfiles include pinned Capacitor packages. After a dependency install, run Capacitor sync because generated native dependency paths can differ between npm and pnpm layouts.

## Build commands

Run from the repository root:

```powershell
npm.cmd run mobile:doctor
npm.cmd run mobile:apk
```

`mobile:apk` checks prerequisites, builds the web app, syncs Android assets/plugins, then builds a debug APK. It stops if a step fails. The package is at `android/app/build/outputs/apk/debug/app-debug.apk`.

Other commands:

```powershell
npm.cmd run mobile:open:android
npm.cmd run mobile:sync:ios
npm.cmd run mobile:open:ios
```

The iOS open/build steps require a Mac with Xcode. Windows can generate/sync source, which does not establish that the iOS app compiles or works.

Developer-only: `node scripts/build-android.mjs --skip-web-build` reuses an already verified, current `dist`; do not use it after changing web source.

## Install on the Android phone

1. Enable Developer options and USB debugging on the phone, connect a USB data cable, and approve this computer's debugging prompt yourself.
2. List devices and verify the intended phone is connected and authorized.
3. Install the development package on that device. With more than one device connected, supply its serial using `adb -s SERIAL install ...`.

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" devices -l
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r 'android/app/build/outputs/apk/debug/app-debug.apk'
```

The debug app uses the existing backend configuration. Use an isolated test account/church for writes; do not send test messages, reminders, or attendance changes to real members. A debug APK is not suitable for public distribution or Play upload.

## Device acceptance checklist (all pending)

- Install/launch; verify ServeSync identity and loading/error states.
- Login, logout, session restoration and account switching; no prior account data after switching.
- Android Back, keyboard, screen edges, portrait/landscape and file selection/download/share.
- Events, assignments, songs/charts and setlists using safe fixtures.
- QR camera and Voice Key Assist: allow/deny permissions and retry; no unexpected permission request at startup.
- App background/foreground, process restart, flaky network and offline startup; recover unsaved drafts where supported.
- For a normal APK, check the notification limitation is visible. For `mobile:apk -- --push`, follow `docs/android-push-testing.md`; native Android permission and registration replace browser-push prompts.
- Check website update controls cannot reload/update the native bundle.

## Remaining release gates

### Work possible before paying Google

- Real Android device QA and fixes; native safe-area/keyboard/back and lifecycle handling as required by those tests.
- Normal and closed-app push delivery/tap routing are verified on Bryan's Android phone. Complete physical teammate-device, logout/account-switch verification; current setup and deployment state are in `docs/HANDOFF.md` and `docs/android-push-testing.md`.
- Verify login/invitation/password-recovery links and native app-link routing. Current web recovery destination remains unchanged.
- Verify downloads/sharing and any web-only APIs on the actual app.
- Replace generated native placeholder launcher/splash artwork using the approved ServeSync brand; capture real app screenshots with safe demo data.
- Implement/verify account deletion, published privacy/support/deletion URLs, reporting/moderation as applicable, and accurate data disclosures. A targeted source search did not establish complete deletion/privacy/moderation flows. Do not treat this as a completed compliance audit.
- Confirm publisher contact, data-retention/deletion decisions, age audience, and rights to distributed songs/artwork. Do not invent these answers in store forms.
- Confirm permanent package ID, create and safely back up release signing material outside Git, verify a signed Android App Bundle, and document version-code increments.

### Requires account/platform access

- Google registration payment, identity/device verification, actual account testing requirements, Play upload, review and production approval.
- iOS Xcode compile/device tests on macOS, developer signing and APNs configuration, App Store Connect/TestFlight and review.

Preparing code now does not remove later store testing/review requirements. Account payment is not the only remaining release gate.

## Checks completed in this milestone

- Baseline and final app TypeScript checks passed; test TypeScript and all 70 test files passed, including native updater isolation.
- Targeted ESLint and the production Vite build passed.
- Android Gradle `assembleDebug` passed (123 tasks); build tooling doctor passed.
- iOS Capacitor sync succeeded on Windows; no iOS compile, signing or device tests.
- Authenticated web workspace opened in the browser; no full workflow or physical-device QA claimed.
- `adb devices -l` returned no connected device.

Device follow-up: Bryan installed the original APK and reported login, dashboard, Events/Songs, Android Back and app switch/return working. He then installed the push-testing APK and granted Android notification permission. The Supabase device registration exists for his selected phone account. He confirmed normal and closed-app/locked-phone delivery and successful Notifications navigation. The server now supports all opted-in recipients after his explicit teammate rollout request. See `HANDOFF.md`.

Next owner/action: Bryan and teammates install the branded APK and enable notifications; complete the outstanding release gates before declaring store readiness.
