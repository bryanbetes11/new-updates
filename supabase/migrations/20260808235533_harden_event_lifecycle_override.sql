-- The existing same-organization admin policy already authorizes the platform
-- owner account, so remove the redundant policy and cover the new foreign key.

drop policy if exists "Platform owner can update event lifecycle" on public.events;

create index events_lifecycle_override_by_idx
  on public.events (lifecycle_override_by)
  where lifecycle_override_by is not null;
