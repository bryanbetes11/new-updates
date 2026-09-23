# ServeSync handoff — 2026-09-05

## 2026-09-23 Android PWA reminders after uninstall

- User approved keeping the Android installation attention link available in an eligible Android PWA, independently of recorded APK activity, and explicitly requested push to main once complete.
- Daily popup now pauses only for observed Android app activity within the last seven days in the caller's current church. Legacy push registrations no longer suppress it. The 24-hour per-account/browser popup cooldown remains. A failed activity check suppresses the popup but leaves the attention link available.
- Applied migration 20260923053629_android_app_recent_activity.sql; live execute grants verified (authenticated allowed, anon denied). No records deleted: last-seen history is not treated as installation proof. Existing build 6 reports activity; no APK rebuild needed for this PWA-only behavior.
- Verified: 75 test files, TypeScript, isolated DB tests (recent, expired, exact seven-day boundary, other member/church, legacy registration), lint (zero errors/four existing warnings), production build and diff checks passed. Publication follows these checks.

## 2026-09-23 App access, daily Android offer and native haptics

- Manage Team (/leadership/team) now shows organization-admin-only app-access badges and expanded last-seen details. Records represent observed use, not proof an app remains installed; browser use cannot prove no installed app. Empty and unavailable states remain distinct. Multiple modes per member are preserved.
- New migration 20260923051442_member_app_access.sql stores only account/org, app category, coarse platform and server time. Narrow authenticated RPC derives owner/org and throttles writes. Admin read policy stays within the current church and hides departed members. No push permission is needed for new tracking.
- Android installed-PWA users get both a daily popup (24-hour local per-account cooldown from display) and a persistent optional Needs Your Attention entry. Both stop when a caller-only RPC detects Android app use or an existing native push registration. Popup dismissal does not remove the attention entry. No offer when detection fails; existing four approval items remain visible.
- Native Android click haptics use a small View.performHapticFeedback bridge respecting system touch settings, with no new permission/dependency. Root click listener covers public and signed-in routes, excludes typing/disabled/opt-out controls, handles SVG icons, and avoids duplicating Layout's browser pointer feedback.
- Checks: 75 test files, TypeScript, isolated database grants/RLS/tenant/moved-user/throttle/legacy-APK suppression tests passed. Lint zero errors/four existing warnings. Sample-data mobile badge/expanded/unknown UI inspected; actual attention component with all five items and guide navigation verified. DOM target checks passed for SVG, disabled, typing and opt-out controls. Final configured web + Android build passed.
- Prepared APK: output/mobile/ServeSync-1.3.0-android-test-build6.apk. Physical haptic feel and new access reporting on a phone remain unverified. User approved activation, source push and build 6 publication. Migration applied successfully to the live project; RLS/grants verified. Source pushed as a274800 and origin/main synchronized. GitHub build 6 prerelease published; anonymous APK download checksum matches. Vercel deployment 63bforydR8Ud6TPJPg3jg1bBvoxq succeeded for this commit. Manage Team verified against live records: Browser observed badge and expanded last-seen timestamp. Post-release status saved locally. APK SHA-256 C2BFA97CAB99DA22B2F9B910D411780337042C1AEF2161A99C1B72054A47A282. Rollback is additive: remove tracker/provider mounts and retain the unused RLS-protected table; no existing data modified by migration.

## 2026-09-23 Native permission onboarding and Android download page

