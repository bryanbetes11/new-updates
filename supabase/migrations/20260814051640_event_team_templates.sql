create table if not exists public.event_team_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.event_team_template_members (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.event_team_templates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (template_id, role_id, user_id)
);

create index if not exists event_team_templates_org_id_idx
  on public.event_team_templates (org_id, updated_at desc);
create index if not exists event_team_template_members_template_id_idx
  on public.event_team_template_members (template_id, position);

create or replace function public.can_manage_event_team_templates(p_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.org_id = p_org_id
      and (
        p.is_org_admin
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p.id
            and ur.org_id = p_org_id
            and r.name in ('Admin', 'Admin Coordinator')
        )
      )
  );
$$;

alter table public.event_team_templates enable row level security;
alter table public.event_team_template_members enable row level security;

create policy "Admins and coordinators can view team templates"
on public.event_team_templates for select to authenticated
using (public.can_manage_event_team_templates(org_id));

create policy "Admins and coordinators can create team templates"
on public.event_team_templates for insert to authenticated
with check (
  public.can_manage_event_team_templates(org_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "Admins and coordinators can update team templates"
on public.event_team_templates for update to authenticated
using (public.can_manage_event_team_templates(org_id))
with check (
  public.can_manage_event_team_templates(org_id)
  and updated_by = (select auth.uid())
);

create policy "Admins and coordinators can delete team templates"
on public.event_team_templates for delete to authenticated
using (public.can_manage_event_team_templates(org_id));

create policy "Admins and coordinators can view team template members"
on public.event_team_template_members for select to authenticated
using (
  exists (
    select 1 from public.event_team_templates t
    where t.id = template_id
      and public.can_manage_event_team_templates(t.org_id)
  )
);

create policy "Admins and coordinators can create team template members"
on public.event_team_template_members for insert to authenticated
with check (
  exists (
    select 1 from public.event_team_templates t
    where t.id = template_id
      and public.can_manage_event_team_templates(t.org_id)
  )
);

create policy "Admins and coordinators can update team template members"
on public.event_team_template_members for update to authenticated
using (
  exists (
    select 1 from public.event_team_templates t
    where t.id = template_id
      and public.can_manage_event_team_templates(t.org_id)
  )
)
with check (
  exists (
    select 1 from public.event_team_templates t
    where t.id = template_id
      and public.can_manage_event_team_templates(t.org_id)
  )
);

create policy "Admins and coordinators can delete team template members"
on public.event_team_template_members for delete to authenticated
using (
  exists (
    select 1 from public.event_team_templates t
    where t.id = template_id
      and public.can_manage_event_team_templates(t.org_id)
  )
);

grant select, insert, update, delete on public.event_team_templates to authenticated;
grant select, insert, update, delete on public.event_team_template_members to authenticated;
grant execute on function public.can_manage_event_team_templates(uuid) to authenticated;
revoke execute on function public.can_manage_event_team_templates(uuid) from anon;

drop trigger if exists set_event_team_templates_updated_at on public.event_team_templates;
create trigger set_event_team_templates_updated_at
before update on public.event_team_templates
for each row execute function public.touch_updated_at();
