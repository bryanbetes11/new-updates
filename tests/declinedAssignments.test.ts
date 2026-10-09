import assert from 'node:assert/strict';
import { groupDeclinedAssignments, type DeclinedAssignmentRow } from '../src/lib/declinedAssignments';

const row: DeclinedAssignmentRow = { event_id: 'service', user_id: 'member', status: 'declined', decline_reason: ' Busy ', profiles: { first_name: 'Rachel', last_name: 'Lobos', ministry_status: 'active' } };
const grouped = groupDeclinedAssignments([
  row, { ...row, decline_reason: 'Busy' }, { ...row, decline_reason: 'Different role reason' },
  { ...row, user_id: 'other', profiles: null, decline_reason: null },
  { ...row, event_id: 'rehearsal', status: 'pending' },
  { ...row, user_id: 'confirmed', status: 'confirmed' },
  { ...row, event_id: 'later', profiles: [{ first_name: 'Rachel', last_name: 'Lobos', ministry_status: 'active' }] },
]);
assert.equal(grouped.service.length, 2, 'count people once even with multiple declined roles');
assert.deepEqual(grouped.service[0], { id: 'member', name: 'Rachel Lobos', reasons: ['Busy', 'Different role reason'] });
assert.deepEqual(grouped.service[1], { id: 'other', name: 'Team member', reasons: [] });
assert.equal(grouped.rehearsal, undefined, 'a pending linked rehearsal does not inherit the service decline');
assert.equal(grouped.later[0].name, 'Rachel Lobos', 'Supabase array relationships retain the name');
assert.deepEqual(groupDeclinedAssignments([{ ...row, status: 'confirmed' }]), {}, 'status changes clear the warning');
assert.deepEqual(groupDeclinedAssignments([]), {}, 'removed assignments clear the warning');
