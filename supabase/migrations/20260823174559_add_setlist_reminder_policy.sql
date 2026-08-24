-- Church-level switches for the reminder stages sent by check-proposal-deadlines.
-- Defaults preserve the existing schedule: 7 days, 3 days, the day before,
-- the due day, repeated overdue reminders, and one leadership escalation.
alter table public.organization_policy_settings
  add column if not exists setlist_reminder_policy jsonb not null default '{
    "enabled": true,
    "seven_days": true,
    "three_days": true,
    "day_before": true,
    "due_day": true,
    "overdue": true,
    "leadership_escalation": true
  }'::jsonb;

comment on column public.organization_policy_settings.setlist_reminder_policy is
  'Controls the active reminder stages and overdue leadership escalation for setlist proposals.';
