# Private pilot readiness — 2026-09-25

Objective: a free, invite-only outside-church pilot with adult testers, without using real member accounts for isolation tests. This is separate from public launch and App Store / Play Store submission.

## Verified locally

- The encrypted recovery archive was previously created and checked; its key is stored separately on this PC. An off-device copy has not been verified.
- A restored, job-free PostgreSQL container with synthetic Church A/B users passed rollback-only read/write tenant isolation for members, church settings, events, songs, notices, and chat. Nothing was written to live member records by these tests.
- The private chat-media migration passed the same restored-schema rehearsal: Church A and B can select only their referenced attachments, while anonymous access is denied. The public bucket change has not yet been applied live.
- The invite gate passed: unapproved church creation and direct calls to the old provisioning routine are rejected; one approved, email-verified adult can create a free pilot church; an adult member must confirm eligibility and accept versioned pilot terms before joining; a recorded minor cannot self-confirm. Pilot billing fields cannot be changed by a church admin.
- The database chat flood guard rejected a synthetic sender after 60 messages in one minute.
- Published-ready local notice and pilot terms are saved in `public/privacy.html` and `public/pilot-terms.html`; registration, pilot acceptance, landing, and app settings link to them. The pilot billing screen shows no payment form. These files are not hosted until the web deploy.
- App suite: 86 test files passed, app typecheck and scoped ESLint passed, and the production web bundle built. Android 1.4.8/build 27 built with native push enabled; APK package, version, and signer were checked against 1.4.7/build 26. Physical-device installation and notification delivery are not proved by this.
- Live Supabase migration versions `20260925052836` and `20260925052855` now enforce the pilot gate and chat rate guard. Live postchecks found both triggers enabled, no approved pilot invites or pilot churches yet, and the unrestricted church creator not callable by authenticated users. Existing member data was not changed by the migration.
- Local signed-in preview rendered one existing announcement photo and two chat images through signed URLs; each image loaded successfully. Live media buckets are still public until the compatible web and APK are published.

## Work still required before invitation

- Push the reviewed source to main, verify Vercel, and publish the APK to the GitHub prerelease. Older installed APKs will need to update to display private media.
- Apply the chat and announcement Storage migrations after compatible clients are available; recheck live bucket and policy state plus signed-in rendering. Align local filenames with the live migration versions and commit that metadata.
- Complete a non-destructive live invitation-flow check when an actual outside-church administrator email is provided. No dummy live accounts or invitations were created. A manual export/deletion runbook is saved in `docs/launch/private-pilot-operations.md`; these operations and long-term retention automation are not yet implemented end to end. Get qualified Philippine privacy review before representing the notice and terms as final legal compliance.
- Record any remaining limitations. Do not mark the outside-church pilot ready or shut down the PC if a blocking issue remains.
