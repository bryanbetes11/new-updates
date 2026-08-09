-- A scheduled end marks the card as Finished, but events remain in Upcoming
-- until the platform owner manually moves them to Past events.

alter table public.events
  add column lifecycle_override text
    check (lifecycle_override in ('upcoming', 'completed')),
  add column lifecycle_override_by uuid references public.profiles(id) on delete set null,
  add column lifecycle_override_at timestamptz;

alter table public.events
  add constraint events_lifecycle_override_metadata_check check (
    (
      lifecycle_override is null
      and lifecycle_override_by is null
      and lifecycle_override_at is null
    )
    or (
      lifecycle_override is not null
      and lifecycle_override_by is not null
      and lifecycle_override_at is not null
    )
  );

create policy "Platform owner can update event lifecycle"
  on public.events for update
  to authenticated
  using (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'bryanbetes11@gmail.com'
  )
  with check (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'bryanbetes11@gmail.com'
  );

comment on column public.events.lifecycle_override is
  'Platform-owner selection that manually places an event in Upcoming or Past events.';
