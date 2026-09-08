import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const eventsSource = fs.readFileSync(path.resolve('src/pages/Events.tsx'), 'utf8');

assert.match(
  eventsSource,
  /const hasSetlistSongs = \(setlistInfo\?\.songCount \?\? 0\) > 0;/,
  'Event cards must distinguish a setlist with songs from an empty setlist',
);
assert.match(
  eventsSource,
  /hasApprovedSetlist \? 'Ready' : setlistInfo\?\.status === 'pending_review' \? 'Pending review' : hasSetlistSongs \? 'Draft' : 'No songs yet'/,
  'Events with saved songs must show Draft until they are submitted or approved',
);
