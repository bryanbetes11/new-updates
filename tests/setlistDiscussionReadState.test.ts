import assert from 'node:assert/strict';
import {
  allSetlistDiscussionViewers,
  currentSetlistDiscussionViewers,
  latestSetlistDiscussionActivityAt,
  shouldRecordSetlistDiscussionRead,
  type SetlistDiscussionRead,
} from '../src/lib/setlistDiscussionReadState';

const oldView: SetlistDiscussionRead = {
  setlist_id: 'setlist',
  user_id: 'Vinus',
  viewed_at: '2026-09-23T19:46:51.158Z',
  last_viewed_at: '2026-09-23T19:46:51.158Z',
};
const reviewAt = '2026-09-24T04:41:44.236Z';
const latestNoteAt = '2026-09-24T04:44:56.369Z';
const activityAt = latestSetlistDiscussionActivityAt(reviewAt, [
  { created_at: latestNoteAt },
  { created_at: '2026-09-24T04:42:00.000Z' },
]);

assert.equal(activityAt, latestNoteAt, 'a later comment becomes the current discussion activity');
assert.equal(latestSetlistDiscussionActivityAt(reviewAt, []), reviewAt);
assert.equal(latestSetlistDiscussionActivityAt(reviewAt, [{ created_at: latestNoteAt, updated_at: '2026-09-24T05:00:00.000Z' }]), '2026-09-24T05:00:00.000Z', 'an edited comment must be read again');
assert.deepEqual(currentSetlistDiscussionViewers([oldView], 'setlist', activityAt), [],
  'a view from before the latest note does not count as seeing that note');
assert.equal(shouldRecordSetlistDiscussionRead([oldView], 'setlist', 'Vinus', activityAt), true);

const currentView = { ...oldView, last_viewed_at: '2026-09-24T04:50:00.000Z' };
const anotherCurrentView = {
  ...oldView,
  user_id: 'Bryan',
  viewed_at: '2026-09-24T04:45:36.676Z',
  last_viewed_at: '2026-09-24T04:45:36.676Z',
};
assert.deepEqual(
  currentSetlistDiscussionViewers([oldView, anotherCurrentView, currentView], 'setlist', activityAt)
    .map(view => view.user_id),
  ['Vinus', 'Bryan'],
  'the latest read wins for each member and current readers sort newest first',
);
assert.equal(shouldRecordSetlistDiscussionRead([currentView], 'setlist', 'Vinus', activityAt), false);
assert.equal(shouldRecordSetlistDiscussionRead([], 'setlist', 'Vinus', activityAt), true);
assert.equal(shouldRecordSetlistDiscussionRead([], 'setlist', 'Vinus', null), false);
assert.deepEqual(currentSetlistDiscussionViewers([currentView], 'another-setlist', activityAt), [],
  'receipts from another setlist never count');

assert.deepEqual(allSetlistDiscussionViewers([oldView, anotherCurrentView], 'setlist').map(view => view.user_id), ['Bryan', 'Vinus'], 'Earlier readers stay visible even when they have not read the latest note');
