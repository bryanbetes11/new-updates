import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/pages/leadership/AdminSettings.tsx'), 'utf8');

assert.doesNotMatch(source, /min-h-\[104px\]/, 'administration tool cards should not reserve unused vertical space');
assert.match(
  source,
  /return <Link key=\{tool\.to\}[\s\S]*?group flex items-center gap-3 self-start/,
  'administration tool cards should hug their content and align their contents vertically',
);
