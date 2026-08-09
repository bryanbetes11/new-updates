-- PostgREST exposes current JWTs through auth.jwt(); keep the legacy role
-- setting as a fallback for older request contexts.

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
    'if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role''',
    'if coalesce(auth.jwt() ->> ''role'', current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'''
  );

  if v_updated_definition = v_definition then
    raise exception 'Service-role authorization guard was not found';
  end if;

  execute v_updated_definition;
end;
$migration$;
