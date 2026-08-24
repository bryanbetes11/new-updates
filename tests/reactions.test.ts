import assert from 'node:assert/strict';
import { groupEmojiReactions } from '../src/lib/reactions';

const grouped = groupEmojiReactions([
  { emoji: '👍', user_id: 'user-1' },
  { emoji: '❤️', user_id: 'user-2' },
  { emoji: '👍', user_id: 'user-3' },
]);

assert.deepEqual(grouped, [
  { emoji: '👍', count: 2, users: ['user-1', 'user-3'] },
  { emoji: '❤️', count: 1, users: ['user-2'] },
]);
assert.deepEqual(groupEmojiReactions([]), []);
