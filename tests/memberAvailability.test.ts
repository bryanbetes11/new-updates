import assert from 'node:assert/strict';
import { getOutMemberIdsForDate, isApprovedLeaveOnDate } from '../src/lib/memberAvailability';

const singleLeave = {
  user_id: 'member-single',
  status: 'approved',
  request_type: 'leave',
  leave_type: 'single',
  unavailable_date: '2026-09-06',
};

assert.equal(isApprovedLeaveOnDate(singleLeave, '2026-09-06'), true);
assert.equal(isApprovedLeaveOnDate(singleLeave, '2026-09-07'), false);

const rangeLeave = {
  user_id: 'member-range',
  status: 'approved',
  request_type: 'leave',
  leave_type: 'range',
  start_date: '2026-09-05',
  end_date: '2026-09-07',
};

assert.equal(isApprovedLeaveOnDate(rangeLeave, '2026-09-05'), true, 'range start should be inclusive');
assert.equal(isApprovedLeaveOnDate(rangeLeave, '2026-09-07'), true, 'range end should be inclusive');
assert.equal(isApprovedLeaveOnDate({ ...rangeLeave, status: 'pending' }, '2026-09-06'), false);
assert.equal(isApprovedLeaveOnDate({ ...singleLeave, request_type: 'swap' }, '2026-09-06'), false);

assert.deepEqual(
  [...getOutMemberIdsForDate([singleLeave, rangeLeave], '2026-09-06')].sort(),
  ['member-range', 'member-single'],
);
