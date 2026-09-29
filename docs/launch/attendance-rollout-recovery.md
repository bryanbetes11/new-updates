# Attendance rollout recovery checkpoint

Checked 2026-09-25, approximately 09:55 Asia/Manila. Project: ServeSync (`uhwkrxihyqkagirdjhht`).

## Current result

### Post-restart continuation — 2026-09-25

Windows was restarted. Verified Docker server 29.8.0 and WSL's docker-desktop distribution running. Created `%LOCALAPPDATA%\ServeSyncBackups` outside Git with filesystem access restricted to Bryan's Windows SID and SYSTEM. Official CLI dry-run export recipes were saved there for roles, schema, data, and migration history, plus supplemental auth/storage schema and encrypted Vault data recipes. No credentials are embedded in recipes. PostgreSQL 17 client image is pinned to digest `sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f`.

A masked local password window named **ServeSync - Private database password** is awaiting input. Windows' initial script-policy restriction was resolved with a process-only execution-policy override; system policy was not changed. The password is temporarily protected with Windows DPAPI, passed to ephemeral export containers through their environment rather than command-line values, and removed from the helper's environment and temporary file when export ends. No password was read into the conversation. Helpers are in `%LOCALAPPDATA%\ServeSyncBackupTools`.

The local helper `continue-after-password.ps1` waits for that window to close; selecting **Use for backup** starts `run-database-backup.ps1` automatically. Cancel does not start an export. Progress/result is `%LOCALAPPDATA%\ServeSyncBackups\backup-status.json`; `active-backup.txt` identifies the private export directory. Do not print SQL dumps or private export logs into chat. Inspect only status, file metadata, and hashes initially. Successful export is explicitly recorded as **restore not verified**.

The CLI rehearsal startup could not connect through a custom internal Docker network and stopped its containers. Recovered by starting a database-only Supabase PostgreSQL 17.6 container named `servesync-restore-rehearsal`. Verified it accepts SQL, has **no published ports**, uses an **internal network**, and has **cron.launch_active_jobs=off**. This container has no production data. The downloaded image is `public.ecr.aws/supabase/postgres:17.6.1.167`; auth/storage service-managed schema compatibility still needs checking during restore. Do not treat the empty engine as a successful restore.

**Current blocker is local password input, not a restart.** After export, inspect manifests; prepare an isolated rehearsal copy; validate restore and the application permission tests. Storage file-byte backup and usable Vault secret recovery remain pending. Do not call an encrypted Vault table export alone a recoverable secret backup. No live migration or deployment has occurred.

Password prompt correction: Bryan reported that the WinForms dialog was not visible. Its process and waiting helper were still alive with no main-window title. Stopped those two task-owned helpers and replaced them with a visible PowerShell launcher, `%LOCALAPPDATA%\ServeSyncBackupTools\start-backup-interactive.ps1`, titled **ServeSync - Database Backup**. It uses `Read-Host -AsSecureString`, then invokes the same export runner directly. The old dialog/waiter are no longer the active path. The launcher passed a PowerShell syntax check; password entry/export remains user-dependent. If its window is unavailable, run that launcher locally with PowerShell's process-only `-ExecutionPolicy Bypass`. Never supply the password in chat or on the command line.

Password reset handoff: Bryan explicitly requested resetting the forgotten database password. Checked 263 files across app source, Edge Functions, scripts, and existing local environment files without printing secret values; no direct Postgres URL/password references were found. `src/lib/supabase.ts` uses the project URL and API key. This does not inventory unknown external tools or hosted environment settings. Opened the signed-in ServeSync Database Settings reset dialog; no new password was entered or submitted. The browser tool's credential-change policy requires the user to perform entry and submission. After the dashboard confirms success, Bryan should enter the new password in the existing local backup console and press Enter; do not request it in chat. Recheck export status before restarting any helper to avoid duplicate exports.

Live project is healthy on PostgreSQL 17.6.1.063. The signed-in Supabase dashboard confirms the organization is on Free and the project has no scheduled project backups. No development branches exist. No recovery point or completed restore has been verified.

Bryan selected free manual backup with local tools and a restore rehearsal. The database password must be entered locally in a masked prompt; never ask for it in chat or commit it. Do not reset the database password automatically because other integrations may depend on it.

