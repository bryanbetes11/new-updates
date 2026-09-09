# Notification activity

Admin Settings → Notification activity (`/admin/notification-activity`) shows new alerts and their recipient activity. Identical notification copy and destinations inserted together form a group; personalized or separately sent alerts can appear separately. Private chat notifications are excluded. No old notifications or read flags are backfilled as clicks.

The report records first opens from device push, the notification bell, and the Notifications page separately. Mark all as read does not record opens. Push `sent` means the provider accepted delivery, not that the device displayed it. The report's times are server-recorded times, so offline opens may appear later. An open is not proof that the destination content was read or understood.

The migration `20260909065233_notification_open_activity.sql` was applied to the connected ServeSync database on September 9, 2026. Its filename matches the remote migration version. It sends no notifications and does not activate Out Today. Frontend/service-worker changes must still be published for deployed members to report opens. Until clients update, “No open recorded” is not evidence that a member ignored an alert.

## Data and access

- Activity is scoped to the recipient's church. Only organization admins, same-church Admin-role members, and the platform owner within their current church can read reports.
- Members can only record opens for their own notifications. Direct client writes, anonymous access, caller-selected recipients, and caller-selected timestamps are disallowed.
- Activity stores the notification title/type, recipient ID, creation time, delivery/read status and first source-open timestamps. It does not copy message bodies, leave reasons, private review notes, IPs, location, or device fingerprints.
- Clearing the notification inbox does not erase activity. Deleting the member or church cascades to its activity. There is no automatic age-based retention policy in this initial version.
- The bell and Notifications page explain that church admins can see notification opens.
- Click queues are local to the signed-in user, bounded to 100 entries and seven days, and retried on connection/resume. The authenticated API checks recipient ownership again. Navigation never waits for analytics.

The [authenticated security-definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) for `record_notification_open` is expected: a narrow public bridge calls a private ownership-checked function. Direct table writes and direct access to the private function remain revoked. Tenant and recipient authorization are covered by tests.

## Verification

`pnpm test:notification-activity` tests the migration with isolated PostgreSQL fixtures, the service-worker tap handoff with fake clients, and the offline/authenticated queue with a fake backend. `tests/fixtures/notificationActivity.html` is a synthetic local-only UI for testing group-to-recipient navigation, mobile layout and loading failures. No real notifications are sent by these tests.
