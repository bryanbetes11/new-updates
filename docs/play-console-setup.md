# ServeSync Google Play setup

Updated: 2026-09-29

## Objective

Prepare the Google Play internal test while keeping existing APK testers supported. Public release and production access are separate later steps.

## Console setup

- Verified in the live Console: personal developer account; this is its first app.
- App name: ServeSync. Default language: English (United States). Type: App. Download price: Free.
- Package name: `com.babcreations.servesync`; Google confirmed availability.
- Bryan completed the policy, Play App Signing, and export declarations himself. The Create app action opened the new app dashboard.
- Console: https://play.google.com/console/u/0/developers/7965475025164804340/app/4974817087244435240/app-dashboard
- Initial form evidence: `output/play-console/create-app-declarations.png` (local only).
- Internal tester list saved and assigned to the track with Bryan's explicitly supplied Google account (one tester). No other members were added or contacted.
- First internal release published: `1.4.12 (32) - First Play internal test`, released Sep 29 at 4:48 AM (Asia/Manila). It has since been superseded by code 33.
- The app category is saved as Productivity, the support email is saved as `babcreations11@gmail.com`, and `https://wt.mcjcchurch.com/privacy.html` is saved as the privacy policy. Default store listing name/short/full text was saved as a draft. The icon, feature graphic, screenshots, and remaining declarations are still needed before a closed test can be submitted for review.
- Tester opt-in link: https://play.google.com/apps/internaltest/4701269423518613104 . Use the Google account Bryan supplied for the tester list. Actual tester enrollment/phone installation has not been verified.
- Until listing setup and review are complete, Google displays the temporary name `com.babcreations.servesync (unreviewed)`.
- Google says an app in internal or closed testing before open/production rollout cannot be found through Play search; invited testers need the opt-in or Play Store URL. For this new personal developer account, open testing and pre-registration remain gated behind production access. The existing internal test remains the right place for Bryan to inspect the app before recruiting others.
- Publication evidence: `output/play-console/internal-release-published.png`.

## 2026-09-29 listing and reviewer setup follow-up

- Latest Console check: **9 of 11** setup tasks complete. Reviewer sign-in details for the isolated demo church and Target audience (18 and over, restrict users determined to be minors) were saved. The reviewer account is `ServeSync Reviewer`, confirmed/onboarded, and church admin in `ServeSync Demo Church` (`servesync-play-review`). A read-only check at creation found only this profile and no records from another church. Data safety and Default store listing screenshots remain.
- The reviewer account now has Production Director and Song Leader ministry roles, plus church-admin access. In its isolated workspace, Codex added one sample Sunday Service on 2026-10-25 (reviewer assigned and confirmed as Song Leader) and one clearly labeled demo announcement. These are synthetic review records only; no existing church records were copied. The store screenshots are still pending.
- Creating the church skipped profile onboarding because the existing `CreateChurch` redirect sent any account with an organization to Church Settings. Local changes now route incomplete profiles to `/onboarding` from that page and from protected app routes. This fix is not yet pushed or deployed; the reviewer profile was completed directly through the existing live `/onboarding` page.

- Live dashboard now shows **7 of 11** setup tasks complete (proof: `output/play-console/setup-progress-7-of-11.png`). Completed in this pass: Ads, IARC Content rating (ESRB Teen / IARC 12+), Government apps, Financial features, and Health; Advertising ID is also declared No. Saved changes still need Google's review before the temporary package-name listing can become ServeSync for internal testers.
- Remaining dashboard tasks: Sign in details, Target audience, Data safety, and store listing. The text listing is saved as a draft; icon, feature graphic, and at least two phone/tablet screenshots are required. No closed test or public listing has been submitted.
- Data safety is saved at Step 2 as a draft with both deletion URLs set to the verified live `https://wt.mcjcchurch.com/delete-account.html`. Step 3 requires a careful data/SDK inventory; it has not been answered. The in-app deletion link is in the internal Play build 33; the website request page is live.
- Bryan approved and Codex pushed only `public/delete-account.html`, its `public/privacy.html` link, and the App settings link from `src/pages/AppSettings.tsx` as commit `f0bc1f4` to `origin/main` (0/0 synchronized). Vercel's GitHub status succeeded, and browser inspection confirmed the privacy link and live deletion page. Proof: `output/play-console/account-deletion-live.png`. Other local changes remain unpushed.
- The first reviewer invite attempt failed with `null value in column "org_id" of relation "activity_logs" violates not-null constraint`: a new auth user creates an unassigned profile and its activity trigger tried to log without a church. Bryan approved the scoped fix. The migration `supabase/migrations/20260929090000_allow_unassigned_profile_signup.sql` was applied to production; the three replacement triggers were verified live. An isolated PGlite check passed for unassigned and assigned profile activity cases. Recovery: drop its three replacement triggers and recreate the original `trg_activity_profiles` trigger (`AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_activity('account','profile')`).
- Retried the authorized invitation. Supabase shows `babcreations11+playreview@gmail.com` as **Waiting for verification** and a success toast for sent email. Its profile has `org_id` null and `is_org_admin` false. A 7-day private-pilot church invitation for the same alias is saved (expires 2026-10-05 21:29 UTC); it creates no organization and requires verified email, adult confirmation, and accepted pilot terms before self-service creation. Bryan must verify the email and set its password. No demo church or reviewer credentials exist yet.
- Before Google review, implement and verify user-generated-content reporting and blocking for the current church chat/community features. The current app does not provide those controls. Do not mark related declarations complete until the behavior exists.

