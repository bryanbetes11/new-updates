-- Require an explanation for all new assignment declines while preserving
-- historical declined rows that were created before reasons were mandatory.
alter table public.event_assignments
  drop constraint if exists event_assignments_declined_reason_required;

alter table public.event_assignments
  add constraint event_assignments_declined_reason_required
  check (
    status <> 'declined'
    or nullif(btrim(decline_reason), '') is not null
  ) not valid;
