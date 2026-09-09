export type NotificationOpenSource = 'push' | 'bell' | 'page';
export const notificationOpenParam = '_notification_open';
export const isNotificationId = (value: string | null): value is string => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

export function pushDeliveryLabel(status: string | null) {
  return ({ sent: 'Push accepted', partial: 'Push accepted on some devices', pending: 'Push pending',
    deferred: 'Push deferred', dispatching: 'Push sending', failed: 'Push failed', no_subscription: 'No registered device',
    not_requested: 'Push not requested' } as Record<string, string>)[status || ''] || 'Delivery status unavailable';
}

export function firstNotificationOpen(row: { push_opened_at: string | null; bell_opened_at: string | null; page_opened_at: string | null }) {
  return [row.push_opened_at, row.bell_opened_at, row.page_opened_at].filter((v): v is string => Boolean(v)).sort()[0] || null;
}
