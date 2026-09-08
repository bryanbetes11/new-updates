import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/pages/EventDetail.tsx'), 'utf8');

assert.match(
  source,
  /revisionDiscussionOverride[\s\S]*?isAssignedSongLeader && setlist\.status !== 'approved'/,
  'only the assigned Song Leader may see a revision discussion opened by default',
);
assert.match(
  source,
  /aria-expanded=\{showRevisionDiscussion\}/,
  'the revision discussion toggle must expose its expanded state',
);
assert.match(
  source,
  /Setlist approved · open to review the discussion/,
  'collapsed approved discussions must explain how to review the history',
);
assert.match(
  source,
  /initial=\{\{ height: 0, opacity: 0, y: -8 \}\}[\s\S]*?animate=\{\{ height: 'auto', opacity: 1, y: 0 \}\}[\s\S]*?exit=\{\{ height: 0, opacity: 0, y: -6 \}\}/,
  'revision discussion open and close must animate height and opacity',
);
assert.match(
  source,
  /transition=\{prefersReducedMotion \? \{ duration: 0 \}/,
  'revision discussion animation must respect reduced-motion preferences',
);
assert.match(
  source,
  /\.rpc\('record_setlist_revision_discussion_view',[\s\S]*?p_setlist_id: setlistId/,
  'opening a revision discussion must persist a first-seen receipt',
);
assert.match(
  source,
  /setlist_revision_discussion_views[\s\S]*?setRevisionDiscussionViews/,
  'the Seen badge must refresh from the persisted receipts',
);
assert.match(
  source,
  /See who has viewed this discussion[\s\S]*?handleOpenRevisionDiscussionViewers/,
  'the Seen badge must open the discussion viewer list',
);
assert.match(
  source,
  /title="Discussion seen by"[\s\S]*?No one has opened this discussion yet\./,
  'the discussion viewer list must provide a mobile-friendly empty state',
);
