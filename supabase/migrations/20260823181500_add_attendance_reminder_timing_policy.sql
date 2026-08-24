-- Make the remaining attendance timing rules church-editable.
alter table public.organization_policy_settings
  add column if not exists attendance_pre_start_reminder_minutes integer not null default 5
    check (attendance_pre_start_reminder_minutes between 0 and 120),
  add column if not exists attendance_auto_absent_after_days integer not null default 2
    check (attendance_auto_absent_after_days between 1 and 14);

comment on column public.organization_policy_settings.attendance_pre_start_reminder_minutes is
  'Minutes before an event start when ServeSync sends its attendance reminder.';
comment on column public.organization_policy_settings.attendance_auto_absent_after_days is
  'Days after an event when missing attendance is automatically recorded as absent.';