## 2026-09-29 internal update

- The production Supabase migration `20260929090100_queue_account_deletion_requests.sql` was applied. It adds a service-only deletion queue and an atomic server function to record a request, detach the account from its church, remove roles, and stop web/native push delivery. No existing account was changed; the live queue had zero requests at verification. Production grants were checked: authenticated users cannot read the queue or execute the server function, while the service role can.
- Edge Function `request-account-deletion` version 1 is active with JWT verification. It verifies the signed-in user, calls the queue function for that user, then bans future Auth sign-ins/refreshes. An unauthenticated POST returned HTTP 401. A full authorized deletion was **not** run against a disposable account, so successful live processing and Auth ban behavior remain unverified. The website email request path remains live; staff must monitor/process queued requests and decide which personal versus shared records to remove.
- `/settings/privacy` now invokes the deployed function after password confirmation and shows a status message after sign-out. This UI is in Play build 33. Browser preview checked document switching, opening/canceling the confirmation, and notification bell opening without submitting a deletion request.
- The rebuilt, signed Play bundle is `output/mobile/ServeSync-1.4.12-play-build33-final.aab` (11,793,198 bytes; SHA-256 `D74BB89C6D756398247F08FC1FC5FF89FA04ABDC469096AD78C24D0AEE71C402`). It includes the Play immediate-update gate and Privacy & account screen. Gradle bundle build, app TypeScript, signature, package/version 1.4.12/code 33, target SDK 36, absence of the APK installer class/permission, and a signed-in local preview passed. An initial signed bundle built before the notification fix must not be uploaded; use only the `-final.aab` file.
- Bryan manually uploaded the final AAB after Chrome rejected automated file upload. Google accepted version code 33/API 36. Codex reviewed validation and published `1.4.12 (33) - Play update and privacy` with English release notes to the existing **internal** track. The Console shows the track **Active**, release **Available to internal testers**, released Sep 29 at 6:31 AM (Asia/Manila), **Not reviewed**. Google reported no blocking errors, no change in supported device counts, and two optional diagnostic warnings for missing deobfuscation mapping and native debug symbols. This does not publish a closed or public release. Physical Play installation and immediate-update behavior remain unverified.
- Current Supabase check shows the reviewer alias is still unverified and has never signed in. Bryan must use the invitation email to verify it and set its password; no demo church or reviewer credentials exist yet.
- `docs/play-data-safety-inventory.md` records source-backed data categories and unresolved classifications. No Step 3 Data safety selections were saved. Dashboard remains 7 of 11 setup tasks complete.

## 2026-09-29 public listing and pre-registration follow-up

- Live Pre-registration page confirms the feature is unavailable until this app has production access. Dashboard still shows 7 of 11 app-information tasks complete, 0 closed-test testers opted in, and a disabled Apply for production button. The remaining setup tasks are Sign in details, Target audience, Data safety, and Default store listing. Target audience is gated by Sign in details.
- Google's current rules require a closed test with at least 12 testers opted in continuously for 14 days before this new personal account can apply for production access. Finishing 11 of 11 enables a closed test, but does not unlock pre-registration or public search by itself. A pre-registration campaign can last at most 90 days before production launch.
- The reviewer sign-in form was inspected. It requires working credentials and full access. The isolated alias `babcreations11+playreview@gmail.com` is still awaiting Bryan's email verification/password and a demo church; no credentials were entered or saved in Play Console.
- Default store listing text remains a draft. Bryan uploaded the square `public/pwa-icon-512.png` to the App icon slot. He also uploaded the wide branded graphic; Codex cropped it in Play's asset library to 1024x500, attached it to the Feature graphic slot, and verified the draft-save success message. Its source is saved at `output/play-console/store-assets/servesync-feature-graphic-source.png`. Chrome's automated file chooser is still blocked by extension file-URL access. Phone screenshots still require a real demo workspace with no private church data.
- Data safety Step 2 was rechecked. Step 3 is still empty. Source review confirms profile identity/birthday/gender, church communications and attachments, leave reasons, payment references, push device tokens, notification activity, and optional media uploads need accurate categorization before submission. Do not mark this complete from the current draft inventory alone.

