import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831232715_reassign_feb_mar_legacy_sets_to_bryan.sql'),
  'utf8',
);
const pendingCorrection = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831232828_keep_reassigned_legacy_song_leader_roles_pending.sql'),
  'utf8',
);

assert.match(
  migration,
  /lower\(profile\.email\) = 'fwd\.bryanashleybetes@gmail\.com'[\s\S]*?profile\.first_name = 'Bryan'[\s\S]*?profile\.last_name = 'Betes'/,
  'the correction should resolve Bryan’s current account unambiguously',
);
assert.match(
  migration,
  /6a472053-01dc-4fe1-b6e5-d804904170cd[\s\S]*?e131113c-6bb8-4c54-bb29-36af77347ec3[\s\S]*?2026-02-08[\s\S]*?2026-03-22/,
  'only the confirmed February 8 and March 22 legacy events should be reassigned',
);
assert.match(
  pendingCorrection,
  /set status = 'pending',[\s\S]*?confirmed_at = null[\s\S]*?role\.name = 'Song Leader'/,
  'reassigning historical ownership must still require Song Leader confirmation',
);
