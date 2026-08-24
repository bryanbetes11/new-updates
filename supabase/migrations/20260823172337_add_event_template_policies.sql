-- Church-defined event defaults. These are deliberately data, not frontend-only
-- constants, so admins can adjust start/end times and setlist deadlines without a deployment.
alter table public.organization_policy_settings
  add column if not exists event_templates jsonb not null default '{
    "Sunday Service": {"start_time":"07:30","end_time":"11:30","setlist_due_days_before":21,"service_format":"sunday_full"},
    "LGTF (Midweek)": {"start_time":"19:30","end_time":"21:00","setlist_due_days_before":3,"service_format":"sunday_short"},
    "Prayer Meeting": {"start_time":"18:30","end_time":"19:30","setlist_due_days_before":6,"service_format":"sunday_short"},
    "Online Devotion": {"start_time":"21:00","end_time":"22:00","setlist_due_days_before":null,"service_format":"opening_closing_only"},
    "Equipping": {"start_time":"19:30","end_time":"21:00","setlist_due_days_before":null,"service_format":"custom"},
    "Youth Recharge": {"start_time":"16:00","end_time":"18:00","setlist_due_days_before":7,"service_format":"custom"},
    "Rehearsals": {"start_time":"","end_time":"","setlist_due_days_before":null,"service_format":"custom"},
    "Revamp Session": {"start_time":"","end_time":"","setlist_due_days_before":null,"service_format":"custom"},
    "Custom": {"start_time":"","end_time":"","setlist_due_days_before":null,"service_format":"custom"}
  }'::jsonb,
  add column if not exists setlist_submission_mode text not null default 'block_rejected'
    check (setlist_submission_mode in ('advisory', 'block_rejected'));