- User authorized push to main for the completed mobile/push batch and requested an Android APK offer for installed Android PWAs.
- New native installations request Android notification permission once after authenticated church context is ready. Allow registers the device; decline/dismissal, account-wide opt-out, manual disable, account changes and interrupted registration are handled without repeated prompts. Existing registered users do not see another prompt. Android 12 and older have no OS runtime notification dialog.
- APK and PWA show a notifications-off warning explaining missing lock-screen alerts. Native app/channel setting checks support system-disabled notifications; the banner can open Android notification settings. Browser readiness rechecks on focus/visibility. Physical decline/settings-return scenarios remain unverified.
- /download/android contains versioned download, source-permission and unfamiliar-developer guidance, update instructions and optional-notification explanation. Signed-in Android standalone PWA users get a dismissible offer on Home; native apps, ordinary browser tabs and iOS are excluded. Profile links to the guide.
- Latest APK: output/mobile/ServeSync-1.3.0-android-test-build5.apk, version 1.3.0/build 5, SHA-256 2183FC4637303EF605FC5EA87E16B2FF2C41839F7919B81F731B8EF70C828EF9. Phone disconnected, so this build was not copied or installed via USB. Intended public asset is GitHub prerelease android-test-v1.3.0-build5.
- Checks: app/test TypeScript, 74 tests, source lint (0 errors, 4 existing warnings), configured web and Android Gradle build passed. Guide inspected at 390px; browser console clean. Actual banner navigated to notification setup without changing permission. Offer eligibility/denial/dismissal/concurrent onboarding/retry/account boundaries tested in isolated fixtures. No real-member messages/alerts were sent.
- Bryan confirmed the prior build's Chat keyboard stays above the composer and Back dismisses it while preserving the conversation. iOS remains source-only, not compiled or device-tested.
- Source pushed to main as 1d0c20b; origin/main verified synchronized. GitHub prerelease android-test-v1.3.0-build5 is public. Anonymous APK download SHA-256 matches the local build. Vercel reported success for this exact commit (deployment J5JT7yzseUfmh68NNVh69Q3D1kQF). Private configuration/keys, APK binaries, backup/cache directories, audits and unrelated handbook excluded from Git. Live wt.mcjcchurch.com/download/android verified: ServeSync heading, correct build-5 APK link, all three screenshot links and wheel scrolling (1270px). This post-push status is saved locally.
- Follow-up UI changes: installation guide includes Bryan's three screenshots at Install, More details and Install anyway, with larger-image links. Guide owns a viewport-height scroll area; mouse-wheel verification moved it 844px. Signed-out / and /landing redirect to /login. Login card centers between branding/footer on tall phones and owns scrolling on short screens (verified 374px scroll at 390x520); account-update navigation preserved. Local-only ?preview=app-offer on the guide renders the actual promotion without changing saved dismissals. Guide link and 390px dialog inspected; preview left open for Bryan. Final configured web/Android build passed after these changes.

## 2026-09-23 Chat restored globally and Android icon spacing

- User clarified Chat must be enabled for everyone, including website and native apps; src/lib/features.ts now exports MESSENGER_ENABLED=true. Existing navigation, dashboard and event-chat entry points use it. No keyboard behavior changed; user will test the Android keyboard.
- Only the feature flag was committed/pushed to main: 7c5522a656f66aef2dde576a800f4930a5b3945d. Git synchronization verified 0/0; Vercel deployment 3w7PzZ4UMXqJCizT7rqzGFKF3K3S reported success for that exact commit. No live website visual verification claimed. All other mobile/push/UI changes remain local and preserved.
- Read-only live checks confirmed chat-message push uses the existing shared sender and conversation routes; membership policies scope messages and conversations to church/member. No messages sent or backend changes made for Chat.
- Latest APK: output/mobile/ServeSync-1.3.0-chat-icon-test.apk, version 1.3.0/build 4, 13,015,570 bytes. SHA-256 7ED2E86D010FDF9AD36D8D43582BDB04EC24B694A4B8594BC2C2862EF97342F4. Copied to phone Downloads and checksum matched. Install this newest APK over prior build; it includes global Chat, regular Android push and corrected icon.
- Icon uses existing ServeSync artwork with 20% inset added to all launcher densities (including adaptive foreground). Generated PNG inspected. Phone launcher appearance and keyboard/send/receive behavior await device testing.
- Checks: all 72 tests, app/test TypeScript, source lint with zero errors/four existing warnings, final web/Gradle build and whitespace checks passed. Broad lint was interrupted because it scanned tmp dependency backup; rerun excluded tmp, generated native platforms and private backup files. This was not a failed application check.

## 2026-09-23 Android push and teammate APK rollout

