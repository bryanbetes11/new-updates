-- The daily leadership notification job runs with the service-role JWT and
-- must calculate accountability summaries across organizations. Interactive
-- callers keep the existing same-organization/platform-owner restriction.

do $migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.get_org_member_accountability_rollup(uuid,integer,integer)'::regprocedure
  ) into v_definition;

  v_updated_definition := replace(
    v_definition,
    'if p_org_id is distinct from public.auth_org_id() and not public.is_platform_owner() then',
    'if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role''
    and p_org_id is distinct from public.auth_org_id()
    and not public.is_platform_owner() then'
  );

  if v_updated_definition = v_definition then
    raise exception 'Accountability rollup authorization guard was not found';
  end if;

  execute v_updated_definition;
end;
$migration$;