## Local tools installed

- Docker Desktop 4.91.0 installed in per-user mode through the official Docker winget package; installer hash verified by winget. Docker CLI reports 29.8.0. Location: `%LOCALAPPDATA%\Programs\DockerDesktop`.
- Microsoft WSL 2.7.13 installed through the official Microsoft winget package; installer hash verified. An initial unelevated WSL install failed with administrator privileges required; the elevated install succeeded with exit code 0.
- Enabled the Windows VirtualMachinePlatform feature with `-NoRestart`. Setup reported **RestartRequired: true**. No automatic restart was performed.
- Setup script/log/result are under `%LOCALAPPDATA%\ServeSyncBackupTools`. These files contain installation status, not database credentials. The installer process completed.
- Supabase CLI is available through `npx --yes supabase`. No local `supabase/config.toml` or linked-project configuration was present. No `docker`, `psql`, or `pg_dump` command was on PATH before setup.

**Immediate blocker:** restart Windows, then verify WSL and Docker's Linux engine run. Starting Docker Desktop alone does not prove the container engine is usable. Do not claim a backup exists until files are created and checked, or a recovery path is verified until a restore succeeds.

## Read-only rollout checks

Saved and executed `supabase/checks/attendance_privacy_preflight.sql` on production. Result at 01:51 UTC:

- All four privacy migrations are unapplied; the team-membership table is absent.
- Both unused leadership-note columns still have zero substantive values.
- Zero attendance church mismatches and zero leadership-assignment church mismatches.
- Every organization containing profiles has at least one church admin.
- Existing leadership assignments: Music Director 1, Production Director 3, Admin Coordinator 1, Setlist Coordinator 1, Stage Director 1. Counts do not establish that each grant was authorized; church admins must review them because historic policies permitted self-assignment.

Saved `supabase/checks/attendance_team_cutover_readiness.sql` for use after the foundation migration. Validated it in isolated PostgreSQL with dual-team and unassigned fixtures. It cannot run on production until the membership table exists. Counts are advisory: actual team choices and intentional admin/self-only exceptions need church-admin review.

## Backup and isolated restore scope

1. After restart, verify Docker engine availability. Create a separate local Supabase recovery workspace outside this repository, binding services to loopback and isolating external network access for the restore. Do not initialize a production-linked reset target or run `db reset --linked`.
2. Use a protected local backup directory outside Git and cloud-sync folders. Obtain the database password locally. The dashboard's verified session-pooler parameters are host `aws-1-ap-southeast-1.pooler.supabase.com`, port `5432`, database `postgres`, user `postgres.uhwkrxihyqkagirdjhht`. Use TLS; do not print credential-bearing connection strings, debug output, or dumps into chat.
3. Follow Supabase's current backup procedure for roles, schema, data, migration history, and custom auth/storage changes. Preserve an untouched export, hashes, and timestamps. The inspected project has 17 auth users, 36 Storage objects across 3 buckets, 18 scheduled jobs, 3 Vault secret records, and 2 custom triggers on managed auth/storage tables. These are inventory counts, not backup completion evidence. Database size was approximately 358 million bytes during the check.
4. Resolve encrypted-secret recovery explicitly before calling the backup complete. Never expose Vault plaintext or copy live secrets into an executable local rehearsal. Prepare a sanitized rehearsal copy with outbound notification/integration calls and scheduled jobs disabled. Keep the original protected export unchanged. Do not replay cron jobs or send test notifications to real members; a transaction rollback cannot undo external calls. Include separate copies of Storage file bytes; database backups only preserve their metadata.
5. Restore into the isolated compatible environment, verify schema/roles/auth relationships and relevant row counts, and compare checksums/inventories. Rehearse the staged migrations and permission matrix with synthetic users. Record restore results, failures, any excluded components, and recovery limitations. Until then, the existing PGlite tests are permission tests, not a production-backup restore test.

