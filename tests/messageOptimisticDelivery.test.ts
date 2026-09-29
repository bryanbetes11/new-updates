import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hookSource = readFileSync(
  new URL('../src/hooks/useMessages.ts', import.meta.url),
  'utf8',
);
const pageSource = readFileSync(
  new URL('../src/pages/Messages.tsx', import.meta.url),
  'utf8',
);

const sendStart = hookSource.indexOf('const sendMessage = useCallback');
const acknowledgeIndex = hookSource.indexOf('await acknowledgeMessage', sendStart);
const optimisticIndex = hookSource.indexOf("delivery_state: 'sending'", sendStart);
const confirmedIndex = hookSource.indexOf("delivery_state: 'sent'", acknowledgeIndex);
const rollbackIndex = hookSource.indexOf('current.filter(message => message.id !== clientMessageId)', acknowledgeIndex);

assert.ok(sendStart >= 0, 'message sending callback exists');
assert.ok(optimisticIndex > sendStart && optimisticIndex < acknowledgeIndex, 'outgoing bubble is added before the server request finishes');
assert.ok(confirmedIndex > acknowledgeIndex, 'successful server acknowledgement changes the bubble to sent');
assert.ok(rollbackIndex > acknowledgeIndex, 'failed sends remove the temporary bubble so the saved draft can be retried');

const composerSendStart = pageSource.indexOf('const handleSend = async () =>');
const clearDraftIndex = pageSource.indexOf("setText('')", composerSendStart);
const awaitSendIndex = pageSource.indexOf('await sendPayload(outgoing)', composerSendStart);
assert.ok(clearDraftIndex > composerSendStart && clearDraftIndex < awaitSendIndex, 'composer clears immediately instead of waiting for the network');
assert.match(pageSource, /msg\.delivery_state === 'sending' \? 'Sending…' : 'Sent'/);
assert.match(pageSource, /msg\.delivery_state === 'sending' \|\| !hasBeenSeen/);
assert.match(pageSource, /initial=\{msg\.delivery_state === 'sending' && !prefersReducedMotion/);
