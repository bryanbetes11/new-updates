import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831231149_synchronize_event_song_leader_with_assignment.sql'),
  'utf8',
);
const eventDetail = readFileSync(resolve(process.cwd(), 'src/pages/EventDetail.tsx'), 'utf8');

assert.match(
  eventDetail,
  /assignedSongLeaderId = assignments\.find\([\s\S]*?roles\?\.name === 'Song Leader'[\s\S]*?song_leader_id: assignedSongLeaderId \|\| event\.song_leader_id/,
  'Edit Event should prefer the current Team Members Song Leader assignment',
);
assert.match(
  migration,
  /create trigger trg_sync_event_song_leader_from_assignment[\s\S]*?after insert or delete or update of user_id, role_id/,
  'assignment changes should synchronize the event Song Leader field',
);
assert.match(
  migration,
  /create trigger trg_sync_song_leader_assignment_from_event[\s\S]*?after update of song_leader_id/,
  'editing the event Song Leader should synchronize Team Members',
);
assert.match(
  migration,
  /update public\.events event[\s\S]*?from public\.event_assignments assignment[\s\S]*?role\.name = 'Song Leader'/,
  'existing stale event Song Leader fields should be repaired from Team Members',
);
