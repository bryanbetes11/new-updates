import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countUnreadConversations } from '../src/hooks/useUnreadCounts';

const unreadSource = readFileSync(resolve(process.cwd(), 'src/hooks/useUnreadCounts.ts'), 'utf8');
const messagesSource = readFileSync(resolve(process.cwd(), 'src/pages/Messages.tsx'), 'utf8');

assert.equal(countUnreadConversations(null), 0);
assert.equal(countUnreadConversations([
  { unread_count: 0 },
  { unread_count: '2' },
  { unread_count: 1 },
]), 2);

assert.match(
  unreadSource,
  /supabase\.rpc\('get_conversations'\)/,
  'the global message badge should use the same visible-conversation RPC as the Messages page',
);
assert.doesNotMatch(
  unreadSource,
  /Calc message unread \(simplified\)/,
  'the badge must not independently count messages from hidden or archived memberships',
);
assert.match(
  messagesSource,
  /sort\(\(a, b\) => Number\(b\.unread_count > 0\) - Number\(a\.unread_count > 0\)\)/,
  'unread conversations should be promoted to the top of the visible list',
);
