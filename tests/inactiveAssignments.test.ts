import { strict as assert } from 'node:assert';
import { groupInactiveAssignments, type InactiveAssignmentRow } from '../src/lib/inactiveAssignments';

const row: InactiveAssignmentRow = { event_id: 'event-a', user_id: 'member-a', status: 'confirmed', profiles: { first_name: 'Test', last_name: 'Member', ministry_status: 'inactive' } };
const profile = { first_name: 'Test', last_name: 'Member', ministry_status: 'inactive' };
assert.deepEqual(groupInactiveAssignments([row, row]), { 'event-a': [{ id: 'member-a', name: 'Test Member' }] }, 'multiple roles should name a member only once per event');
assert.deepEqual(Object.keys(groupInactiveAssignments([row, { ...row, event_id: 'event-b', profiles: [profile] }])), ['event-a', 'event-b'], 'each affected event remains actionable');
assert.deepEqual(groupInactiveAssignments([{ ...row, status: 'declined' }, { ...row, profiles: null }, { ...row, profiles: [] }]), {}, 'declined and missing profiles do not generate false warnings');
for (const ministry_status of ['active', 'restoration', 'suspended']) {
  assert.deepEqual(groupInactiveAssignments([{ ...row, profiles: { ...profile, ministry_status } }]), {}, 'only inactive status is in scope');
}
assert.equal(groupInactiveAssignments([{ ...row, status: 'pending' }])['event-a'].length, 1, 'unconfirmed assignments also need review');
assert.deepEqual(groupInactiveAssignments([]), {}, 'removing all assignments clears warnings');
