# Android push testing

Status: Android push is live for all signed-in, opted-in APK users. Normal and closed-app delivery/taps were confirmed on Bryan's phone on 2026-09-23. Teammate devices remain to be tested.

Supabase remains responsible for login, church data, recipient selection, preferences, quiet hours and delivery history. Firebase Cloud Messaging (FCM) delivers Android alerts. The Firebase project uses the no-cost Spark plan; Analytics, Gemini and optional Developer Program enrollment are not needed.

## Setup and controlled rollout

1. Register Android package `com.babcreations.servesync` in the Firebase project. Save its `google-services.json` to `android/app/google-services.json` (ignored by Git). This client configuration is different from the server's private key.
2. Create a server service account with permission to send FCM messages. Store the downloaded JSON privately under `.secrets/`; never commit it or include it in the APK. Set the JSON as Supabase Edge Function secret `FCM_SERVICE_ACCOUNT`.
3. Apply `supabase/migrations/20260923033724_android_native_push_devices.sql`, then deploy `supabase/functions/send-push/index.ts` with sibling `fcm.ts`. Preserve custom internal-secret authentication and existing browser VAPID configuration. Deployment requires explicit authorization.
4. Set server secret `ANDROID_PUSH_ENABLED=true` to deliver all eligible regular notifications to every enabled Android installation of the intended recipient in their church. Version 26 no longer reads the old `ANDROID_PUSH_TEST_USER_IDS` restriction. Browser delivery and existing recipient/rule/preference/quiet-hour checks remain in place. This APK is for teammate testing, not a store release.
5. Run `npm run mobile:apk -- --push`. The script validates Firebase project configuration/package identity and enables the native UI in the bundled build. Regular `mobile:apk` builds keep Android push disabled. Install the APK and sign in. New installations use the Android permission dialog; Profile remains available for manual changes.

No Firebase database, Firebase Authentication, paid Play registration or billing upgrade is needed for this flow. iOS native push is not enabled by this Android implementation; it requires separate APNs credentials and native verification on macOS.

## Behavior and privacy

- New installations request Android permission once after sign-in and church context is ready. Allow registers the phone. Decline/dismissal does not repeatedly prompt. Android 12 and earlier do not show a runtime permission dialog. Existing account/device opt-outs are respected.
- When notifications are off, the APK/PWA shows a warning about missing lock-screen alerts. On Android the setup action opens system notification settings when blocked; otherwise it opens ServeSync notification settings. The native helper checks app-wide and ServeSync channel settings.
- Each installation has a random ID and 256-bit secret. The server stores only the secret hash. A token alone cannot take ownership of an existing installation. Tokens and hashes are not selectable by app users.
- Registrations are scoped to the signed-in user and current church. Account switches/sign-out revoke the server registration, delete the Android token and clear delivered alerts. Explicit transitions are stopped with a retryable error if cleanup fails. Session-expiry cleanup retries at startup/resume/online; offline devices cannot complete server cleanup until connected.
- Disable affects this phone. Enable also restores the existing account-wide push preference; a browser-wide preference still controls delivery.
- Startup/resume/online refresh existing registrations and retry accepted onboarding after connection failures. Token changes are synchronized. Late registration results cannot re-enable a device after disable/sign-out.
- Taps require matching recipient identity and only navigate to local routes. Valid notification IDs use the existing notification-open tracking queue.
- Notification title/body and the device token pass through Google. Sensitive notification content should be considered in privacy disclosures. Lock-screen visibility is private; user/system settings still apply.
- FCM acceptance is not proof of physical delivery. Force-stop, offline status, battery restrictions, permission and channel settings can delay/prevent alerts.
- Existing admin subscription counts currently count browser subscriptions; delivery status includes Android results. Expand the device inventory before general release.

## Verification

- `npm test`: includes account changes, denied permission, cleanup failure, late token race, navigation validation and a cryptographically signed OAuth/FCM mock with stale-token boundaries.
- `node tests/nativePushDispatch.mjs`: actual sender with fake transport/database checks regular recipients without allowlist membership, the Android kill switch, user/church filters, preferences, quiet hours and delivery failures.
- `node tests/nativePushDatabase.mjs`: isolated PGlite ownership, RLS, grants, cross-church visibility, duplicate token and anonymous secret-based revocation checks.
- `npm run typecheck` and scoped ESLint.
- Edge function type check: use Deno with isolated dependency configuration (`--node-modules-dir=none --no-lock --no-config`) to avoid replacing pnpm-managed dependencies.
- Build the final push-enabled APK, then verify on the real phone: foreground/background, normally closed cold-start tap, permission denied, toggle off/on, account switch and sign-out. Use only a specifically authorized test recipient. Never create notifications for real church members as test fixtures.

Rollback: set `ANDROID_PUSH_ENABLED=false` to stop Android sending. Restore the backed-up prior sender if necessary. The additive device table can remain; do not drop it while installed testers depend on its cleanup RPCs. The original development APK remains under `output/mobile/` until explicitly replaced.

## APK for teammates (2026-09-23)

Share `output/mobile/ServeSync-1.3.0-android-test-build5.apk` (version 1.3.0, Android build 5). It includes globally enabled Chat and the existing ServeSync green-and-black launcher artwork with added inset spacing. Use `/download/android` for the versioned GitHub prerelease APK and installation guide. Install/update, sign in to your own account, and respond to the Android permission prompt. Profile remains available to change the setting. Regular eligible app notifications will reach each enabled device; no individual tester allowlist enrollment is required. Android devices without compatible Google Play services are not verified. iOS cannot install this APK.
