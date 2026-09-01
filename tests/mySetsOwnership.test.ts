import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const setlistsTab = readFileSync(resolve(process.cwd(), 'src/pages/library/SetlistsTab.tsx'), 'utf8');
const navigation = readFileSync(resolve(process.cwd(), 'src/components/Navigation.tsx'), 'utf8');

assert.match(
  setlistsTab,
  /select\('event_id, user_id,[\s\S]*?roles!inner\(name\)'\)\.eq\('roles\.name', 'Song Leader'\)/,
  'the set library should load the assigned Song Leader user for each event',
);
assert.match(
  setlistsTab,
  /showMySongLeaderSets && user\?\.id[\s\S]*?songLeaderUserByEvent\[setlist\.event_id\] === user\.id/,
  'My Sets should include only events where the current user is the Song Leader',
);
assert.doesNotMatch(
  setlistsTab,
  /showMyCreatedSets[\s\S]*?setlist\.created_by === user\.id/,
  'My Sets should not use the technical setlist creator as ownership',
);
assert.match(
  navigation,
  /title: "My Sets",[\s\S]*?caption: "As Song Leader"/,
  'navigation should describe the Song Leader meaning of My Sets',
);
