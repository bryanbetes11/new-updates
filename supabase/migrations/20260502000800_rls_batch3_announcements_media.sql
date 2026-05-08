-- ============================================================================
-- Multi-tenant RLS Batch 3: announcements and media
-- ----------------------------------------------------------------------------
-- Scope:
--   * announcements
--   * announcement_comments
--   * announcement_views
--   * announcement_reactions
--   * announcement_pins
--   * videos
-- ============================================================================

-- ---- org_id autofill triggers -----------------------------------------------

create or replace function public.autofill_announcement_org_id()
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

create or replace function public.autofill_announcement_comment_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select a.org_id
    into new.org_id
    from public.announcements a
    where a.id = new.announcement_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_announcement_view_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select a.org_id
    into new.org_id
    from public.announcements a
    where a.id = new.announcement_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_announcement_reaction_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select a.org_id
    into new.org_id
    from public.announcements a
    where a.id = new.announcement_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_announcement_pin_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select a.org_id
    into new.org_id
    from public.announcements a
    where a.id = new.announcement_id;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_video_org_id()
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
    where p.id = new.uploaded_by;

    if new.org_id is null then
      new.org_id := public.auth_org_id();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_announcements_autofill_org_id on public.announcements;
create trigger trg_announcements_autofill_org_id
  before insert on public.announcements
  for each row execute function public.autofill_announcement_org_id();

drop trigger if exists trg_announcement_comments_autofill_org_id on public.announcement_comments;
create trigger trg_announcement_comments_autofill_org_id
  before insert on public.announcement_comments
  for each row execute function public.autofill_announcement_comment_org_id();

drop trigger if exists trg_announcement_views_autofill_org_id on public.announcement_views;
create trigger trg_announcement_views_autofill_org_id
  before insert on public.announcement_views
  for each row execute function public.autofill_announcement_view_org_id();

drop trigger if exists trg_announcement_reactions_autofill_org_id on public.announcement_reactions;
create trigger trg_announcement_reactions_autofill_org_id
  before insert on public.announcement_reactions
  for each row execute function public.autofill_announcement_reaction_org_id();

drop trigger if exists trg_announcement_pins_autofill_org_id on public.announcement_pins;
create trigger trg_announcement_pins_autofill_org_id
  before insert on public.announcement_pins
  for each row execute function public.autofill_announcement_pin_org_id();

drop trigger if exists trg_videos_autofill_org_id on public.videos;
create trigger trg_videos_autofill_org_id
  before insert on public.videos
  for each row execute function public.autofill_video_org_id();

-- ---- announcements policies -------------------------------------------------

drop policy if exists "Authenticated users can view announcements" on public.announcements;
drop policy if exists "Authenticated users can create announcements" on public.announcements;
drop policy if exists "Creator can update announcements" on public.announcements;
drop policy if exists "Creator can delete announcements" on public.announcements;

create policy "Users can view same-org announcements"
  on public.announcements for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      not coalesce(is_leaders_only, false)
      or public.auth_is_org_leader()
    )
  );

create policy "Users can create same-org announcements"
  on public.announcements for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Creators can update same-org announcements"
  on public.announcements for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Creators can delete same-org announcements"
  on public.announcements for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- announcement_comments policies ----------------------------------------

drop policy if exists "Authenticated users can view comments" on public.announcement_comments;
drop policy if exists "Authenticated users can create comments" on public.announcement_comments;
drop policy if exists "Comment author can delete" on public.announcement_comments;
drop policy if exists "Comment author can update" on public.announcement_comments;

create policy "Users can view same-org announcement comments"
  on public.announcement_comments for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create same-org announcement comments"
  on public.announcement_comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Comment authors can update same-org announcement comments"
  on public.announcement_comments for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Comment authors can delete same-org announcement comments"
  on public.announcement_comments for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- announcement_views policies -------------------------------------------

drop policy if exists "Authenticated users can view announcement views" on public.announcement_views;
drop policy if exists "Users can mark own views" on public.announcement_views;
drop policy if exists "Users can update own views" on public.announcement_views;

create policy "Users can view same-org announcement views"
  on public.announcement_views for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can insert own same-org announcement views"
  on public.announcement_views for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can update own same-org announcement views"
  on public.announcement_views for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- announcement_reactions policies ---------------------------------------

drop policy if exists "Authenticated users can view reactions" on public.announcement_reactions;
drop policy if exists "Authenticated users can add reactions" on public.announcement_reactions;
drop policy if exists "Users can remove their own reactions" on public.announcement_reactions;

create policy "Users can view same-org announcement reactions"
  on public.announcement_reactions for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can add same-org announcement reactions"
  on public.announcement_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Users can remove own same-org announcement reactions"
  on public.announcement_reactions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- announcement_pins policies --------------------------------------------

drop policy if exists "Authenticated users can view pins" on public.announcement_pins;
drop policy if exists "Leaders can pin announcements" on public.announcement_pins;
drop policy if exists "Leaders can update announcement pins" on public.announcement_pins;
drop policy if exists "Leaders can unpin announcements" on public.announcement_pins;

create policy "Users can view same-org announcement pins"
  on public.announcement_pins for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Org leaders can pin same-org announcements"
  on public.announcement_pins for insert
  to authenticated
  with check (
    pinned_by = (select auth.uid())
    and org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can update same-org announcement pins"
  on public.announcement_pins for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  )
  with check (
    pinned_by = (select auth.uid())
    and org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Org leaders can unpin same-org announcements"
  on public.announcement_pins for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

-- ---- videos policies --------------------------------------------------------

drop policy if exists "Authenticated users can view videos" on public.videos;
drop policy if exists "Authenticated users can upload videos" on public.videos;
drop policy if exists "Uploader can update videos" on public.videos;
drop policy if exists "Uploader and Production Director can update videos" on public.videos;
drop policy if exists "Uploader can delete videos" on public.videos;
drop policy if exists "Uploader and Production Director can delete videos" on public.videos;

create policy "Users can view same-org videos"
  on public.videos for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can upload same-org videos"
  on public.videos for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Uploaders and org production directors can update same-org videos"
  on public.videos for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name = 'Production Director'
      )
    )
  )
  with check (
    org_id = public.auth_org_id()
    and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name = 'Production Director'
      )
    )
  );

create policy "Uploaders and org production directors can delete same-org videos"
  on public.videos for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name = 'Production Director'
      )
    )
  );
