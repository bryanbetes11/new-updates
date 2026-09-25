-- LOCAL RESTORE ONLY. Appended to the attendance rehearsal transaction.
-- Two synthetic churches/users are already present; all changes roll back.
do $$ begin
  if current_setting('servesync.isolated_rehearsal',true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off'
    or exists(select 1 from cron.job) or exists(select 1 from vault.secrets) then
    raise exception 'Unsafe tenant rehearsal';
  end if;
end $$;
create function pg_temp.expect_zero_mutation(statement text,label text) returns void language plpgsql as $$
declare affected integer;
begin
  execute statement;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL %: changed % rows',label,affected; end if;
end $$;
create function pg_temp.expect_tenant_rejection(statement text,label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege then return;
            when raise_exception then
              if sqlerrm like '%conversation church%' then return; end if;
              raise;
  end;
  raise exception 'FAIL expected tenant rejection: %',label;
end $$;

set local session_replication_role=replica;
insert into public.songs(id,org_id,title,created_by) values
  (pg_temp.fixture_id(301),pg_temp.fixture_id(100),'Synthetic A Song',pg_temp.fixture_id(1)),
  (pg_temp.fixture_id(302),pg_temp.fixture_id(200),'Synthetic B Song',pg_temp.fixture_id(9));
insert into public.announcements(id,org_id,title,content,created_by) values
  (pg_temp.fixture_id(311),pg_temp.fixture_id(100),'Synthetic A Notice','Local fixture',pg_temp.fixture_id(1)),
  (pg_temp.fixture_id(312),pg_temp.fixture_id(200),'Synthetic B Notice','Local fixture',pg_temp.fixture_id(9));
insert into public.conversations(id,org_id,type,created_by) values
  (pg_temp.fixture_id(321),pg_temp.fixture_id(100),'group',pg_temp.fixture_id(1)),
  (pg_temp.fixture_id(322),pg_temp.fixture_id(200),'group',pg_temp.fixture_id(9));
insert into public.conversation_members(org_id,conversation_id,user_id) values
  (pg_temp.fixture_id(100),pg_temp.fixture_id(321),pg_temp.fixture_id(1)),
  (pg_temp.fixture_id(100),pg_temp.fixture_id(321),pg_temp.fixture_id(5)),
  (pg_temp.fixture_id(200),pg_temp.fixture_id(322),pg_temp.fixture_id(9)),
  (pg_temp.fixture_id(200),pg_temp.fixture_id(322),pg_temp.fixture_id(10));
insert into public.messages(id,org_id,conversation_id,sender_id,content) values
  (pg_temp.fixture_id(331),pg_temp.fixture_id(100),pg_temp.fixture_id(321),pg_temp.fixture_id(1),'Synthetic A message'),
  (pg_temp.fixture_id(332),pg_temp.fixture_id(200),pg_temp.fixture_id(322),pg_temp.fixture_id(9),'Synthetic B message');
insert into public.organization_policy_settings(org_id) values
  (pg_temp.fixture_id(100)),(pg_temp.fixture_id(200));
set local session_replication_role=origin;

select pg_temp.login(1);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.organizations where id in (pg_temp.fixture_id(100),pg_temp.fixture_id(200))),'Church A admin sees only own church');
select pg_temp.assert_ok((select count(*)=8 from public.profiles where org_id in (pg_temp.fixture_id(100),pg_temp.fixture_id(200))),'Church A admin sees only own members');
select pg_temp.assert_ok((select count(*)=1 from public.events where id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'Church A admin sees only own event');
select pg_temp.assert_ok((select count(*)=1 from public.songs where id in (pg_temp.fixture_id(301),pg_temp.fixture_id(302))),'Church A admin sees only own song');
select pg_temp.assert_ok((select count(*)=1 from public.announcements where id in (pg_temp.fixture_id(311),pg_temp.fixture_id(312))),'Church A admin sees only own notice');
select pg_temp.assert_ok((select count(*)=1 from public.conversations where id in (pg_temp.fixture_id(321),pg_temp.fixture_id(322))),'Church A admin sees only own group');
select pg_temp.assert_ok((select count(*)=1 from public.messages where id in (pg_temp.fixture_id(331),pg_temp.fixture_id(332))),'Church A admin sees only own message');
select pg_temp.assert_ok((select count(*)=1 from public.organization_policy_settings where org_id in (pg_temp.fixture_id(100),pg_temp.fixture_id(200))),'Church A admin sees only own settings');
select pg_temp.expect_zero_mutation($q$update public.songs set title='Forbidden local edit' where id=pg_temp.fixture_id(302)$q$,'Church A cannot edit Church B song');
select pg_temp.expect_zero_mutation($q$update public.events set title='Forbidden local edit' where id=pg_temp.fixture_id(201)$q$,'Church A cannot edit Church B event');
select pg_temp.expect_tenant_rejection($q$insert into public.messages(org_id,conversation_id,sender_id,content) values(pg_temp.fixture_id(200),pg_temp.fixture_id(322),pg_temp.fixture_id(1),'Forbidden local write')$q$,'Church A cannot send to Church B group');
reset role;

select pg_temp.login(10);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.organizations where id in (pg_temp.fixture_id(100),pg_temp.fixture_id(200))),'Church B member sees only own church');
select pg_temp.assert_ok((select count(*)=2 from public.profiles where org_id in (pg_temp.fixture_id(100),pg_temp.fixture_id(200))),'Church B member sees only own members');
select pg_temp.assert_ok((select count(*)=1 from public.events where id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'Church B member sees only own event');
select pg_temp.assert_ok((select count(*)=1 from public.songs where id in (pg_temp.fixture_id(301),pg_temp.fixture_id(302))),'Church B member sees only own song');
select pg_temp.assert_ok((select count(*)=1 from public.announcements where id in (pg_temp.fixture_id(311),pg_temp.fixture_id(312))),'Church B member sees only own notice');
select pg_temp.assert_ok((select count(*)=1 from public.conversations where id in (pg_temp.fixture_id(321),pg_temp.fixture_id(322))),'Church B member sees only joined group');
select pg_temp.assert_ok((select count(*)=1 from public.messages where id in (pg_temp.fixture_id(331),pg_temp.fixture_id(332))),'Church B member sees only joined messages');
select pg_temp.expect_zero_mutation($q$update public.announcements set title='Forbidden local edit' where id=pg_temp.fixture_id(311)$q$,'Church B cannot edit Church A notice');
reset role;

select 'PASS synthetic Church A/B read and write isolation for members, settings, events, songs, notices, and chat' as result;
