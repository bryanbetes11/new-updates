import assert from 'node:assert/strict';
import { assignmentCards, validWidgetRoute, widgetToday, widgetText, type WidgetAssignment } from '../src/lib/widgetSnapshot';

const row = (id: string, status: string, date: string, org = 'church-a', user = 'member-a', completed = false): WidgetAssignment => ({
  id, status, user_id: user, roles: { name: 'Guitarist' },
  events: { id: `event-${id}`, org_id: org, title: 'Sunday Worship', event_date: date, start_time: '09:00:00', lifecycle_override: completed ? 'completed' : null },
});
const rows = [row('later', 'confirmed', '2026-10-18'), row('next', 'pending', '2026-10-11'), row('past', 'pending', '2026-10-01'),
  row('declined', 'declined', '2026-10-11'), row('cross-church', 'pending', '2026-10-11', 'church-b'),
  row('cross-user', 'pending', '2026-10-11', 'church-a', 'member-b'), row('finished', 'confirmed', '2026-10-11', 'church-a', 'member-a', true)];
assert.deepEqual(assignmentCards(rows, 'member-a', 'church-a', '2026-10-05').map(card => card.id), ['next', 'later']);
assert.deepEqual(assignmentCards(rows, 'member-a', 'church-a', '2026-10-05', true).map(card => card.id), ['past', 'next'], 'unresolved past invitations remain actionable');
assert.equal(assignmentCards(rows, 'member-a', 'church-a', '2026-10-05', true)[0].route, '/my-assignments?status=pending');
assert.equal(widgetToday(new Date('2026-10-04T17:00:00Z')), '2026-10-05');
assert.equal(widgetText('<b>Hello</b>\n world'), 'Hello world');
assert.equal(widgetText('a'.repeat(300)).length, 160);
for (const route of ['/events/abc-123', '/announcements/abc-123', '/my-assignments?status=pending', '/messages', '/library']) assert.equal(validWidgetRoute(route), true);
for (const route of ['https://evil.example', '//evil.example', '/events/../admin', '/admin', '/events/a?redirect=https://evil.example', null]) assert.equal(validWidgetRoute(route), false);
