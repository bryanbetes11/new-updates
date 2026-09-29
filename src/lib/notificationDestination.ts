import type { Notification } from '../types';

export const SETLIST_QUEUE_PATH = '/leadership/setlists';
export const ATTENDANCE_ACCOUNTABILITY_PATH = '/leadership/team?section=accountability&tab=attendance';

type NotificationDestinationInput = Pick<Notification, 'type' | 'data'>;

/**
 * Resolve an in-app notification without overriding a producer's specific
 * destination. Type-based destinations are intentionally last-resort fallbacks
 * for older rows that do not include an entity ID or URL.
 */
export function resolveNotificationDestination(notification: NotificationDestinationInput): string | null {
  const data = notification.data || {};

  if (data.conversation_id) return `/messages/${data.conversation_id}`;

  if (data.url) {
    // Attendance alerts were historically written with this retired route.
    // Canonicalize only that known producer value; preserve every other URL.
    if (notification.type === 'attendance_alert' && data.url === '/manage?tab=attendance') {
      return ATTENDANCE_ACCOUNTABILITY_PATH;
    }
    return data.url;
  }

  if (data.event_id) return `/events/${data.event_id}`;
  if (data.announcement_id) return '/announcements';
  if (data.video_id) return '/library';

  if (notification.type === 'proposal_overdue_alert') return SETLIST_QUEUE_PATH;
  if (notification.type === 'attendance_alert') return ATTENDANCE_ACCOUNTABILITY_PATH;

  return null;
}
