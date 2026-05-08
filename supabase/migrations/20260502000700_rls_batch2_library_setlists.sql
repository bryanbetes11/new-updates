-- ============================================================================
-- Multi-tenant RLS Batch 2: library and setlists
-- ----------------------------------------------------------------------------
-- Scope:
--   * songs
--   * setlists
--   * setlist_songs
--   * setlist_checker_results
--   * setlist_checker_sessions
--   * setlist_reminders
-- ============================================================================

-- ---- org_id autofill triggers -----------------------------------------------

create or replace function public.autofill_song_org_id()
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
    where p.id = new.created_by;

    if new.org_id is null then
      new.org_id := public.auth_org_id();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_setlist_org_id()
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

    if new.org_id is null then
      new.org_id := public.auth_org_id();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_setlist_song_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select sl.org_id
    into new.org_id
    from public.setlists sl
    where sl.id = new.setlist_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_setlist_checker_result_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null and new.setlist_id is not null then
    select sl.org_id
    into new.org_id
    from public.setlists sl
    where sl.id = new.setlist_id;
  end if;

  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.created_by;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_setlist_checker_session_org_id()
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
    where p.id = new.created_by;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_setlist_reminder_org_id()
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

drop trigger if exists trg_songs_autofill_org_id on public.songs;
create trigger trg_songs_autofill_org_id
  before insert on public.songs
  for each row execute function public.autofill_song_org_id();

drop trigger if exists trg_setlists_autofill_org_id on public.setlists;
create trigger trg_setlists_autofill_org_id
  before insert on public.setlists
  for each row execute function public.autofill_setlist_org_id();

drop trigger if exists trg_setlist_songs_autofill_org_id on public.setlist_songs;
create trigger trg_setlist_songs_autofill_org_id
  before insert on public.setlist_songs
  for each row execute function public.autofill_setlist_song_org_id();

drop trigger if exists trg_setlist_checker_results_autofill_org_id on public.setlist_checker_results;
create trigger trg_setlist_checker_results_autofill_org_id
  before insert on public.setlist_checker_results
  for each row execute function public.autofill_setlist_checker_result_org_id();

drop trigger if exists trg_setlist_checker_sessions_autofill_org_id on public.setlist_checker_sessions;
create trigger trg_setlist_checker_sessions_autofill_org_id
  before insert on public.setlist_checker_sessions
  for each row execute function public.autofill_setlist_checker_session_org_id();

drop trigger if exists trg_setlist_reminders_autofill_org_id on public.setlist_reminders;
create trigger trg_setlist_reminders_autofill_org_id
  before insert on public.setlist_reminders
  for each row execute function public.autofill_setlist_reminder_org_id();

-- ---- songs policies ---------------------------------------------------------

drop policy if exists "Authenticated users can view songs" on public.songs;
drop policy if exists "Authenticated users can create songs" on public.songs;
drop policy if exists "Song creator can update songs" on public.songs;
drop policy if exists "Authenticated users can delete songs" on public.songs;

create policy "Users can view same-org songs"
  on public.songs for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create songs in current org"
  on public.songs for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Song creators can update same-org songs"
  on public.songs for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Org members can delete same-org songs"
  on public.songs for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

-- ---- setlists policies ------------------------------------------------------

drop policy if exists "Authenticated users can view setlists" on public.setlists;
drop policy if exists "Authenticated users can create setlists" on public.setlists;
drop policy if exists "Setlist creator can update setlists" on public.setlists;
drop policy if exists "Leaders can update any setlist" on public.setlists;
drop policy if exists "Authenticated users can delete setlists" on public.setlists;

create policy "Users can view same-org setlists"
  on public.setlists for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create setlists in current org"
  on public.setlists for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Setlist creators can update same-org setlists"
  on public.setlists for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Org leaders can update same-org setlists"
  on public.setlists for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      public.auth_is_org_admin()
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name in (
            'Admin',
            'Admin Coordinator',
            'Music Director',
            'Stage Director',
            'Production Director',
            'Setlist Coordinator'
          )
      )
    )
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Org members can delete same-org setlists"
  on public.setlists for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

-- ---- setlist_songs policies -------------------------------------------------

drop policy if exists "Authenticated users can view setlist songs" on public.setlist_songs;
drop policy if exists "Authenticated users can manage setlist songs" on public.setlist_songs;
drop policy if exists "Authenticated users can update setlist songs" on public.setlist_songs;
drop policy if exists "Authenticated users can delete setlist songs" on public.setlist_songs;

create policy "Users can view same-org setlist songs"
  on public.setlist_songs for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create same-org setlist songs"
  on public.setlist_songs for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
  );

create policy "Users can update same-org setlist songs"
  on public.setlist_songs for update
  to authenticated
  using (
    org_id = public.auth_org_id()
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Users can delete same-org setlist songs"
  on public.setlist_songs for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

-- ---- setlist_checker_results policies --------------------------------------

drop policy if exists "Authenticated users can view checker results for their setlists" on public.setlist_checker_results;
drop policy if exists "Authenticated users can create checker results" on public.setlist_checker_results;
drop policy if exists "Creators and leaders can update checker results" on public.setlist_checker_results;

create policy "Users can view same-org checker results"
  on public.setlist_checker_results for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      created_by = (select auth.uid())
      or public.auth_is_org_leader()
    )
  );

create policy "Users can create same-org checker results"
  on public.setlist_checker_results for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Creators and leaders can update same-org checker results"
  on public.setlist_checker_results for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      created_by = (select auth.uid())
      or public.auth_is_org_leader()
    )
  )
  with check (
    org_id = public.auth_org_id()
    and (
      created_by = (select auth.uid())
      or public.auth_is_org_leader()
    )
  );

-- ---- setlist_checker_sessions policies -------------------------------------

drop policy if exists "Users can manage their own checker sessions" on public.setlist_checker_sessions;
drop policy if exists "Users can insert their own checker sessions" on public.setlist_checker_sessions;
drop policy if exists "Users can update their own checker sessions" on public.setlist_checker_sessions;
drop policy if exists "Users can delete their own checker sessions" on public.setlist_checker_sessions;

create policy "Users can view own same-org checker sessions"
  on public.setlist_checker_sessions for select
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can insert own same-org checker sessions"
  on public.setlist_checker_sessions for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can update own same-org checker sessions"
  on public.setlist_checker_sessions for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can delete own same-org checker sessions"
  on public.setlist_checker_sessions for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- setlist_reminders policies --------------------------------------------

drop policy if exists "Leadership can insert setlist reminders" on public.setlist_reminders;
drop policy if exists "Leadership can view setlist reminders" on public.setlist_reminders;

create policy "Org leaders can insert same-org setlist reminders"
  on public.setlist_reminders for insert
  to authenticated
  with check (
    sent_by = (select auth.uid())
    and org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can view same-org setlist reminders"
  on public.setlist_reminders for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );
