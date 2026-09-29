import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/Messages.tsx', import.meta.url),
  'utf8',
);

const panelStart = source.indexOf('function ConvInfoPanel');
const panelEnd = source.indexOf('export function Messages()');
assert.ok(panelStart >= 0 && panelEnd > panelStart, 'Chat Info panel implementation should exist');
const panelSource = source.slice(panelStart, panelEnd);

assert.match(panelSource, /'Chat Info'/);
assert.match(panelSource, /max-w-\[700px\]/);
assert.match(panelSource, /h-20 w-20/);
assert.match(panelSource, /const recentMediaItems = mediaItems\.slice\(-4\)\.reverse\(\)/);

assert.match(panelSource, /const \[searchOpen, setSearchOpen\] = useState\(false\)/);
assert.match(panelSource, /const searchInputRef = useRef<HTMLInputElement \| null>\(null\)/);
assert.match(panelSource, /onClick=\{onClose\}[\s\S]*?Message/);
assert.match(panelSource, /onClick=\{\(\) => setSearchOpen\(true\)\}[\s\S]*?Search/);
assert.doesNotMatch(panelSource, />\s*Call\s*</);
assert.doesNotMatch(panelSource, />\s*Video\s*</);

assert.match(panelSource, /View All \(\{mediaItems\.length\}\)/);
assert.match(panelSource, /No files yet/);
assert.match(panelSource, /Shared files will appear here\./);
assert.match(panelSource, /No links yet/);
assert.match(panelSource, /Shared links will appear here\./);

assert.match(panelSource, /Report Person/);
assert.match(panelSource, /Block Direct Messages/);
assert.match(panelSource, /Delete Chat/);
assert.match(panelSource, /Blocking stops one-to-one messages\./);

assert.match(panelSource, /conv\.type === 'personal'/);
assert.match(panelSource, /conv\.members\.length/);
assert.match(panelSource, /setLeaveConfirm\(true\)/);
assert.match(panelSource, /toggleBlock/);
