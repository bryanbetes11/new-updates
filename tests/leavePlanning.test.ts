import assert from 'node:assert/strict';
import { getFollowingSunday, getLeavePlanningEvents, getLeaveHistoryFilters, summarizeTeamLeave } from '../src/lib/leavePlanning';

assert.equal(getFollowingSunday('2026-09-19'), '2026-09-20');
assert.equal(getFollowingSunday('2026-09-18'), null);
assert.equal(getFollowingSunday('2026-09-20'), null);
assert.equal(getFollowingSunday('2022-12-31'), '2023-01-01');
assert.equal(getFollowingSunday('invalid'), null);
assert.equal(getFollowingSunday(null), null);
const events = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'].map(event_date => ({ event_date }));
assert.deepEqual(getLeavePlanningEvents(events, '2026-09-19', '2026-09-19'), events.slice(1, 3), 'Saturday includes only that day and its following Sunday');
assert.deepEqual(getLeavePlanningEvents(events, '2026-09-18', '2026-09-19'), events.slice(0, 3), 'A range ending Saturday includes following Sunday');
assert.deepEqual(getLeavePlanningEvents(events, '2026-09-19', '2026-09-20'), events.slice(1, 3), 'Sunday already in the range is included once, without Monday');
assert.deepEqual(getLeavePlanningEvents(events, '2026-09-18', '2026-09-18'), events.slice(0, 1), 'Friday does not imply weekend leave');
assert.deepEqual(getLeavePlanningEvents(events, '2026-09-20', '2026-09-19'), []);
assert.deepEqual(getLeavePlanningEvents(events, null, null), []);
assert.deepEqual(summarizeTeamLeave([
  { user_id: 'a', status: 'approved' }, { user_id: 'a', status: 'approved' },
  { user_id: 'a', status: 'pending' }, { user_id: 'b', status: 'pending' },
  { user_id: 'c', status: 'rejected' },
]), { approved: 1, pending: 1, total: 2 }, 'Count unique members, prioritize approved status, exclude rejected');
const filters = getLeaveHistoryFilters(new Date(2026, 8, 12));
assert.equal(filters.recent, 'and(leave_type.eq.single,unavailable_date.gte.2026-06-14,unavailable_date.lt.2026-09-12),and(leave_type.eq.range,end_date.gte.2026-06-14,end_date.lt.2026-09-12)');
assert.equal(filters.upcoming, 'and(leave_type.eq.single,unavailable_date.gte.2026-09-12),and(leave_type.eq.range,end_date.gte.2026-09-12)', 'Ongoing range counted once as upcoming; today excluded from recent');
