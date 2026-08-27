import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/hooks/useMessages.ts'), 'utf8');

assert.match(
  source,
  /message_reactions!message_reactions_message_org_fkey\(emoji, user_id\)/,
  'message history must use the tenant-safe reaction relationship explicitly',
);
assert.doesNotMatch(
  source,
  /\n\s*message_reactions\(emoji, user_id\)/,
  'message history must not use the ambiguous bare reaction relationship',
);
assert.match(
  source,
  /const \{ data, error \} = await supabase[\s\S]*?if \(error\)[\s\S]*?setLoadError/,
  'message loading failures must be surfaced instead of becoming a silent empty conversation',
);
