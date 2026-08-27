import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/pages/EventDetail.tsx'), 'utf8');

assert.match(
  source,
  /revisionDiscussionOverride[\s\S]*?setlist\.status !== 'approved'/,
  'approved setlists must collapse the revision discussion by default',
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
