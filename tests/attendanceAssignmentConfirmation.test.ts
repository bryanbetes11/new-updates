import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831225718_confirm_pending_assignments_from_verified_attendance.sql'),
  'utf8',
);

assert.match(
  migration,
  /new\.status not in \('present', 'late'\)[\s\S]*?new\.review_status <> 'verified'/,
  'only verified present or late attendance should confirm an assignment',
);
assert.match(
  migration,
  /assignment\.event_id = new\.event_id[\s\S]*?assignment\.user_id = new\.user_id[\s\S]*?assignment\.org_id = new\.org_id/,
  'attendance confirmation must be limited to the same event, member, and organization',
);
assert.match(
  migration,
  /assignment\.status = 'pending'/,
  'attendance must not overwrite confirmed or explicitly declined assignments',
);
assert.match(
  migration,
  /after insert or update of status, review_status[\s\S]*?on public\.event_attendance/,
  'both new check-ins and later attendance-review verification should run the confirmation rule',
);
