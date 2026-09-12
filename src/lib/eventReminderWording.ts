export const eventReminderWording: Record<string, { label: string; body: string }> = {
  event_invitation: { label: 'Event invitation', body: 'You’re invited to [event] on [event date]. Please confirm or decline your attendance in ServeSync.' },
  event_invitation_reminder: { label: 'Attendance response reminder', body: 'Your response for [event] on [event date] is still pending. Please confirm or decline your attendance in ServeSync.' },
  event_reminder: { label: 'Day-before reminder', body: 'Reminder: [event] is tomorrow at [start time]. Open ServeSync to review the event details.' },
  event_today_reminder: { label: 'Event-day reminder', body: '[event] is today at [start time]. Open ServeSync to review the event details.' },
};

export function unsupportedReminderValues(type: string, message: string) {
  if (!eventReminderWording[type]) return [];
  const supported = new Set(['event', 'event type', 'event title', 'event date', 'date', 'start time', 'event id', 'url']);
  const placeholders = message.match(/\[[^\]]+\]|\{\{[^}]+\}\}/g) || [];
  return [...new Set(placeholders.filter(value => !supported.has(value.replace(/^\[|\]$|^\{\{|\}\}$/g, '').replace(/_/g, ' ').trim().toLowerCase())))];
}
