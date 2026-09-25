-- Send only a per-user invalidation counter, never permission or profile payloads.
create table public.user_access_revisions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 1
);
alter table public.user_access_revisions enable row level security;
revoke all on public.user_access_revisions from public, anon, authenticated;
grant select on public.user_access_revisions to authenticated;
create policy "Members read their own access revision" on public.user_access_revisions
for select to authenticated using (user_id = (select auth.uid()));
insert into public.user_access_revisions(user_id) select id from public.profiles;

create function public.invalidate_user_access() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid; old_target uuid;
begin
  if tg_table_name = 'profiles' then
    target := new.id;
  else
    if tg_op <> 'DELETE' then target := new.user_id; end if;
    if tg_op <> 'INSERT' then old_target := old.user_id; end if;
  end if;
  insert into public.user_access_revisions(user_id)
    select p.id from public.profiles p where p.id = target or p.id = old_target
  on conflict (user_id) do update set revision = public.user_access_revisions.revision + 1;
  return null;
end $$;
revoke all on function public.invalidate_user_access() from public, anon, authenticated;
create trigger invalidate_profile_access after insert or update of org_id,is_org_admin,email
on public.profiles for each row execute function public.invalidate_user_access();
create trigger invalidate_role_access after insert or update or delete
on public.user_roles for each row execute function public.invalidate_user_access();
create trigger invalidate_capability_access after insert or update or delete
on public.organization_member_settings for each row execute function public.invalidate_user_access();

alter publication supabase_realtime add table public.user_access_revisions;
