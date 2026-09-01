import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831231534_repair_stale_song_leaders_and_sync_event_titles.sql'),
  'utf8',
);

assert.match(
  migration,
  /set song_leader_id = null,[\s\S]*?title = event\.event_type[\s\S]*?event\.song_leader_id = old\.user_id/,
  'removing a Song Leader assignment should clear the event field and reset its generated title',
);
assert.match(
  migration,
  /case profile\.gender[\s\S]*?when 'male' then 'Bro\.'[\s\S]*?when 'female' then 'Sis\.'[\s\S]*?profile\.first_name/,
  'assigning a Song Leader should generate the same prefixed event title as the editor',
);
assert.match(
  migration,
  /where event\.song_leader_id is not null[\s\S]*?not exists[\s\S]*?role\.name = 'Song Leader'/,
  'events with a stale Song Leader field and no matching assignment should be repaired',
);
