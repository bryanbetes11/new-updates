import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/components/Layout.tsx'), 'utf8');

assert.match(
  source,
  /body\.hasAttribute\('data-modal-lock-count'\)/,
  'route recovery must preserve scrolling locks that still belong to an active modal',
);

assert.match(
  source,
  /if \(root\.style\.overflow === 'hidden'\) root\.style\.overflow = '';/,
  'route changes must clear an ownerless document scroll lock',
);

assert.match(
  source,
  /\}, \[location\.pathname, location\.search\]\);/,
  'scroll-lock recovery must run for every app route and query-state transition',
);
