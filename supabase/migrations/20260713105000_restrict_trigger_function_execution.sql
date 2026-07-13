-- Trigger functions execute through their owning trigger and are not client RPCs.
-- Remove direct authenticated access while preserving trigger behavior.
do $$
declare
  function_record record;
begin
  for function_record in
    select distinct p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from authenticated',
      function_record.function_signature
    );
  end loop;
end;
$$;
