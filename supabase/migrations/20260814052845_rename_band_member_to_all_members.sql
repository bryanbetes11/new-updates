update public.roles
set name = 'All Members'
where name = 'Band Member';

-- A null member on a template row represents the dynamic "all active members"
-- selection. It is expanded to eligible profiles when applied to an event.
alter table public.event_team_template_members
  alter column user_id drop not null;

create or replace function public.save_event_team_template(
  p_template_id uuid,
  p_name text,
  p_members jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := public.auth_org_id();
  v_template_id uuid := p_template_id;
  v_member jsonb;
begin
  if (select auth.uid()) is null or v_org_id is null then
    raise exception 'You must be signed in to save a team template.';
  end if;
  if not public.can_manage_event_team_templates(v_org_id) then
    raise exception 'Only Admins and Admin Coordinators can save team templates.';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Template name must be between 1 and 80 characters.';
  end if;
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception 'Add at least one team assignment before saving.';
  end if;

  if v_template_id is null then
    insert into public.event_team_templates (org_id, name, created_by, updated_by)
    values (v_org_id, trim(p_name), (select auth.uid()), (select auth.uid()))
    returning id into v_template_id;
  else
    update public.event_team_templates
    set name = trim(p_name), updated_by = (select auth.uid())
    where id = v_template_id and org_id = v_org_id;
    if not found then raise exception 'Team template was not found or is not editable.'; end if;
    delete from public.event_team_template_members where template_id = v_template_id;
  end if;

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    insert into public.event_team_template_members (template_id, role_id, user_id, position)
    values (
      v_template_id,
      (v_member->>'role_id')::uuid,
      nullif(v_member->>'user_id', '')::uuid,
      coalesce((v_member->>'position')::integer, 0)
    );
  end loop;

  return v_template_id;
end;
$$;

revoke execute on function public.save_event_team_template(uuid, text, jsonb) from public, anon;
grant execute on function public.save_event_team_template(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
