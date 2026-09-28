import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/pages/leadership/AdminSettings.tsx'), 'utf8');

assert.doesNotMatch(source, /min-h-\[104px\]/, 'administration tool cards should not reserve unused vertical space');
assert.match(
  source,
  /return <Link key=\{tool\.to\}[\s\S]*?group flex min-h-20 items-center gap-3/,
  'administration tool rows should stay compact and align their contents vertically',
);