- Android push works on Bryan's Xiaomi 14: user confirmed receipt and Notifications navigation both normally and with the app swiped away and phone locked. Closed-app notification activity records push_opened_at. One stale browser subscription was removed during that test; Android delivery succeeded.
- Firebase project servesync-870e6 uses Spark. Supabase remains responsible for accounts, church data, preferences and notification rules. Android config and private service-account key remain ignored; the server key is saved in the Supabase secret only for delivery and is not in the APK.
- Applied native_push_devices migration and deployed send-push. Following explicit user request to support teammates and all regular configured notifications, version 26 removes the single-user test allowlist. ANDROID_PUSH_ENABLED remains the kill switch. The old ANDROID_PUSH_TEST_USER_IDS secret is no longer read.
- Delivery selects only enabled installations belonging to the intended recipient and church; existing notification rules, preferences and quiet hours still apply. This is not a broadcast to everyone who installs. Teammates must sign in and enable notifications. No test alert was sent to teammates.
- Rollback: disable ANDROID_PUSH_ENABLED, or restore ignored .secrets/send-push-before-team-rollout.json. Previous live files matched local files before this scoped change.
- Earlier complete verification: app/test TypeScript, 72 unit-test files, scoped lint, native database isolation tests, sender dispatch tests, Deno typecheck, production Vite and configured Gradle build. Team rollout reran database/dispatch tests and Deno check successfully; physical teammate devices remain unverified.
- Android launcher resources now derive from existing public/servesync-app-icon.png at all densities, with adaptive icons and black background. Regenerate using scripts/generate-android-icons.ps1. Build code increased to 2; version remains 1.3.0. Production web and Android Gradle builds passed. Saved output/mobile/ServeSync-1.3.0-team-test.apk (13,185,487 bytes), SHA-256 1DD75BDFFAF938CF81E93C7D7DC212393718D76913C4ABD6918226A3C24D5EA7; copied to phone Downloads. Packaged identity/build code and launcher references checked; installation and phone launcher appearance await Bryan. Live sender v26 was retrieved and verified ACTIVE with allowlist removed and recipient filters intact.
- Local source remains uncommitted/unpushed. Supabase changes are live under explicit authorization. iOS native push, release signing and store readiness are separate outstanding gates. See docs/android-push-testing.md and docs/mobile-development.md.

## 2026-09-23 mobile foundation implemented locally

- User correction: Google Play registration remains unpaid/incomplete. Goal is preparation before funding; no purchase or store account action performed.
- Saved Capacitor config, Android/iOS source, pinned dependencies/lockfiles, build/doctor scripts, native updater isolation and explicit native-push test limitation. See `docs/mobile-development.md` and `docs/launch/play-store-listing-draft.md`.
- Installed Android Studio, Temurin Java 21, Android SDK platform/build/device tools. Latest SDK CLI failed; older verified official manager completed setup. Gradle compilation succeeded with Java 21.
- Checks: app/test TypeScript, 70 tests, targeted lint, Vite build, Android `assembleDebug`, tooling doctor, and iOS source sync passed. Browser opened the authenticated ServeSync workspace. No native device test; adb listed no device. No iOS compile.
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Development only, not a store release. Provisional identity: `com.babcreations.servesync`.
- No production backend changes, church-policy implementation, release signing, commit, push, or deployment. Existing `Layout.tsx` changes/artifacts preserved.
- Next: connect Android phone and test APK; finish native push, links/files/lifecycle, artwork, privacy/deletion/moderation review and signed release gates. The full outstanding checklist is in `docs/mobile-development.md`.
- Device follow-up: Windows recognizes the connected Xiaomi 14 as a portable device, but `adb devices -l` is still empty. Installation is blocked until USB debugging/device authorization is available. No APK was installed. Saved convenience copy: `output/mobile/ServeSync-1.3.0-development.apk` (SHA-256 `C3777D501AD58D3E562007E3086884754BD0FACA1D4DAE0FC9A25B58B4FC82D3`).
- Latest device follow-up: Xiaomi 14 is now authorized in adb. APK installation returned `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`; no successful installation. User must allow phone-side USB app installation before retrying.
- Second authorized installation attempt returned the same restriction. Android user diagnostics reported no effective/device-policy restrictions for the main user; no matching explanatory entry appeared in the bounded log check. Package lookup still found no ServeSync installation. Switched to copying the APK into the phone's Download folder for user-driven installation, so the phone can display any required confirmation or specific error.
- Installation resolved: user completed phone-side installation after a Play Protect unfamiliar-developer warning. ADB now confirms `com.babcreations.servesync`, version 1.3.0/build 1, installed on Xiaomi 14 and its process running. Screen rendering, login and workflow checks remain pending; process presence is not visual verification.

## 2026-09-23 mobile release planning milestone

- Objective: Android-first release, iOS preparation, and optional church-specific attendance, setlist deadline, and song reuse policies.
- Saved plan: `docs/mobile-release-plan.md`; includes agreed direction, source entry points, acceptance criteria, verification boundaries, and rollout order.
- Checked current Git status and targeted policy source. Existing unrelated edits/artifacts were preserved. No app/database changes, tests, builds, commits, pushes, or deployments in this planning milestone.
- Outstanding: live policy/enforcement and cross-church isolation verification, physical device tests, Play account production eligibility, and macOS access for an actual iOS build.
- Next: implement and verify the song reuse policy batch after targeted baseline/schema inspection. Older entries below remain historical snapshots.

This is a dated working-tree snapshot, not continuing authorization or proof of current deployment. Read it only when resuming this work; verify Git status and the latest user request first. Replace stale details when handing off again.

## Repository and baseline

