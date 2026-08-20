-- A decline reason is required only while an assignment is declined.
-- Confirming an assignment intentionally clears this field, so the column
-- itself must remain nullable and the status-aware check owns validation.
alter table public.event_assignments
  alter column decline_reason drop not null;

alter table public.event_assignments
  alter column decline_reason drop default;

alter table public.event_assignments
  drop constraint if exists event_assignments_declined_reason_required;

alter table public.event_assignments
  add constraint event_assignments_declined_reason_required
  check (
    status <> 'declined'
    or nullif(btrim(decline_reason), '') is not null
  ) not valid;
