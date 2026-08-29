import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const component = readFileSync(resolve(process.cwd(), 'src/components/AttendanceMonitoring.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260829223738_add_team_attendance_consideration_reset.sql'), 'utf8');
const monthlyMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260829224935_allow_monthly_attendance_consideration_reset.sql'), 'utf8');

assert.match(component, /Reset Team Attendance/, 'accountability should expose a clearly named team reset action');
assert.match(component, /btn-secondary[^>]*>\s*<RotateCcw[^>]*\/> Re-send Alerts/, 're-send alerts should have a visible button surface');
assert.match(component, /resettingTeam \? 'Applying\.\.\.' : 'Reset'/, 'the confirmation action should use the concise Reset label');
assert.match(component, /`Q\$\{selectedQuarter\}`/, 'the reset should require a quarter-specific confirmation phrase');
assert.match(component, /toUpperCase\(\)/, 'a monthly reset should require a month-specific confirmation phrase');
assert.match(component, /Reset scope/, 'the dialog should offer a reset scope selector');
assert.match(component, /quarterMonthNumbers/, 'the month choices should follow the selected quarter');
assert.match(component, /p_month: teamResetMonth \? Number\(teamResetMonth\) : null/, 'the selected month should be sent to the guarded operation');
assert.match(component, /setTeamResetConfirmation\(''\)/, 'changing scope should clear the prior confirmation phrase');
assert.match(component, /teamResetReason\.trim\(\)\.length < 8/, 'the reset should require an explanation');
assert.match(component, /reset_team_attendance_for_consideration/, 'the reset should use the guarded database operation');
assert.match(component, /isOrgAdmin \|\| isPlatformOwner/, 'the reset control should be restricted to administrators');
assert.match(component, /Attendance history will not be deleted/, 'the confirmation should explain that raw history is preserved');

assert.match(migration, /public\.auth_is_org_admin\(\)/, 'the database operation should enforce organization-admin authorization');
assert.match(migration, /public\.is_platform_owner\(\)/, 'the platform owner should retain administrative access');
assert.match(migration, /attendance\.org_id = v_org_id/, 'attendance updates must be tenant scoped');
assert.match(migration, /event\.org_id = v_org_id/, 'event selection must be tenant scoped');
assert.match(migration, /status = 'excused'/, 'considered attendance should become excused rather than being deleted');
assert.doesNotMatch(migration, /delete from public\.event_attendance/, 'the reset must not delete attendance history');
assert.match(migration, /revoke all on function[\s\S]*?from public, anon/, 'the privileged RPC should not be callable anonymously');

assert.match(monthlyMigration, /drop function if exists public\.reset_team_attendance_for_consideration\(integer, integer, text\)/, 'the old signature should be removed to avoid an ambiguous RPC overload');
assert.match(monthlyMigration, /p_month integer/, 'the operation should accept an optional month scope');
assert.match(monthlyMigration, /p_month is not null and ceil\(p_month \/ 3\.0\)::integer <> p_quarter/, 'the selected month must belong to the selected quarter');
assert.match(monthlyMigration, /v_start_date := make_date\(p_year, p_month, 1\)/, 'monthly resets should begin on the selected month');
assert.match(monthlyMigration, /interval '1 month - 1 day'/, 'monthly resets should end on the selected month');
assert.match(monthlyMigration, /attendance\.org_id = v_org_id/, 'monthly attendance updates must remain tenant scoped');
assert.match(monthlyMigration, /status = 'excused'/, 'monthly consideration should preserve history as excused');
assert.doesNotMatch(monthlyMigration, /delete from public\.event_attendance/, 'monthly consideration must not delete attendance history');
assert.match(monthlyMigration, /revoke all on function public\.reset_team_attendance_for_consideration\(integer, integer, integer, text\)[\s\S]*?from public, anon/, 'the monthly RPC should not be callable anonymously');
