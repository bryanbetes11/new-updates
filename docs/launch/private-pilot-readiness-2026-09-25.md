# Private pilot readiness — 2026-09-25

Objective: a free, invite-only outside-church pilot with adult testers, without using real member accounts for isolation tests. This is separate from public launch and App Store / Play Store submission.

## Verified locally

- The encrypted recovery archive was previously created and checked; its key is stored separately on this PC. An off-device copy has not been verified.
- A restored, job-free PostgreSQL container with synthetic Church A/B users passed rollback-only read/write tenant isolation for members, church settings, events, songs, notices, and chat. Nothing was written to live member records by these tests.
- The private chat-media migration passed the same restored-schema rehearsal: Church A and B can select only their referenced attachments, while anonymous access is denied. A second rehearsal covered older uploader/filename objects after the live cutover revealed that format.
- The invite gate passed: unapproved church creation and direct calls to the old provisioning routine are rejected; one approved, email-verified adult can create a free pilot church; an adult member must confirm eligibility and accept versioned pilot terms before joining; a recorded minor cannot self-confirm. Pilot billing fields cannot be changed by a church admin.
- The database chat flood guard rejected a synthetic sender after 60 messages in one minute.
- The pilot notice and terms are hosted at `/privacy.html` and `/pilot-terms.html`; registration, pilot acceptance, landing, and app settings link to them. The pilot billing screen shows no payment form.
- App suite: 86 test files passed, app typecheck and scoped ESLint passed, and the production web bundle built. Android 1.4.8/build 27 built with native push enabled; APK package, version, and signer were checked against 1.4.7/build 26. Physical-device installation and notification delivery are not proved by this.
- Live Supabase migration versions `20260925052836` and `20260925052855` now enforce the pilot gate and chat rate guard. Live postchecks found both triggers enabled, no approved pilot invites or pilot churches yet, and the unrestricted church creator not callable by authenticated users. Existing member data was not changed by the migration.
- Main commit `3e126b6` deployed successfully to Vercel; the public `version.json` reports 1.4.8 and both notice pages serve their actual HTML. GitHub prerelease `android-v1.4.8-build27` contains the APK with the local SHA-256 and 13,714,295-byte size.
- Live migration versions `20260925053730`, `20260925053735`, and `20260925054036` made chat and announcement buckets private under Storage policies for authenticated church/conversation readers and restored older chat filename access. The signed-in preview loaded two existing chat photos and one announcement photo via signed URLs. The restored cross-church test passed again, including the legacy path.

## Pilot handoff and remaining limits

- The platform-owner invitation control is now in **Admin Settings** and uses database-enforced owner-only approval/list/revoke functions. Live migration `20260925120108` applied; no new pilot invitation was created. Local PostgreSQL tests covered owner-only access, email normalization, expiry refresh, revocation, claimed invites, and existing-church accounts. The live grant check confirms anonymous users cannot call the functions. The signup confirmation redirect is permitted by the production Auth URL allowlist. The owner-facing button has not been exercised with a real outside email yet.
- Admin and member profile setup now use role-appropriate steps; the admin continues to Church Settings after saving, where they can invite members and assign roles. The website's `/preview/onboarding` route shows both versions without saving. Desktop and phone-width previews and the no-save completion action were checked in the browser.

- The system is prepared for a free, invite-only **adult** outside-church pilot. No outside administrator email was supplied, so no live invitation or end-to-end real-tenant onboarding was performed. Add the first approved email using `docs/launch/private-pilot-operations.md`, then perform the first real onboarding smoke check. This is the next operator action before inviting that church's members.
- Existing Android installations must update to 1.4.8/build 27 to display private chat and announcement media. The APK build and matching signer were checked, but physical-device installation and notification delivery for this build remain unverified. The web version is already live.
- Church export/deletion and long-term retention cleanup are operator-assisted or pending, not yet automated or rehearsed end to end. An off-device recovery copy was not verified. Copy the protected archive and its separate key to an approved external destination, and obtain qualified Philippine privacy review before public or paid onboarding.
- The founding church may have younger members; the new outside-church pilot is adults only. This work does not establish App Store or Play Store child-safety or public-release readiness.
