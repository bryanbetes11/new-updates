import assert from 'node:assert/strict';
import {
  ATTENDANCE_ACCOUNTABILITY_PATH,
  SETLIST_QUEUE_PATH,
  resolveNotificationDestination,
} from '../src/lib/notificationDestination';

const notification = (type: string, data: Record<string, string> = {}) => ({ type, data });

for (const type of ['assignment', 'assignment_response', 'assignment_confirmed', 'assignment_declined', 'assignment_removed', 'assignment_confirmation_reminder']) {
  assert.equal(resolveNotificationDestination(notification(type, { event_id: 'event-123' })), '/events/event-123?tab=team');
  assert.equal(resolveNotificationDestination(notification(type, { url: '/events/event-123?source=notice#member' })), '/events/event-123?source=notice&tab=team#member');
}
assert.equal(resolveNotificationDestination(notification('assignment_declined', { url: '/events/event-123?tab=attendance' })), '/events/event-123?tab=attendance', 'an explicit tab remains authoritative');
assert.equal(resolveNotificationDestination(notification('assignment', { url: '/events/event-123?mode=live' })), '/events/event-123?mode=live', 'live mode is preserved');
assert.equal(resolveNotificationDestination(notification('assignment_declined', { url: 'https://example.com/events/event-123' })), 'https://example.com/events/event-123', 'do not rewrite external destinations');

assert.equal(
  resolveNotificationDestination(notification('proposal_overdue_alert')),
  SETLIST_QUEUE_PATH,
  'legacy overdue proposal alerts without navigation data should open Setlist Queue',
);

assert.equal(
  resolveNotificationDestination(notification('proposal_overdue_alert', {
    event_id: 'event-123',
    url: '/leadership/setlists',
    reminder_key: 'proposal_overdue_alert_overdue_2026-09-29_morning_event-123_leader-123',
    song_leader_id: 'leader-123',
  })),
  SETLIST_QUEUE_PATH,
  'the current leadership overdue-proposal payload should open Setlist Queue',
);

assert.equal(
  resolveNotificationDestination(notification('attendance_alert')),
  ATTENDANCE_ACCOUNTABILITY_PATH,
  'legacy attendance review alerts without navigation data should open Accountability Attendance',
);

assert.equal(
  resolveNotificationDestination(notification('attendance_alert', { url: '/manage?tab=attendance' })),
  ATTENDANCE_ACCOUNTABILITY_PATH,
  'the retired attendance-review URL should resolve to the current accountability page',
);

assert.equal(
  resolveNotificationDestination(notification('attendance_alert', { url: '/leadership/team?section=accountability&tab=conduct' })),
  '/leadership/team?section=accountability&tab=conduct',
  'an explicit non-legacy URL must remain authoritative',
);

assert.equal(
  resolveNotificationDestination(notification('proposal_overdue_alert', { url: '/events/specific-event' })),
  '/events/specific-event',
  'an explicit URL must win over the notification-type fallback',
);

assert.equal(
  resolveNotificationDestination(notification('proposal_overdue_alert', { event_id: 'event-123' })),
  '/events/event-123',
  'an explicit event ID must win over the notification-type fallback',
);

assert.equal(
  resolveNotificationDestination(notification('proposal_reminder', { event_id: 'event-123', url: '/events/event-123' })),
  '/events/event-123',
  'song-leader proposal reminders should retain their explicit event destination',
);

assert.equal(
  resolveNotificationDestination(notification('attendance_alert', { conversation_id: 'conversation-123', url: '/elsewhere' })),
  '/messages/conversation-123',
  'conversation IDs must retain highest precedence',
);

assert.equal(
  resolveNotificationDestination(notification('announcement_reaction', { announcement_id: 'announcement-123' })),
  '/announcements',
  'existing announcement destinations should be preserved',
);

assert.equal(
  resolveNotificationDestination(notification('video_added', { video_id: 'video-123' })),
  '/library',
  'existing video destinations should be preserved',
);

assert.equal(
  resolveNotificationDestination(notification('unknown')),
  null,
  'unknown notifications without navigation data should not invent a destination',
);
