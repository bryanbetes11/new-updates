import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const eventsSource = readFileSync(resolve(process.cwd(), 'src/pages/Events.tsx'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260829113000_sync_linked_rehearsal_assignments.sql'),
  'utf8',
);
const confirmationMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831224848_ensure_linked_assignment_confirmations_sync_both_ways.sql'),
  'utf8',
);

assert.doesNotMatch(
  eventsSource,
  /draft\.event_type === 'Rehearsals'[\s\S]*?event_id: draft\.linked_event_id/,
  'creating a rehearsal must not push rehearsal draft assignments back into the linked service',
);

assert.match(
  migration,
  /rehearsal\.linked_event_id = new\.event_id[\s\S]*?rehearsal\.org_id = new\.org_id/,
  'service assignments should sync only to rehearsals linked in the same organization',
);
assert.match(
  migration,
  /role\.is_leadership = false[\s\S]*?role\.name <> 'Song Leader'/,
  'leadership and song-leader roles should remain service-only',
);
assert.match(
  migration,
  /source_assignment_id, org_id[\s\S]*?on delete cascade/,
  'removing a service assignment should remove its linked rehearsal copies',
);
assert.match(
  migration,
  /when \(new\.synced_from_linked_service = false\)/,
  'automatic rehearsal copies should not send duplicate assignment notifications',
);

assert.match(
  confirmationMigration,
  /rehearsal\.linked_event_id = new\.event_id[\s\S]*?rehearsal_assignment\.user_id = new\.user_id[\s\S]*?rehearsal_assignment\.role_id = new\.role_id/,
  'confirming a service assignment should confirm the matching linked rehearsal assignment',
);
assert.match(
  confirmationMigration,
  /service_assignment\.event_id = v_event\.linked_event_id[\s\S]*?service_assignment\.user_id = new\.user_id[\s\S]*?service_assignment\.role_id = new\.role_id/,
  'confirming a rehearsal assignment should confirm the matching linked service assignment',
);
assert.match(
  confirmationMigration,
  /create trigger trg_sync_linked_assignment_confirmation[\s\S]*?after update of status[\s\S]*?new\.status = 'confirmed'/,
  'linked confirmation synchronization should be installed as a confirmed-status trigger',
);