The project uses `http`, `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, and `uuid-ossp`; plain PostgreSQL without Supabase services/extensions is not an equivalent full-project restore target.

## Activation remains staged

Follow `privacy-and-church-terms-decisions.md`: verified recovery first; guarded notes removal + role guard + team foundation next; deploy the prepared team UI; admins review leadership and assign Music/Production; only then apply the attendance enforcement migration and update the reminder function. Do not bulk-push all pending migrations before team assignment. No production data, permissions, migrations, or deployments were changed during this checkpoint.

## Verification and next owner

- Production readiness SQL ran successfully; no live writes.
- Cutover query passed the isolated PostgreSQL fixture check.
- Official installers completed; Windows restart is pending. Backup creation, restore rehearsal, Storage copy, and encrypted-secret recovery remain unfinished.
- Bryan: restart Windows when convenient, then return to this task. Codex: verify the engine, prepare the private local password entry and backup, then complete the isolated restore rehearsal. No need to repeat the completed read-only inventory unless production changes or the checkpoint becomes stale.

References: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [local Supabase development](https://supabase.com/docs/guides/local-development/cli/getting-started), [Docker Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/).

### 2026-09-25 — Password helper repair

- User reset database password in dashboard. Actual database authentication remains unverified.
- Interactive helper failed before connection with CommandNotFoundException during local credential preparation. Explicitly loaded Windows PowerShell built-in modules from PSHOME; synthetic end-to-end preflight also caught and fixed trailing newline handling when reading encrypted credentials.
- Updated local helpers in `%LOCALAPPDATA%\ServeSyncBackupTools`; tested using the same Start-Process Windows PowerShell launch method. Encryption, protected-folder write and decrypt preflight passed with synthetic input.
- Reopened repaired helper for private user input. No production exports or restore verification completed yet; no live migrations applied. Next: user enters password, then inspect export status and perform isolated restore verification.

### 2026-09-25 — Docker file transfer repair

- Next attempt passed credential preparation, then failed before database connection: Docker bind mount appeared empty and could not find roles.sh.
- Changed runner to copy only each recipe into an ephemeral container. Docker native copy-out also failed with a Windows symbolic-link error, so retrieval now streams a tar archive to a protected local file and extracts it with Windows tar. Containers are removed in finally; password stays out of command arguments and logs.
- Full runner tested through the same Windows PowerShell launch with synthetic credentials, seven dummy export recipes and Docker network disabled: all seven stages, archive retrieval, extraction and manifest creation passed. This is local tooling verification, not a production backup or restore test.
- Reopened repaired private input window. Actual production backup and restore remain pending user password input; no live migrations applied.

### 2026-09-25 10:24 PHT — Production database exports saved

- All seven read-only export stages completed successfully after user entered the reset password. Saved under `C:\Users\Bryan\AppData\Local\ServeSyncBackups\20260925-100237` outside the repository.
- Verified all seven SQL files against manifest SHA256 hashes; total 14,637,648 bytes. Temporary encrypted password file removed. Database authentication and export succeeded; no live migrations applied.
- This is export completion and integrity verification, not proof of recoverability. Isolated restore, separate Storage file-byte backup, and Vault key/secret recovery remain pending. Restore container has cron disabled; initial auth tables need compatibility handling before importing managed schema. Do not call recovery verified or cut over privacy enforcement yet.

### 2026-09-25 10:31 PHT — Isolated SQL restore verified

- Restored roles, managed auth/storage schema, app schema, data and migration history into `servesync-restore-rehearsal` (local PostgreSQL 17.6). Verified internal-only Docker network, no host port bindings, and cron disabled before restore. Vault values and cron jobs were not loaded. Stopped the container after verification; production was only queried read-only.
- Compared all 106 exported COPY table sections: 21,130 rows, zero row-count differences, zero content differences using sorted COPY-row hashes. Checked 251 foreign keys: zero missing referenced records. Seven original SQL file hashes still match the manifest.
- Restored 74 public tables, 216 public policies, 9 Storage policies, and 2 custom managed-schema triggers. Canonical policy definition fingerprint and table RLS flag fingerprint match current production for public/auth/storage/private. Consistent pg_catalog search_path is required for comparable expression rendering. Realtime managed schema is outside this dump scope.
- Initial load encountered six historical declined assignments without reasons. The existing app CHECK is NOT VALID in production. Fixed restore ordering in the rehearsal copy: defer that check during transactional COPY loading and reinstate its original NOT VALID definition afterward. No historical data was edited. The other production NOT VALID check belongs to excluded realtime.messages.
- Ran attendance_privacy_preflight.sql on the restored database: four privacy migrations still unapplied; unused note values and church-mismatch checks remain zero; all churches with members have an admin. No live feature or device testing is claimed.
- Private evidence: `%LOCALAPPDATA%\ServeSyncBackups\rehearsal\restore\verification.json`, `privacy-preflight.json`, and stage logs. Reusable local helpers: `%LOCALAPPDATA%\ServeSyncBackupTools\restore-rehearsal.cjs` and `verify-restore.cjs`. Original exports remain under `%LOCALAPPDATA%\ServeSyncBackups\20260925-100237`.
- Scope remaining before complete disaster recovery: actual Storage file bytes (36 objects at inventory), scheduled-job configuration (18 jobs at inventory), and recoverable Vault secrets/root-key strategy (3 records at inventory). The encrypted Vault SQL export alone does not establish recovery on a new key. Export snapshots were sequential rather than one global transaction; the checked SQL contents and foreign keys were consistent. External Supabase service configuration and secrets are separate recovery items. No migration/deployment/push performed.

### 2026-09-25 10:36 PHT — Storage, cron and portable Vault-value recovery saved

- Downloaded 36 existing objects across 3 public buckets into the protected timestamped backup directory: 25,865,299 bytes. No bucket permissions changed. All metadata sizes and local SHA256 hashes verified; 35 source single-part MD5 ETags matched, one object lacked that form of checksum. Source metadata fingerprint matched the restored snapshot and current live inventory after downloads (`138a96f45d85add680d25539860ac684`). Actual replacement Storage-service upload is not tested.
- Generated a dedicated RSA OpenPGP recovery key locally using OpenPGP.js 6.3.2 (pinned tooling dependency outside the repo). Private key is under `%LOCALAPPDATA%\ServeSyncBackups\recovery-keys\private.asc`; ACL checked: current user and SYSTEM only. It is not passphrase-encrypted, so protect it as a credential and do not share the backup root.
- Used a read-only production SQL query to encrypt a JSON export of all 3 decrypted Vault values and 18 cron definitions to the recovery PUBLIC key inside PostgreSQL. Only ciphertext left the query. Saved `recovery-bundle.pgp.base64` in the timestamped backup folder; local decryption and record completeness passed without logging or saving plaintext. This allows recovering the secret values independently of the original project Vault root key; original UUIDs/names/descriptions are retained for mapping, and future restore must check UUID dependencies.
- In the isolated container, all 18 recovered schedules were registered with synthetic `SELECT 1` commands, marked inactive and rolled back. Synthetic Vault create/decrypt roundtrip passed and rolled back. Zero jobs/secrets remained afterward; real commands and secrets were never loaded. Container stopped after checks. Live schema/features/settings were not changed; no notifications or job executions were triggered by this work.
- Evidence: timestamped `storage/verification.json`, `storage/manifest.json`, `recovery-bundle-verification.json`; private root `RECOVERY-README.md` contains scope and safe recovery sequence. Helpers: `backup-storage.cjs`, `prepare-recovery-key.cjs`, `verify-recovery-bundle.cjs` in local ServeSyncBackupTools.
- Remaining operational limits: one-computer storage only; encrypted off-device copy and secure recovery-key preservation still needed. Hosted settings/secrets outside Vault, replacement-service upload, and full app/mobile/cutover tests are not covered. Prepared privacy migrations remain unapplied. No commit, push or deployment.

### 2026-09-25 — Privacy migration rehearsal passed; staged rollout still required

- All five `npm run test:attendance-privacy` suites passed: notes removal guards, leadership-role assignment restrictions, team membership management, attendance/RPC privacy, and reminder privacy.
- All four prepared migrations applied successfully in one rollback-only transaction against the restored production PostgreSQL 17.6 schema. Original exports were not edited. Production was not migrated.
- Added `supabase/checks/attendance_privacy_restored_integration.sql`: synthetic users in two synthetic churches exercise actual restored RLS and RPCs. Verified church-admin own-church access, Music/Production team and dual membership boundaries, coordinator self-only attendance, volunteer/unassigned self access, allowed and forbidden edits, admin-only team assignment, blocked self-granted leadership, cross-church exclusion, and immediate revocation after membership removal.
- Fixture requires explicit isolated-rehearsal session marker, cron disabled, zero jobs, and zero Vault entries. The local driver additionally checks Docker internal network and no exposed ports. All migration/fixture changes rolled back; follow-up query confirmed no foundation table, no synthetic users/organizations, and zero cron/Vault rows. Test container stopped afterward.
- Private driver/evidence: `%LOCALAPPDATA%\ServeSyncBackupTools\test-privacy-migrations.cjs`, `%LOCALAPPDATA%\ServeSyncBackups\rehearsal\privacy\result.json` (migration hashes), and `rehearsal.log`.
- Readiness finding: 12 onboarded, attendance-included members in the restored snapshot lack explicit attendance teams. Do not enable enforcement before admin review and assignment (Music, Production, both, or deliberate admin/self-only exception). Existing ministry roles are not an approved substitute for assignments.
- Next: prepare/review a staged production rollout: notes/role protections + membership foundation and corresponding UI first; admin confirms team assignments and existing leadership grants; final enforcement and reminder change afterward. No production rollout authorization inferred from this test request. No push/deploy/commit, and no signed-in browser/mobile feature validation claimed.

### 2026-09-25 — Approved Production hierarchy implemented locally

- Bryan confirmed A: Production Director oversees Music and Tech; Music Director oversees Music only. Changed the prepared/unapplied membership enum/check/UI labels from music/production to music/tech, and widened the Production Director predicate to both explicit groups. No live migration changed.
- Updated permission fixtures, notification-recipient expectations, restored-schema integration checks, readiness counts, and decision record. Music alerts now correctly include the overall Production Director; Tech-only alerts remain inaccessible to Music Directors. Unassigned members remain admin/self-only, and memberships are still admin-assigned rather than inferred from ordinary roles.
- Passed all five attendance-privacy suites, restored production-schema migration/RLS/RPC rehearsal (rolled back), TypeScript check, TeamManage ESLint, production build, and diff whitespace check. Test database stopped. No signed-in browser verification claimed; no commit, push, deployment or live data changes.
- First-stage release preparation and admin review of 12 Music/Tech assignments remain next. Historical references to separate Music/Production groups above are superseded by this decision.

### 2026-09-25 — Configurable leader attendance oversight implemented

- Bryan approved per-church configuration instead of title-based access. Expanded the still-unapplied membership foundation with `attendance_leader_scopes` (Music/Tech), same-church read access, admin-only insert/delete, current-leadership eligibility, church-exit cleanup and last-leadership-role-removal cleanup. No update permission or auto-backfill.
- Enforcement now joins explicit leader scope with member team and current same-church leadership. All existing attendance RPCs/alerts use this common predicate. Titles grant no default scope; admins retain whole-church access, members self access, unassigned members admin/self-only.
- Team Manage includes separate **Attendance team** and **Leader attendance access** controls. Only church admins see/edit oversight controls for approved leaders; Music and Tech may both be selected. Admin profiles explain their existing church-wide access. Failed saves show an error; controls reflect confirmed database state. Existing member-team functionality remains separate.
- Extended tests for admin-only grants, ordinary-member rejection, cross-church denial, cleanup, Music Director overseeing Tech when granted, immediate scope revocation, non-director leaders with explicit grants, and no title-only access. Five privacy suites, typecheck, TeamManage ESLint, final build, and full restored-schema migration/RLS/RPC + readiness-query rehearsal passed. Rehearsal rolled back and container stopped.
- UI source/build checks passed; signed-in browser interaction remains unverified. No live configuration, actual leader grant, migration, commit, push or deployment performed. Next release stage must expose the foundation/admin controls before enforcement, with member team and leader scope decisions reviewed by admins. Off-device recovery copy remains outstanding.

### 2026-09-25 — First-stage release candidate and prefilled checklist prepared

- Fresh read-only production check: no assignment tables and zero prepared migrations applied. Existing ministry roles are populated. Private role-based checklist covers all 17 church profiles; all 12 attendance-included/onboarded members have suggestions (8 Music, 2 Tech, 2 both). Four other profiles need team confirmation. One Music Director and three Production Director holders flagged for review; no assignments applied.
- Prepared exact first-stage snapshot outside Git in `%LOCALAPPDATA%\ServeSyncBackups\first-stage-review\release` from HEAD c38685bcc156d9514a8fb8eb59a348967bb172ea with 13 allowlisted overlays. Deferred enforcement migration/Edge Function changes and private roster excluded. Hash manifest and validation report saved alongside it.
- Added UI readiness messaging so stage-one setup does not falsely imply attendance restrictions are active. Foundation-only tests, three-migration restored-schema rollback rehearsal, typecheck, changed-page ESLint and exact candidate build passed. Build required the canonical Windows packaged-app LocalCache path due to Vite resolving two spellings of the same directory; recovered by running from the canonical path. Runtime behavior was not changed for this tooling issue.
- Saved `docs/launch/first-stage-release.md` with exact scope, migration order, deployment exclusions, recovery limits and checks. Private Markdown/CSV checklist saved outside repository. No private member data added to release source or docs. Snapshot is not a commit or deployment; remote synchronization was not asserted.
- Next user action: review/correct prefilled teams and confirm existing director holders. Deployment needs separate explicit approval, followed by signed-in verification and confirmed assignments. No stage-two enforcement, live writes, commits, pushes or deployments performed.

### 2026-09-25 — Checklist confirmed with exclusions

- Bryan approved the remaining checklist and explicitly retained the Admin Dev test account's Production Director role. Removed four named entries from the private checklist only; the original read-only roster snapshot is preserved. Live-removal scope is pending user clarification, not inferred.
- Private Markdown/CSV and `confirmed-assignments.json` now record 13 confirmed profiles, including 12 attendance-included members. Admin Dev retains its existing attendance exclusion and existing church-admin access in its own church. No cross-church access or duplicate scope grant is implied.
- No live user deletion, membership removal, role change, assignment write, deployment, commit or push performed. Release candidate source unchanged. Await live-removal scope before any removal action; deployment remains separately gated by explicit approval.

### 2026-09-25 — Authorized live membership removals completed

- User clarified that the four excluded checklist accounts should also lose live church access. Removed their organization association/admin flags, one ministry-role assignment and two chat memberships. Preserved auth accounts, profiles and history; Admin Dev and all other profiles' church/admin state unchanged. Three excluded accounts belonged to otherwise empty test churches; remaining main-church members/admins unaffected. No organization was deleted.
- Before mutation saved encrypted targeted preimage (`first-stage-review/pre-removal.pgp.base64`) of four profiles, their roles and chat memberships; decryption verified. Rehearsed on isolated restored database with rollback first.
- Rehearsal exposed existing log_activity failure on clearing org_id while changing admin flag (activity_logs requires org_id). For this authorized transaction only, temporarily disabled the specific profile activity trigger and role-notification trigger, created four explicit removal audit records against original org IDs, and restored both triggers before commit. Table locks and transaction rollback protect against partial state; no lasting schema change. Underlying generic UI removal bug remains recorded for a separate fix.
- Live postchecks under each target's authenticated database identity: auth_org_id null, admin false, zero readable events/conversations/messages. Zero remaining user_roles/conversation_members for all four. Confirmed Admin Dev Production Director/admin unchanged, both triggers enabled, four audit rows. No authentication-account deletion or session termination claimed. Existing public asset URLs/downloaded copies are not revoked by membership removal.
- Updated private confirmed checklist with removal completion. First-stage release candidate and confirmed remaining assignments remain undeployed/unapplied; no source commit, push or deployment. Stopped isolated rehearsal container afterward.

### 2026-09-25 — Authorized first-stage production release complete

- User explicitly authorized deployment and applying the confirmed checklist. Applied only migrations 20260925011030, 20260925011929 and 20260925012244. MCP assigned 20260925032158/032205/032218; aligned the three exact migration-history rows to reviewed filenames atomically, without replaying schema SQL. Deferred attendance enforcement and Edge Function remain local.
- Applied 15 confirmed serving-team rows for 13 retained members after transactional roster, admin, attendance inclusion, role and excluded-account drift assertions. All 12 attendance-included members assigned (8 Music only, 2 Tech only, 2 both). Admin Dev remains excluded with Music membership and existing roles/admin access. Three church admins already cover both groups; two other leaders have no approved scope; zero redundant scope grants.
- Published exactly 13 allowlisted source/test/check/migration/package files in commit 4c0744df367142f41054ca37147471baf085b72f; origin/main synchronized. Package index uses foundation-only script while working copy retains deferred-stage script. No private roster, backup, launch records, unrelated work, deferred migration or Edge Function in commit. Whitespace-only trailing blank removed from preflight SQL before commit.
- Vercel production DxsDGTVECs99cnBR3dPL1SHhBjA9 Ready at https://wt.mcjcchurch.com via existing GitHub integration. Direct connector/CLI lacked access; authenticated GitHub deployment worked. All 84 tests, typecheck, lint (0 errors/4 baseline warnings), production build and three foundation suites passed. Fixed missing public VITE env configuration in isolated validation snapshot before release; no secrets committed.
- Live rollback checks passed admin team/scope assign/revoke, non-admin write denial, same-church reads and detached-user isolation. Final DB checks: 15 membership rows, 0 leader-scope rows, both tables RLS enabled, old self-role policies/note columns absent, final attendance function absent.
- Signed-in Admin Dev browser: Events, roster13, stage-one notice, attendance exclusion, read-only profile roles, note-box removal, team save removal/restoration passed. Final Music row restored via UI; no browser errors captured. Separate non-admin browser, UI failure state and physical-device checks not completed. No new APK/iOS build.
- Unresolved pre-existing auth-audit RPC warning reproduced: get_current_org_auth_audit returns SQLSTATE42804, column3 varchar(255) versus declared text. Roster works but auth issue count is unreliable; fix before pilot sign-off. Off-device backup still outstanding. Saved private checklist applied flag and local launch record; stage-two restrictions remain off. Next: repair auth audit, complete remaining role/device acceptance checks, then separately review stage-two cutover.

### 2026-09-25 — Auth-audit follow-up fixed; stage two prepared

- User approved the next step. Added explicit `au.email::text` in the existing auth-audit return query; authorization, church filter, outputs and grants unchanged. Saved previous SQL in protected `first-stage-review/auth-audit-rollback.sql` before applying. Applied via MCP migration and matched local filename to assigned version 20260925033252 (no history rewrite).
- Focused PGlite test reproduces old failure with varchar(255), then validates all five auth statuses, invite output, authorized admin/director, separate-church results, ordinary/detached/anonymous denial. Live Admin Dev audit now returns 13 ready accounts; ordinary and removed-user calls denied. Signed-in production roster13/zero issues and no captured browser warnings/errors. No member data or permission changes.
- Committed/pushed only migration and test as 69c018ab45dec02c29bfc513b2f99382109a7137. Five privacy suites and focused ESLint passed. No frontend code changes, so no redundant local app build; Git-triggered Vercel deployment tracked separately.
- Saved local second-stage-release.md with exact remaining migration/function scope, required non-admin/browser failure/device acceptance, recovery prerequisite and pilot boundaries. Stage-two function/migration still absent live; 15 membership rows and zero explicit scopes unchanged. Device choice requested from user; physical-device and separate non-admin browser checks remain pending.
- Vercel production deployment CSq9mmN37NNqpmZDHi3RKwmgn4J5 completed successfully for 69c018a (GitHub deployment 6653145432). No deployment failure remains.

### 2026-09-25 — User completed Android and iPhone smoke checks

- Bryan reported all requested first-stage checks passed on both devices. Recorded website/PWA acceptance for Events, Profile and Team Roster/setup notice as applicable. No native-build or separate non-admin-login proof inferred.
- Updated local second-stage checklist only; no code, database, permission or deployment changes. Remaining checks: separate non-admin browser session, isolated failed-save UI check, refreshed recovery snapshot/off-device copy before cutover. Final attendance restrictions remain off; outside-church beta readiness is not established by this device result.

### 2026-09-25 — Admin Dev still sees Admin Settings after church-admin removal

- Diagnosed reported behavior: live profile is_org_admin=false; authenticated auth_is_org_admin()=false and is_platform_owner()=true. Admin Dev's email matches the existing database platform-owner rule. Navigation and AdminSettings explicitly allow either church-admin or platform-owner; organization_policy_settings UPDATE policy also allows the platform owner within the same church. No live settings mutation was attempted.
- This is a separate existing owner permission, not evidence that ordinary-member revocation failed. Account retains Production Director too, so it is not an ordinary-volunteer fixture. Asked whether to retain owner account and use a separate test identity (recommended), or plan transfer/removal of owner authority first. No source edits, permission changes, commits or deployments; local diagnostic/checklist records updated only.

### 2026-09-25 — Separate ordinary test account selected

- Bryan chose to keep Admin Dev as platform owner and use a separate ordinary test account. Preserve current Admin Dev permissions, including the user's removed church-admin flag; no restoration inferred.
- Requested an email address Bryan controls for the separate test account. No account created, invitations sent, permissions changed or deployment performed. Next: verify supplied address is suitable, prepare ordinary-member access without leadership/delegated capabilities, and complete signed-in access tests.

### 2026-09-25 — Owner-permission mismatch and live access refresh

- Bryan tested his existing account after removing admin/leadership roles. Live checks found church-admin=false, frontend email allowlist matched, database platform-owner=false. Removed the frontend email allowlist; ownership now comes from the existing authenticated is_platform_owner RPC, fails closed, and is bound to the current user. Admin Dev remains the database-recognized owner. No real permissions were granted/restored during this fix.
- User also requested updates without killing/reopening web/PWA/APK. Added per-user access-revision table (own-row SELECT only), trigger invalidation for profile admin/church/email, user_roles and organization_member_settings changes, and Realtime publication. Clients authenticate before subscribe, refresh on signals/resume/focus/online and every30s while visible/online. Refreshes coalesce, discard superseded/account-switched results, and clean up listeners. Native App resume hook included. Offline devices cannot receive immediate changes; database enforcement remains authoritative.
- Applied migration 20260925035444_live_access_revision_signals; local CLI-created timestamp was renamed to match MCP application version. Own-row live SELECT and table publication/RLS/three triggers verified. Focused database tests cover admin/role/capability triggers, deletion, own-only reads and denied writes. Full web validation passed 86 tests, typecheck, lint0errors/4baseline warnings and build; owner/refresh queue tests include errors, account switch, offline denial, burst coalescing and disposal.
- Released code in 2621e88fe72c99b50abb5da5357f76946586085c, Android1.4.6/build25. APK package com.babcreations.servesync, 13,705,919bytes, SHA256 AA77F65EEF47F41D56371A369648FF09AA9ACB3485CE08DFCFFAF9C7C7F022BB. Signature matches prior build24 (debug/testing distribution). GitHub prerelease android-v1.4.6-build25 published with two identical assets; both HTTP200, updater offers25 to23/24 and none to25. No physical install/resume claim.
- Initial Vercel deployment failed because existing androidDownload.test.ts still asserted build24 after the version bump. Updated only the version regression expectations, reran all86 tests successfully and pushed follow-up ba96f7a28a3b43eae48b6d55b2618bc290067fbe. Runtime APK unchanged by test-only follow-up. Production deployment and actual browser signal delivery checks pending at this milestone.
- Preserved unrelated changes and deferred stage-two migration/Edge Function. Existing first-stage roster approvals now require fresh review before cutover because Bryan deliberately changed roles/admin flags during testing; do not restore historic grants automatically.
- Final Vercel deployment 6rQH1wy94J41X5BcUhdPwNQs9mUh succeeded for ba96f7a. Browser loaded version1.4.6. Saved-account switch Admin Dev -> Bryan verified ordinary menu omits Admin Settings, direct /admin/settings shows Admin access required, and /leadership/team blocks nonleaders. Admin Dev owner access retained. Returned browser to original Admin Dev login.
- Actual signal delivery verified in the authenticated Bryan browser using a harmless revision-counter increment (no profile/role/capability edits). CDP observed user_access_revisions frame followed immediately by profiles, user_roles, organization_member_settings, is_platform_owner and organizations requests without navigation/reload. Physical Android/iPhone resume behavior still needs user acceptance on updated code. Both published APK assets verified identical against GitHub digest; prior debug signer matches.

### 2026-09-25 — User accepted access-refresh fix

- Bryan confirmed: "Tested it already. It works now." Marked the reported Admin Settings/access-refresh issue accepted by the user. Device/build and individual resume/reconnect scenarios were not specified; no broader platform certification inferred.
- Updated local release records only. No additional code, permission changes, commit, push or deployment. Next outstanding work remains second-stage acceptance/recovery preparation; final attendance restrictions are still off.
