-- Explicit church-controlled team membership for named attendance access.
-- A volunteer may serve in both groups. No inferred backfill from self-edited
-- ministry roles is safe enough for an access-control decision.
create table public.attendance_team_memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text not null check (team in ('music', 'tech')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, team)
);

create index attendance_team_memberships_user_idx
  on public.attendance_team_memberships (user_id, org_id);

alter table public.attendance_team_memberships enable row level security;
revoke all on public.attendance_team_memberships from public, anon, authenticated;
grant select, insert, delete on public.attendance_team_memberships to authenticated;

create policy "Church members can view attendance teams"
  on public.attendance_team_memberships for select to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "Church admins can assign attendance teams"
  on public.attendance_team_memberships for insert to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.org_id = (select public.auth_org_id())
    )
  );

create policy "Church admins can remove attendance teams"
  on public.attendance_team_memberships for delete to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
  );

create or replace function public.clear_attendance_teams_on_church_exit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.org_id is distinct from old.org_id then
    delete from public.attendance_team_memberships
    where user_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_attendance_teams_on_church_exit on public.profiles;
create trigger clear_attendance_teams_on_church_exit
after update of org_id on public.profiles
for each row execute function public.clear_attendance_teams_on_church_exit();

revoke all on function public.clear_attendance_teams_on_church_exit() from public, anon, authenticated;

-- Leader oversight is separate from a volunteer's own team membership.
create table public.attendance_leader_scopes (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text not null check (team in ('music','tech')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id,user_id,team)
);
create index attendance_leader_scopes_user_idx on public.attendance_leader_scopes(user_id,org_id);
alter table public.attendance_leader_scopes enable row level security;
revoke all on public.attendance_leader_scopes from public,anon,authenticated;
grant select,insert,delete on public.attendance_leader_scopes to authenticated;
create policy "Church members can read leader attendance scopes" on public.attendance_leader_scopes
for select to authenticated using(org_id=(select public.auth_org_id()));
create policy "Church admins assign approved leader attendance scopes" on public.attendance_leader_scopes
for insert to authenticated with check (
  org_id=(select public.auth_org_id()) and (select public.auth_is_org_admin())
  and created_by=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=user_id and p.org_id=(select public.auth_org_id()))
  and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=attendance_leader_scopes.user_id and ur.org_id=attendance_leader_scopes.org_id and r.is_leadership)
);
create policy "Church admins revoke leader attendance scopes" on public.attendance_leader_scopes
for delete to authenticated using(org_id=(select public.auth_org_id()) and (select public.auth_is_org_admin()));

create or replace function public.clear_attendance_teams_on_church_exit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.org_id is distinct from old.org_id then
   delete from public.attendance_team_memberships where user_id=old.id;
   delete from public.attendance_leader_scopes where user_id=old.id;
 end if;
 return new;
end $$;
create function public.clear_ineligible_attendance_leader_scopes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.attendance_leader_scopes s
 where s.user_id=old.user_id and s.org_id=old.org_id
 and not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
   where ur.user_id=s.user_id and ur.org_id=s.org_id and r.is_leadership);
 return null;
end $$;
create trigger clear_ineligible_attendance_leader_scopes after delete or update on public.user_roles
for each row execute function public.clear_ineligible_attendance_leader_scopes();
revoke all on function public.clear_ineligible_attendance_leader_scopes() from public,anon,authenticated;
