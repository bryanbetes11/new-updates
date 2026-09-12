import { getSetlistReminderState, setlistReminderWaitMinutes } from '../src/lib/setlistReminder';

const now = new Date('2026-09-12T04:00:00Z');
const event = { event_date: '2026-09-20', start_time: '09:00', end_time: '11:00', proposal_due_date: '2026-09-12T03:59:00Z', setlist_required: true };
function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}
equal(getSetlistReminderState(event, [], now), 'overdue', 'missing setlist is eligible immediately after deadline');
equal(getSetlistReminderState({ ...event, proposal_due_date: now.toISOString() }, ['draft'], now), 'due_soon', 'due now');
equal(getSetlistReminderState({ ...event, proposal_due_date: '2026-09-15T04:00:00Z' }, ['revision_requested'], now), 'due_soon', 'three-day boundary');
equal(getSetlistReminderState({ ...event, proposal_due_date: '2026-09-15T04:00:01Z' }, [], now), null, 'too early');
equal(getSetlistReminderState(event, ['pending_review'], now), null, 'submitted setlist does not remind its leader');
equal(getSetlistReminderState(event, ['draft', 'approved'], now), null, 'any approved setlist suppresses reminder');
equal(getSetlistReminderState({ ...event, setlist_required: false }, [], now), null, 'optional setlist');
equal(getSetlistReminderState({ ...event, lifecycle_override: 'completed' }, [], now), null, 'manually completed event');
equal(getSetlistReminderState({ ...event, event_date: '2026-09-11' }, [], now), null, 'past schedule');
equal(getSetlistReminderState({ ...event, proposal_due_date: null }, [], now), null, 'no deadline');
equal(getSetlistReminderState({ ...event, proposal_due_date: 'invalid' }, [], now), null, 'invalid deadline');
equal(setlistReminderWaitMinutes(null, now.getTime()), 0, 'first reminder');
equal(setlistReminderWaitMinutes('2026-09-12T03:59:01Z', now.getTime()), 10, 'round cooldown up');
equal(setlistReminderWaitMinutes('2026-09-12T03:50:00Z', now.getTime()), 0, 'ten-minute cooldown ends');
