import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/Messages.tsx', import.meta.url),
  'utf8',
);

const pickerStart = source.indexOf('function EmojiPicker');
const pickerEnd = source.indexOf('// ─── Conversation list item');
assert.ok(pickerStart >= 0 && pickerEnd > pickerStart, 'reaction picker implementation should exist');
const pickerSource = source.slice(pickerStart, pickerEnd);

assert.match(source, /MESSAGE_POPOVER_CHROME_CLASS/);
assert.match(pickerSource, /grid-cols-7/);
assert.match(pickerSource, /overflow-x-auto overflow-y-visible/);
assert.match(pickerSource, /h-11 min-w-10[\s\S]*?sm:h-10 sm:w-10/);
assert.match(pickerSource, /text-\[26px\]/);
assert.match(pickerSource, /selectedEmojis\.includes\(reaction\.emoji\)/);
assert.match(pickerSource, /aria-pressed=\{isSelected\}/);
assert.match(pickerSource, /title=\{reaction\.label\}/);
assert.doesNotMatch(pickerSource, /\{reaction\.label\}<\/span>/);
assert.doesNotMatch(pickerSource, /type: 'spring'/);

assert.match(pickerSource, /const width = Math\.min\(312, boundaryRight - boundaryLeft\)/);
assert.match(pickerSource, /const opensAbove = roomAbove >= height \+ 8 \|\| roomBelow < height \+ 8/);
assert.match(pickerSource, /pointer-events-auto fixed inset-0 bg-transparent/);
assert.match(pickerSource, /scale: 0\.97, y: 2/);

assert.match(source, /openEmojiPicker\(msg\.id, e\.currentTarget\)/);
assert.match(source, /openEmojiPicker\(activeMessage\.id, messageActionAnchorRect\)/);
assert.match(source, /boundaryLeft: boundaryRect\.left/);
assert.match(source, /closeEmojiPicker\(\);[\s\S]*?toggleReaction\(messageId, emoji\)/);

for (const emoji of ['👍', '❤️', '😂', '😊', '😮', '😢', '😠']) {
  assert.match(source, new RegExp(`emoji: '${emoji}'`));
}
