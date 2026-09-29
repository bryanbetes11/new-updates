import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/Messages.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../src/index.css', import.meta.url),
  'utf8',
);

assert.match(source, /const MESSAGE_GROUP_WINDOW_MS = 5 \* 60 \* 1000/);
assert.match(source, /function messagesBelongToSameGroup/);
assert.match(source, /const joinsNext = !isSystemBoundary[\s\S]*?messagesBelongToSameGroup\(msg, next\)/);
assert.match(source, /const showAvatar = !isMe && !joinsNext/);
assert.match(source, /rounded-tr-\[5px\]/);
assert.match(source, /rounded-tl-\[5px\]/);
assert.match(source, /rounded-br-\[5px\]/);
assert.match(source, /rounded-bl-\[5px\]/);
assert.match(source, /isGrouped && !showDateDivider \? '-mt-\[14px\]'/);
assert.match(source, /needsReactionClearance \? 'mt-0'/);
assert.match(source, /absolute -bottom-2 -mb-2/);
assert.match(source, /isMe \? 'left-1' : '-right-1'/);
assert.match(source, /displaySeers\.length > 0 && !joinsNext/);
assert.match(source, /parseContent\(msg\.content\)\.type === 'delete_request'/);

assert.doesNotMatch(source, /MessageBubbleTail/);
assert.doesNotMatch(source, /showBubbleTail/);
assert.doesNotMatch(styles, /message-bubble-tail/);
assert.doesNotMatch(styles, /clip-path: path\("M 12 0 C/);
