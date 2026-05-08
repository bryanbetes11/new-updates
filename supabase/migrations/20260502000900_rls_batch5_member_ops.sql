-- ============================================================================
-- Multi-tenant RLS Batch 5: active member operations
-- ----------------------------------------------------------------------------
-- Scope:
--   * notifications
--   * push_subscriptions
--   * user_availability
--   * user_preferences
--   * event_attendance
--   * attendance_offense_notifications
--   * discipline_records
-- ============================================================================

-- ---- org_id autofill triggers -----------------------------------------------

create or replace function public.autofill_notification_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_push_subscription_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_user_availability_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_user_preference_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_event_attendance_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select e.org_id
    into new.org_id
    from public.events e
    where e.id = new.event_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_attendance_offense_notification_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_discipline_record_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_autofill_org_id on public.notifications;
create trigger trg_notifications_autofill_org_id
  before insert on public.notifications
  for each row execute function public.autofill_notification_org_id();

drop trigger if exists trg_push_subscriptions_autofill_org_id on public.push_subscriptions;
create trigger trg_push_subscriptions_autofill_org_id
  before insert on public.push_subscriptions
  for each row execute function public.autofill_push_subscription_org_id();

drop trigger if exists trg_user_availability_autofill_org_id on public.user_availability;
create trigger trg_user_availability_autofill_org_id
  before insert on public.user_availability
  for each row execute function public.autofill_user_availability_org_id();

drop trigger if exists trg_user_preferences_autofill_org_id on public.user_preferences;
create trigger trg_user_preferences_autofill_org_id
  before insert on public.user_preferences
  for each row execute function public.autofill_user_preference_org_id();

drop trigger if exists trg_event_attendance_autofill_org_id on public.event_attendance;
create trigger trg_event_attendance_autofill_org_id
  before insert on public.event_attendance
  for each row execute function public.autofill_event_attendance_org_id();

drop trigger if exists trg_attendance_offense_notifications_autofill_org_id on public.attendance_offense_notifications;
create trigger trg_attendance_offense_notifications_autofill_org_id
  before insert on public.attendance_offense_notifications
  for each row execute function public.autofill_attendance_offense_notification_org_id();

drop trigger if exists trg_discipline_records_autofill_org_id on public.discipline_records;
create trigger trg_discipline_records_autofill_org_id
  before insert on public.discipline_records
  for each row execute function public.autofill_discipline_record_org_id();

-- ---- notifications policies -------------------------------------------------

drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "System can create notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can view own same-org notifications"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Authenticated users can create same-org notifications"
  on public.notifications for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
  );

create policy "Users can update own same-org notifications"
  on public.notifications for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can delete own same-org notifications"
  on public.notifications for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- push_subscriptions policies -------------------------------------------

drop policy if exists "Users can view own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can create own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own subscriptions" on public.push_subscriptions;

create policy "Users can view own same-org subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can create own same-org subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can update own same-org subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can delete own same-org subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- user_availability policies --------------------------------------------

drop policy if exists "Authenticated users can view availability" on public.user_availability;
drop policy if exists "Users can manage own availability" on public.user_availability;
drop policy if exists "Users can update own availability" on public.user_availability;
drop policy if exists "Users can delete own availability" on public.user_availability;
drop policy if exists "Leaders can approve leave requests" on public.user_availability;
drop policy if exists "Production Director can delete any availability" on public.user_availability;

create policy "Users can view same-org availability"
  on public.user_availability for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create own same-org availability"
  on public.user_availability for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can update own same-org availability"
  on public.user_availability for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can approve same-org leave requests"
  on public.user_availability for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Users can delete own same-org availability"
  on public.user_availability for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org production directors can delete same-org availability"
  on public.user_availability for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.org_id = public.auth_org_id()
        and r.name = 'Production Director'
    )
  );

-- ---- user_preferences policies ---------------------------------------------

drop policy if exists "Authenticated users can view preferences" on public.user_preferences;
drop policy if exists "Users can manage own preferences" on public.user_preferences;
drop policy if exists "Users can update own preferences" on public.user_preferences;
drop policy if exists "Users can delete own preferences" on public.user_preferences;

create policy "Users can view same-org preferences"
  on public.user_preferences for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create own same-org preferences"
  on public.user_preferences for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can update own same-org preferences"
  on public.user_preferences for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can delete own same-org preferences"
  on public.user_preferences for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- event_attendance policies ---------------------------------------------

drop policy if exists "Users can view own attendance" on public.event_attendance;
drop policy if exists "Leadership can view all attendance" on public.event_attendance;
drop policy if exists "Users can insert own attendance" on public.event_attendance;
drop policy if exists "Users can update own attendance" on public.event_attendance;
drop policy if exists "Leadership can update any attendance" on public.event_attendance;
drop policy if exists "Leadership can insert attendance for any user" on public.event_attendance;

create policy "Users can view own same-org attendance"
  on public.event_attendance for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can view same-org attendance"
  on public.event_attendance for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Users can insert own same-org attendance"
  on public.event_attendance for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can insert same-org attendance"
  on public.event_attendance for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Users can update own same-org attendance"
  on public.event_attendance for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can update same-org attendance"
  on public.event_attendance for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

-- ---- attendance_offense_notifications policies -----------------------------

drop policy if exists "Leadership can view offense notifications" on public.attendance_offense_notifications;
drop policy if exists "Leadership can insert offense notifications" on public.attendance_offense_notifications;

create policy "Org leaders can view same-org offense notifications"
  on public.attendance_offense_notifications for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can insert same-org offense notifications"
  on public.attendance_offense_notifications for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

-- ---- discipline_records policies -------------------------------------------

drop policy if exists "Members can view own discipline records" on public.discipline_records;
drop policy if exists "Leadership can view all discipline records" on public.discipline_records;
drop policy if exists "Leadership can insert discipline records" on public.discipline_records;
drop policy if exists "Leadership can update discipline records" on public.discipline_records;

create policy "Members can view own same-org discipline records"
  on public.discipline_records for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can view same-org discipline records"
  on public.discipline_records for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can insert same-org discipline records"
  on public.discipline_records for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can update same-org discipline records"
  on public.discipline_records for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );
