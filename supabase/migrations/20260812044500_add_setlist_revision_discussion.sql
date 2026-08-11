create table if not exists public.setlist_revision_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  reply_to uuid references public.setlist_revision_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlist_revision_comments_setlist_created_idx
  on public.setlist_revision_comments (setlist_id, created_at);
create index if not exists setlist_revision_comments_reply_to_idx
  on public.setlist_revision_comments (reply_to);
create index if not exists setlist_revision_comments_org_id_idx
  on public.setlist_revision_comments (org_id);

create or replace function public.can_access_setlist_revision_discussion(p_setlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.setlists s
    where s.id = p_setlist_id
      and s.org_id = public.auth_org_id()
      and (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = (select auth.uid())
            and ur.org_id = s.org_id
            and r.name in (
              'Admin',
              'Production Director',
              'Music Director',
              'Stage Director',
              'Admin Coordinator',
              'Setlist Coordinator'
            )
        )
        or exists (
          select 1
          from public.event_assignments ea
          join public.roles r on r.id = ea.role_id
          where ea.event_id = s.event_id
            and ea.user_id = (select auth.uid())
            and ea.org_id = s.org_id
            and r.name = 'Song Leader'
        )
      )
  );
$$;

grant execute on function public.can_access_setlist_revision_discussion(uuid) to authenticated;

create or replace function public.prepare_setlist_revision_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
  parent_setlist_id uuid;
begin
  select s.org_id into target_org_id
  from public.setlists s
  where s.id = new.setlist_id;

  if target_org_id is null then
    raise exception 'Setlist not found';
  end if;

  new.org_id := target_org_id;
  new.updated_at := now();

  if new.reply_to is not null then
    select c.setlist_id into parent_setlist_id
    from public.setlist_revision_comments c
    where c.id = new.reply_to;

    if parent_setlist_id is null or parent_setlist_id <> new.setlist_id then
      raise exception 'Reply must belong to the same setlist discussion';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_setlist_revision_comment on public.setlist_revision_comments;
create trigger trg_prepare_setlist_revision_comment
  before insert or update on public.setlist_revision_comments
  for each row execute function public.prepare_setlist_revision_comment();

alter table public.setlist_revision_comments enable row level security;

create policy "Authorized members can view setlist revision comments"
  on public.setlist_revision_comments for select
  to authenticated
  using (public.can_access_setlist_revision_discussion(setlist_id));

create policy "Authorized members can create setlist revision comments"
  on public.setlist_revision_comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_access_setlist_revision_discussion(setlist_id)
  );

create policy "Authors can update setlist revision comments"
  on public.setlist_revision_comments for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.can_access_setlist_revision_discussion(setlist_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.can_access_setlist_revision_discussion(setlist_id)
  );

create policy "Authors can delete setlist revision comments"
  on public.setlist_revision_comments for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.can_access_setlist_revision_discussion(setlist_id)
  );

grant select, insert, update, delete on public.setlist_revision_comments to authenticated;

comment on table public.setlist_revision_comments is
  'Threaded revision discussion shared by setlist reviewers and the Song Leader assigned to the event.';
