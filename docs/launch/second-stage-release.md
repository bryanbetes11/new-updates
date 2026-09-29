# Attendance privacy: second-stage release checklist

Updated 2026-09-25: attendance enforcement is now live following Bryan's instruction to proceed. The historical preparation notes below are superseded by this release result. This does not authorize outside-church invitations yet.

## Released result

- Release commit `8d79a0517ec76f90f01486289a26b3526ea46679` is pushed to main. Vercel success confirmed through the GitHub commit deployment status. Private notes and backup are not committed.

- Applied only `20260925044402_enforce_attendance_team_access.sql`; local filename and test reference match the version assigned by Supabase. Deployed `check-leadership-member-actions` version 9; read-back source matches local source and existing custom authentication is preserved.
- Current assignments preserved: 13 members, 15 Music/Tech memberships, two church admins, no explicit leader oversight scopes. Church admins keep whole-church attendance access. Other leaders need a leadership role plus explicitly selected Music/Tech oversight; titles alone grant nothing. Members retain personal attendance access.
- Encrypted recovery package saved in `D:\Vibe Coding\new-updates\ServeSync-Recovery`, with verified decryption/checksum and separately retained private key. The package includes the earlier full restore-tested backup plus fresh cutover preimages. Off-device copy remains Bryan's task.
- All five privacy suites passed. Isolated restored-production-schema rehearsal passed and rolled back. Browser checks: ordinary Profile roles read-only; ordinary /leadership/team blocked; synthetic failed team and oversight writes display errors and retain unselected state. Fixture has external networking blocked and creates no real notifications.
- Live verification: ordinary member sees self, zero other attendance rows, one personal rollup; other-member history RPC denies. Unscoped leader sees own attendance but no team stats. Church admin can manage members and reads 12 included stats rows. Anonymous helper access denied. Counts unchanged. Old attendance alerts have generic previews. Security advisory count remains four, with no new findings.
- Signed-in ordinary Profile loads personal summary after cutover with no browser console errors. Active-state wording verified in isolated real TeamManage component; no signed-in live admin browser session was used. Current-role live predicates were verified directly. No new physical-device check claimed.
- No frontend runtime source changed in this stage. Existing web/APK 1.4.7 clients use the live backend rules. Next readiness work is broader church-isolation/onboarding testing; privacy/deletion, abuse limits, and pilot operational gates remain separate.

## Historical preparation baseline (superseded)

- First-stage commit: `4c0744d`; auth-audit fix: `69c018a`. The audit migration `20260925033252_fix_current_org_auth_audit_email_type.sql` is live and reports 13 ready accounts. Membership remains 13 people / 15 Music-or-Tech rows; final attendance function is absent.
- Three church admins have whole-church access. Two other leaders have no approved oversight groups; after cutover they will have own-record attendance access. Role titles alone do not give access.
- Stage-one admin browser and live database permission checks passed. Five local privacy suites passed again after the audit fix, covering two churches, direct reads, RPCs, dual/unassigned members, correction boundaries, revoked access, alerts/digests and reminder failure cases. The earlier restored-schema rehearsal remains recorded in attendance-rollout-recovery.md.

## Exact remaining release scope

1. Apply only `supabase/migrations/20260925044402_enforce_attendance_team_access.sql` after the acceptance checks below. Its timestamp predates the audit fix; do not use a broad push of all pending migrations.
2. Deploy the prepared `supabase/functions/check-leadership-member-actions/index.ts` change with the cutover: church-wide digest goes to church admins with a generic preview and no member-ID list. Do not invoke its sending path to test on real members.
3. Commit the matching privacy tests/check fixture and package test command as a reviewed batch. Preserve both foundation and full-privacy test commands; the current uncommitted package file needs that merge before release.
4. Verify final live policies/RPCs and actual signed-in browser behavior. Confirm app changes from Setup stage to active-rule wording. Confirm approved grants are honored, absent/revoked grants deny access, and cross-church access fails.

## Acceptance still needed

Latest acceptance, 2026-09-25: Bryan reports the Admin Settings/access-refresh fix works after testing ("Tested it already. It works now"). Record as user-confirmed success for the reported issue. Specific device/build and background/reconnect scenarios were not stated, so do not infer an exhaustive platform test. Final attendance enforcement remains off.

- Separate signed-in non-admin session: Profile roles cannot be edited; team/oversight controls cannot grant access. Database denial is already tested but is not browser proof.
- Follow-up non-admin browser evidence: after owner-email mismatch fix in web1.4.6, Bryan's current ordinary account has no Admin Settings menu; direct /admin/settings shows Admin access required and /leadership/team is blocked. Realtime access invalidation delivered and triggered fresh permission reads without reload. Profile self-role editing and isolated failed-save UI acceptance remain separate checks. Do not reuse earlier admin/leadership counts as current: Bryan changed those grants during testing.
- Non-admin test clarification, 2026-09-25: Bryan removed Admin Dev's church-admin flag. Live checks confirm church_admin=false but platform_owner=true. Both navigation/AdminSettings and the organization-policy UPDATE rule permit platform owners, so this account is not an ordinary-member test identity. It also retains Production Director unless separately changed. Bryan chose to preserve platform-owner access and use a separate ordinary test account. Awaiting a user-controlled email before account setup; do not restore the removed church-admin flag or reuse a real volunteer's identity. Test account must have no admin/owner/leadership privileges or delegated management capabilities.
- Safe failed-save UI check on an isolated test environment, using synthetic data and notifications disabled. The passing database tests do not prove the error message appears in a browser.
- Real-device smoke check completed: on 2026-09-25 Bryan reported all requested checks passed on both Android and iPhone (current website/PWA, Events, Profile, Team Roster/setup notice as applicable). User-reported acceptance, not an agent-observed device session. This does not establish a separate non-admin login or native APK/iOS-build validation; native release work remains separate.
- Recovery: current local restore-tested backup plus targeted recovery files exist; off-device recovery copy remains outstanding. Before a consequential cutover, refresh the recovery snapshot and account for first-stage assignments/removals.

## Pilot boundary

Passing this attendance release is one readiness milestone. It does not certify overall tenant isolation, under-13 chat safeguards, privacy/deletion workflows, abuse limits, store compliance, or outside-church beta readiness. Keep the agreed free, invite-only pilot plan and its separate launch gates.
