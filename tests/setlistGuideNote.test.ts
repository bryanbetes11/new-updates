import assert from 'node:assert/strict';
import { splitSetlistGuideNote } from '../src/lib/setlistGuideNote';

const saved = 'Revise the closing.\n\nGuide attached for this setlist:\n- Closing: Give thanks.\nContinue this guidance.\n- Worship: Focus on Christ.';
assert.deepEqual(splitSetlistGuideNote(saved), {
  note: 'Revise the closing.',
  sections: [{ title: 'Closing', text: 'Give thanks.\nContinue this guidance.' }, { title: 'Worship', text: 'Focus on Christ.' }],
});
for (const note of ['Plain revision reason', 'Guide attached for this setlist:\nUnfamiliar format', 'Guide attached for this setlist:']) {
  assert.equal(splitSetlistGuideNote(note).note, note, 'unrecognized notes remain complete');
}
