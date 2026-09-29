# Attendance privacy: first-stage release candidate

Released 2026-09-25 with explicit user authorization. Commit `4c0744df367142f41054ca37147471baf085b72f` is pushed to `origin/main`; Vercel production deployment `DxsDGTVECs99cnBR3dPL1SHhBjA9` is Ready at https://wt.mcjcchurch.com. The preparation notes below are historical; current results follow.

## Applied release

- Applied exactly the three migrations below. MCP generated application-time versions; migration-history versions were then matched atomically to the reviewed filenames (three exact name/version pairs, no SQL replay). Final enforcement migration and Edge Function changes remain local and undeployed.
- Applied the confirmed private checklist: 13 retained members, 15 team rows. All 12 attendance-included members have teams (8 Music only, 2 Tech only, 2 both); Admin Dev retains Music, church-admin/Production Director roles, and attendance exclusion. Four removed memberships remain detached. No roles or attendance inclusion settings were changed.
- Existing church admins already have church-wide oversight; no redundant leader-scope rows were added. Two other non-admin leaders have no explicit attendance scope, as confirmed; this matters at the separate stage-two cutover.
- Exact release candidate passed all 84 test files, typecheck, lint (zero errors, four existing warnings), production build and three foundation suites. Initial missing-public-environment test configuration was corrected before release. Live rollback-only checks passed admin assignment/revocation, non-admin write denial, same-church reads and detached-member isolation. Final checks confirm 15 rows, two RLS-protected tables, removed note columns/old role policies absent, and stage-two function absent.
- GitHub-to-Vercel production deployment succeeded. Local launch records and private checklist/backup artifacts are not in the release commit. No native APK or iOS build was published.
- Signed-in production browser verified Events, 13-member Team Roster, setup-stage wording, Admin Dev attendance exclusion/admin access, Music assignment removal and restoration through the UI (final value confirmed in database), and Profile with read-only roles/no Leadership Notes. No browser error entries were captured. Non-admin enforcement was checked at the authenticated database layer, not a separate non-admin browser login; failure-state UI and physical devices remain unverified.
- Authentication-audit follow-up resolved 2026-09-25: migration `20260925033252_fix_current_org_auth_audit_email_type.sql` explicitly casts `auth.users.email` to the declared text result. Live audit now reports 13 ready accounts; signed-in roster shows zero auth issues without browser warnings/errors. Focused tests reproduce the original failure and verify statuses, tenant separation and unauthorized denial. Commit `69c018a` contains only the migration and focused test; attendance enforcement remains off.

## Intended behavior

Keep existing ministry roles and member data. Add separate admin-controlled Music/Tech serving-team assignments and approved-leader attendance access. Remove the two unused internal note fields and prevent self-assignment of ministry/leadership roles. Final attendance restrictions and reminder changes are deferred to stage two.

Team Manage distinguishes setup from active enforcement. During stage one it explicitly says current attendance permissions remain in effect. A failed readiness check does not claim restrictions are active.

## Exact database scope, in order

1. `20260925011030_remove_unused_internal_leadership_notes.sql`
2. `20260925011929_guard_leadership_role_assignments.sql`
3. `20260925012244_attendance_team_memberships.sql`

Do not include `20260925013222_enforce_attendance_team_access.sql` or deploy the changed `check-leadership-member-actions` Edge Function in this stage. Do not run an unrestricted database push from the dirty working tree: it contains the deferred migration.

Frontend scope: `Discipline.tsx`, `Profile.tsx`, `TeamManage.tsx`, and shared types. Existing ordinary profile managers can maintain ordinary roles; only church admins grant leadership or attendance oversight. Members cannot assign themselves roles. Saved leader scopes require a current same-church leadership role; a role title alone does not grant attendance oversight after stage two.

## Prepared artifacts

The protected local `ServeSyncBackups/first-stage-review/` directory contains:

- `release/`: tracked HEAD baseline plus an explicit first-stage file allowlist. It excludes unrelated working-tree changes, the enforcement migration, and the Edge Function change.
- `release-manifest.json`: baseline commit and SHA256 hashes of the 13 overlaid release files, including a foundation-only package test command.
- `member-assignment-checklist.md` and `.csv`: private roster review, outside Git and the release snapshot. CSV includes empty confirmation columns; no review status is presumed approved.

Baseline commit: `c38685bcc156d9514a8fb8eb59a348967bb172ea`. This records local HEAD, not a fresh remote synchronization or deployment claim.

## Current-data review

Read-only live verification found both new assignment tables absent and none of the four migrations applied. Existing roles are already populated. Suggested serving-team mapping uses Song Leader, Backup Vocals, Guitar, Bass, Drums and Keys for Music; Audio, Lights and Visuals for Tech. Leadership titles and All Members do not infer serving-team membership.

All 12 onboarded attendance-included members have a role-based suggestion: 8 Music, 2 Tech, 2 both. The full 17-profile checklist includes five other profiles; four lack a serving-team suggestion. There is one Music Director holder and three Production Director holders. Confirm the holders and their existing leadership assignments because earlier policies allowed self-assignment. Suggested oversight for those directors is both groups, following Bryan's instruction. Other leaders receive no suggested grant without an explicit decision; church admins already have church-wide access.

## Release procedure after explicit deployment approval

1. Recheck migration status, empty-note guards, current leadership grants and backup freshness. Preserve current production state. The local backup is restore-tested but still lacks an off-device copy.
2. Apply only the three named migrations with migration-history tracking. Publish only the reviewed frontend candidate, preserving unrelated changes. No broad push of the current dirty tree.
3. Perform signed-in checks: admin can assign/revoke Music/Tech and oversight; non-admin cannot grant access; member roles are read-only; ordinary permitted role management still works; missing/failed saves show errors. Confirm stage-one setup wording and unchanged current attendance access.
4. Review the private checklist with the church admin and enter only confirmed assignments. Run `attendance_team_cutover_readiness.sql`; review member exceptions and leaders without grants. Counts alone do not constitute approval.
5. Prepare stage two separately, then enable final access restrictions and deploy the reminder change together after review and signed-in validation. Do not describe stage one as complete privacy enforcement.

## Recovery and verification boundaries

Three-migration-only rehearsal passed on the restored production schema in a rollback-only transaction. Foundation tests passed. The full four-migration rehearsal and broader privacy suites were previously verified independently. No notification/cron jobs ran; the isolated database is stopped.

If the UI release fails after database foundation, retain the safer database protections and fix forward; do not reinstate permissive self-role policies as an automatic rollback. Removed note fields were guarded empty. Any database restore is a separately reviewed action because restoring an old snapshot could lose newer writes.

The actual deployment and assignments above were separately authorized in chat. Physical-device checks and stage-two attendance enforcement remain outstanding. Do not use this first-stage result as outside-beta approval.
