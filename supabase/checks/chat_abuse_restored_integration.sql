-- LOCAL RESTORE ONLY. Run after the tenant fixture and rate-limit migration.
do $$ begin
  if current_setting('servesync.isolated_rehearsal',true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off' then raise exception 'Unsafe rate-limit rehearsal'; end if;
end $$;
set local session_replication_role=replica;
insert into public.messages(id,org_id,conversation_id,sender_id,content,created_at)
select pg_temp.fixture_id(400+n),pg_temp.fixture_id(100),pg_temp.fixture_id(321),
  pg_temp.fixture_id(1),'Synthetic rate fixture',now()
from generate_series(1,60) n;
set local session_replication_role=origin;
select pg_temp.login(1);
set local role authenticated;
do $$ begin
  begin
    insert into public.messages(org_id,conversation_id,sender_id,content)
    values(pg_temp.fixture_id(100),pg_temp.fixture_id(321),pg_temp.fixture_id(1),'Rate reject');
    raise exception 'FAIL flood was accepted';
  exception when raise_exception then
    if sqlerrm not like '%Too many messages%' then raise; end if;
  end;
end $$;
reset role;
select 'PASS authenticated message flood denied' as result;