- Repository on this device: `D:/Vibe Coding/new-updates/new-updates`.
- Current HEAD verified for this handoff: `38e05894512c0fde6f246955b6023065450c583c` — Fix draft recovery and improve ServeSync workflows.
- Local preview: `http://127.0.0.1:5174`.
- Live Mode changes below are uncommitted. Remote/deployment status was not refreshed for this documentation task.

## Completed in the working tree

- Durable Live Mode request queue, retry deduplication, individual statuses, history/reopen and targeted instruction acknowledgement.
- PC Tech workspace and mobile request-first layout; connection status and per-device presence.
- Chart-note recovery, a combined notes/chords/lyrics size control, paired chord/lyric wrapping, scoped song/workspace resume and background screen wake lock.
- User subsequently requested removal of the entire screen-status/follow-leader/cue row. It is removed, including the client following behavior. Keep manual song navigation; do not reintroduce that row. Backend support for position messages remains unused.
- Subsequent mobile refinements: controls share the header row; Stage text and Large text preset buttons were removed at the user's request. Adjust size through Display.
- Rehearsal checklist: `docs/live-mode-dry-run.md`.
- Project orientation documents added in this documentation task: root `AGENTS.md`, `docs/CODE_MAP.md`, `docs/VERIFICATION.md`, and this handoff.

## Verification and database state

- Before the final row removal: both TypeScript checks, all 58 test files, lint (zero errors, four existing warnings), and production build passed. Browser/isolated fixture checks covered request failure/retry, late joining, status changes, targeted acknowledgement and note recovery.
- Final reader revision: app TypeScript, all 59 test files, targeted lint (no errors), production build and Git whitespace checks passed. Isolated browser cases covered hold/cancel/pinch prevention, private account save/load, failed saves, account switching and safe legacy import.
- Applied remote migrations: `20260905063129_live_mode_sessions.sql` and `20260905064534_live_mode_device_presence.sql`, both under `supabase/migrations/`.
- Database tests were rolled back. Four intentional authenticated SECURITY DEFINER RPC notices were reviewed; see the rehearsal checklist for details. This was not a cleanup of unrelated project advisories.
- Actual physical phone sleep/resume and the venue's network still require the team dry run.

## Remaining work and next action

- Latest completed requests: adaptive chart columns, long-press notes with compact scope controls, account-synced private notes, and compact colored section highlights.
- User authorized pushing the completed Live Mode work to main on 2026-09-05. Frontend publication must still be verified separately from Git synchronization.
- If the user authorizes release: review current changes, complete checks for the final source revision, stage only related files, review the staged diff, then push and verify synchronization/deployment. Ensure all rehearsal devices refresh to the new frontend.
- Keep `.codex-audits/2026-09-05-live-mode/` and `.codex-audits/2026-09-05-workflow-audit/` local unless explicitly requested. An earlier preserved-work stash exists according to the session; inspect before any stash action and do not apply it automatically.
- Never send real team cues, assignment responses or notifications just to test. Use safe isolated checks.

## Latest reader refinements

- Tablet columns now allow section continuation while avoiding breaks within chord/lyric pairs. Tablet navigation is docked outside the scroll area, without a surrounding card; it displays the next song title or End of setlist. Removed obsolete tablet bottom padding.
- Shared text size supports chart pinch and Alt + wheel, clamped to 8–36px. Gesture handler regression tests cover scaling, limits, cancellation, normal scrolling and cleanup. Physical iPad gestures remain unverified.
- Latest automated suite: 59 test files passed, app/test TypeScript passed. Final reader source changes received targeted lint and production build checks; existing EventDetail dependency warning remains.

- Charts now try one, two or three columns at the selected font size; if none fit, they use a centered scrollable column. Phones remain single-column scrolling. No song pagination remains.
- Lyric lines open notes by holding, double-clicking or Enter/Space; short taps, scrolling and two-finger gestures do not open them. Removed per-line lock/note icons. Scope controls and short description share one compact row; removed the LINE NOTE label. Section labels use compact colored rectangular highlights.
- Private notes now use owner-only `private_song_notes` account storage, refresh on focus/online and every four seconds while visible, and retain scoped device caches and draft recovery. Existing unscoped device notes are preserved with an explicit Import to my account action; imports never overwrite account notes or deletion tombstones.
- Applied `20260905080552_private_song_notes.sql`. Rolled-back checks in `supabase/tests/private_song_notes.sql` passed for owner access, account reopen, another member's read/update denial, spoof/reassignment denial, anonymous denial and deletion/import safety. Security advisors reported no finding for the new table; existing unrelated advisories remain.
