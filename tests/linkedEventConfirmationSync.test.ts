import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831102457_sync_linked_event_assignment_confirmations.sql'),
  'utf8',
);
const notificationMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831103000_use_main_event_in_linked_confirmation_notifications.sql'),
  'utf8',
);

assert.match(
  migration,
  /new\.source_assignment_id is not null[\s\S]*?source_assignment\.id = new\.source_assignment_id/,
  'confirming a rehearsal assignment must confirm its linked Sunday assignment',
);

assert.match(
  notificationMigration,
  /event_type[\s\S]*?in \('rehearsal', 'rehearsals'\)[\s\S]*?v_event\.linked_event_id[\s\S]*?into v_main_event/,
  'a rehearsal response notification must resolve the linked main event',
);
assert.match(
  notificationMigration,
  /to_char\(v_main_event\.event_date[\s\S]*?v_main_event\.title[\s\S]*?'event_id', v_main_event\.id/,
  'notification copy and navigation must use the main event',
);
assert.match(
  notificationMigration,
  /linked_confirmation_sync'[\s\S]*?return new/,
  'the automatically mirrored confirmation must not create a duplicate notification',
);
assert.match(
  migration,
  /rehearsal_assignment\.source_assignment_id = new\.id/,
  'confirming a Sunday assignment must confirm its linked rehearsal assignment',
);
assert.match(
  migration,
  /new\.status = 'confirmed'[\s\S]*?old\.status is distinct from new\.status/,
  'only a new confirmation should trigger linked synchronization',
);
assert.doesNotMatch(
  migration,
  /new\.status = 'declined'/,
  'declines must remain independent between linked events',
);
assert.match(
  migration,
  /revoke all on function private\.sync_linked_assignment_confirmation\(\)[\s\S]*?public, anon, authenticated/,
  'the privileged trigger function must not be callable through the Data API',
);
