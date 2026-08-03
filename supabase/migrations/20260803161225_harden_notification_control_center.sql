-- Follow-up hardening for the notification control center.

create index if not exists notification_preferences_org_id_idx
  on public.notification_preferences(org_id);

create index if not exists notification_rules_updated_by_idx
  on public.notification_rules(updated_by)
  where updated_by is not null;

create index if not exists notification_system_settings_updated_by_idx
  on public.notification_system_settings(updated_by)
  where updated_by is not null;

-- These helpers are for trusted database triggers, not public Data API calls.
revoke all on function public.create_notification(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.notify_all_except(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
