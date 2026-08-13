-- Keep manual event lifecycle overrides limited to the approved owner accounts.

drop policy if exists "Platform owner can update event lifecycle" on public.events;

create policy "Platform owner can update event lifecycle"
  on public.events for update
  to authenticated
  using (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
      'bryanbetes11@gmail.com',
      'fwd.bryanashleybetes@gmail.com',
      'bryanashleybetes@gmail.com'
    )
  )
  with check (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
      'bryanbetes11@gmail.com',
      'fwd.bryanashleybetes@gmail.com',
      'bryanashleybetes@gmail.com'
    )
  );