## Build preparation

The existing package targets API 36 and distributes APK updates through GitHub. The Play artifact must exclude that external installer and its install permission. Its update action must lead to Google Play. Keep direct-download builds working independently.

The distributed build 31 APK was verified as Android Debug signed, SHA-256 `50a5ac43b88a2626d676c023e52cd234a8ae6e6c493e22f5750d8a8d37b32df5`. A new upload key was created outside Git in `C:/Users/Bryan/ServeSyncSigning/`, with directory access restricted to Bryan, SYSTEM, and Administrators. Its public SHA-256 fingerprint is `D1:0F:C5:A6:6A:69:30:9A:C7:1E:7D:86:5A:6E:F9:48:00:0A:01:B6:0A:ED:20:45:92:8D:62:B5:07:4C:10:2E`. Google's app signing certificate is distinct from this upload certificate.

Signed artifact: `output/mobile/ServeSync-1.4.12-play-build32.aab` (11,767,839 bytes). SHA-256: `02D01ABAF9B74B76900D797E9E6415BB6BE079DFB8DA40E656EE028D1E1751DA`; matching checksum file is saved alongside it. Package, version 1.4.12/code 32, target API 36, signature, absence of the install permission, and absence of native APK updater classes were verified. The sideload variant still contains its installer permission, and its Java compile/unit test passed.

A follow-up Play build 33 adds Google Play immediate in-app updates and is now available to internal testers. It has not been tested on a phone. Build 32 cannot enforce a newer build because it predates the update gate; the gate can first be exercised when build 34 or later becomes available to a device with build 33 installed.

See `docs/play-build.md` for build instructions. Do not treat a successful local build as a successful Play upload or device test. The one-time move from existing debug-signed APKs to Play requires reinstalling; no device uninstall has been performed.

Upload: automated Chrome upload was blocked by extension file access even after Bryan reported enabling it. Browser security policy also blocked automated access to `chrome://extensions`; no workaround attempted. Bryan uploaded the verified AAB manually; Google accepted code 32/API 36. Codex reviewed validation and published it to the internal track only.

Google reported no blocking errors and two warnings: missing deobfuscation mapping (minification is disabled) and native debug symbols. These remain diagnostic limitations, not failed upload checks.

## Verification and saved work

- All 87 test files and test TypeScript check passed; app TypeScript, scoped ESLint, build-script syntax, and final diff whitespace checks passed.
- Production Vite build, Capacitor sync, signed Play AAB, sideload Java compile, and sideload native unit test passed.
- Isolated Play guard check confirmed check/download/install/progress operations reject before a network request. Bundle inspection verified the native installer classes are absent.
- Browser harness rendered the actual App settings/NativeAppUpdate components with mocked account/device state. Open Google Play appeared, APK download/install controls were absent, and clicking opened the correct package's Play URL. The store page was not yet available before rollout. This is not physical-device verification. A missing version constant in the initial harness was fixed in the harness configuration; no app change was required. Harness server was stopped.
- Build instructions: `docs/play-build.md`. Listing copy and tester migration note: `docs/play-store-listing-draft.md`.
- Source and documentation remain saved locally, uncommitted. No Git push, website deployment, database change, or public/closed release was performed.
- Signing key and credentials are saved outside Git. Off-device backup and restore have not been performed.

Next: Bryan opens the tester link on Android, saves any unsent local work before the one-time reinstall from the old debug APK, installs through Google Play, signs in, and checks notifications and the core church workflows. Then prepare the listing/declarations and closed test.

## Later release requirements

- Complete the store listing with approved screenshots containing safe demo data, icon, feature graphic, descriptions, and support contact.
- Review Data safety against actual app and SDK behavior before submitting it. Internal-only testing is exempt from that form; closed testing is not.
- Check account-deletion request paths in the app and on the website, and the process for fulfilling requests. The current App settings page has generic privacy/account support; this is not evidence of a completed account-deletion feature.
- Provide reviewer access to a demo workspace without exposing existing church records.
- Confirm audience/content-rating answers and rights to any content distributed with the app.
- Complete real Play installation, sign-in, notification, update, and core workflow checks.
- New personal accounts require at least 12 testers continuously opted into a closed test for 14 days before applying for production access. Internal testing does not count toward that requirement. Tester enrollment and production approval remain uncompleted.

## Sources checked

- [Create and set up an app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [App testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Internal testing and Data safety exemption](https://support.google.com/googleplay/android-developer/answer/9845334)
- [API target requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [App update policy](https://support.google.com/googleplay/android-developer/answer/16559646)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Testing track visibility](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Immediate in-app updates](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java)
