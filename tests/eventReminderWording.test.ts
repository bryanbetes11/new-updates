import assert from 'node:assert/strict';
import { eventReminderWording, unsupportedReminderValues } from '../src/lib/eventReminderWording';

for (const [type, wording] of Object.entries(eventReminderWording)) {
  assert.deepEqual(unsupportedReminderValues(type, wording.body), []);
  assert.doesNotMatch(wording.body, /organizer|song leader|\[role\]/i);
}
assert.deepEqual(unsupportedReminderValues('event_invitation_reminder', 'Pending for [role] in [event] on [date]'), ['[role]']);
assert.deepEqual(unsupportedReminderValues('event_invitation', '{{role_name}} in {{event_title}} on [Event Date]'), ['{{role_name}}']);
assert.deepEqual(unsupportedReminderValues('assignment', '[role] in [event]'), [], 'Serving assignment templates retain their role placeholder');
assert.match(eventReminderWording.event_invitation_reminder.body, /confirm or decline your attendance in ServeSync/);
