alter table public.user_availability
  add column if not exists requester_dashboard_dismissed_at timestamptz;

comment on column public.user_availability.requester_dashboard_dismissed_at is
  'When the requester permanently removed a completed sub or swap request from their dashboard.';
