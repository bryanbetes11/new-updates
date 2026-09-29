import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/Messages.tsx', import.meta.url),
  'utf8',
);

assert.match(source, /function ReplyQuotedPreview/);
assert.match(source, /w-0 min-w-full max-w-full overflow-hidden/);
assert.match(source, /block truncate text-\[11px\]/);
assert.match(source, /block truncate text-\[12px\]/);
assert.match(source, /border-l-\[3px\]/);
assert.match(source, /parsed\.type === 'image'[\s\S]*?<img src=\{parsed\.url\}/);
assert.match(source, /isVideoFile[\s\S]*?PlayCircle/);
assert.match(source, /canJump=\{replyOriginalAvailable\}/);

assert.match(source, /const width = Math\.min\(200, boundaryRight - boundaryLeft\)/);
assert.match(source, /MESSAGE_POPOVER_CHROME_CLASS = 'border border-slate-200 bg-white[\s\S]*?dark:bg-\[#202124\]/);
assert.match(source, /rounded-xl \$\{MESSAGE_POPOVER_CHROME_CLASS\}/);
assert.match(source, /initial=\{prefersReducedMotion \? \{ opacity: 0 \} : \{ opacity: 0, scale: 0\.97, y:/);
assert.match(source, /window\.visualViewport\?\.addEventListener\('resize'/);
assert.match(source, /window\.visualViewport\?\.addEventListener\('scroll'/);
assert.match(source, /boundaryLeft: boundaryRect\.left/);
assert.match(source, /const actionAnchor = anchor \|\| messageBubbleRefs\.current\[messageId\]/);
assert.match(source, /pointer-events-auto fixed inset-0 bg-transparent/);
assert.doesNotMatch(source, /pointerLeft/);
assert.match(source, /hover:!bg-emerald-50 hover:!text-emerald-700/);
assert.match(source, /hover:!bg-red-50 hover:!text-red-700/);
assert.match(source, /group-hover:pointer-events-auto[\s\S]*?group-hover:opacity-100/);

assert.match(source, /const latestOwnDeliveryMessageId = useMemo/);
assert.match(source, /msg\.id === latestOwnDeliveryMessageId && msg\.delivery_state/);
assert.doesNotMatch(source, /replied to \{msg\.reply_preview\.sender_name\}/);
