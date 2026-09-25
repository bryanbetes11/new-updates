-- LOCAL RESTORE ONLY. Run inside the rollback-only migration rehearsal.
-- Requires isolated networking, cron disabled, and all four privacy migrations.
-- Never run this fixture on production: replica mode suppresses fixture triggers.
do $$ begin
  if current_setting('servesync.isolated_rehearsal',true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off'
    or exists(select 1 from cron.job) or exists(select 1 from vault.secrets) then
    raise exception 'This fixture requires the isolated, job-free, secret-free rollback rehearsal';
  end if;
end $$;
create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$
  select ('fc250925-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL %',label; end if; end $$;
create function pg_temp.login(n integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',pg_temp.fixture_id(n)::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture_id(n),'role','authenticated')::text,true);
end $$;
create function pg_temp.expect_denied(statement text,label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege then return;
  end;
  raise exception 'FAIL expected access denial: %',label;
end $$;

set local session_replication_role=replica;
insert into public.organizations(id,name,slug) values
  (pg_temp.fixture_id(100),'Recovery Test A','recovery-test-a-fc250925'),
  (pg_temp.fixture_id(200),'Recovery Test B','recovery-test-b-fc250925');
insert into auth.users(id,email) select pg_temp.fixture_id(n),'recovery-'||n||'@example.invalid' from generate_series(1,10) n;
insert into public.profiles(id,org_id,first_name,last_name,email,is_onboarded,is_org_admin)
select pg_temp.fixture_id(n),pg_temp.fixture_id(case when n<=8 then 100 else 200 end),
  'Synthetic','Recovery','recovery-'||n||'@example.invalid',true,n in (1,9)
from generate_series(1,10) n;
insert into public.user_roles(user_id,org_id,role_id)
select pg_temp.fixture_id(v.n),pg_temp.fixture_id(100),r.id
from (values (2,'Music Director'),(3,'Production Director'),(4,'Admin Coordinator')) v(n,name)
join public.roles r on r.name=v.name;
insert into public.attendance_team_memberships(org_id,user_id,team,created_by)
select pg_temp.fixture_id(case when n=10 then 200 else 100 end),pg_temp.fixture_id(n),team,
  pg_temp.fixture_id(case when n=10 then 9 else 1 end)
from (values (5,'music'),(6,'tech'),(7,'music'),(7,'tech'),(10,'music')) v(n,team);
insert into public.events(id,org_id,title,event_date,start_time,created_by)
values (pg_temp.fixture_id(101),pg_temp.fixture_id(100),'Synthetic recovery event',current_date,'09:00',pg_temp.fixture_id(1)),
 (pg_temp.fixture_id(201),pg_temp.fixture_id(200),'Synthetic other church event',current_date,'09:00',pg_temp.fixture_id(9));
insert into public.event_assignments(org_id,event_id,user_id,role_id,status)
select pg_temp.fixture_id(case when n<=8 then 100 else 200 end),pg_temp.fixture_id(case when n<=8 then 101 else 201 end),
 pg_temp.fixture_id(n),(select id from public.roles where name='Music Director' limit 1),'confirmed'
from generate_series(1,10) n;
insert into public.event_attendance(org_id,event_id,user_id,status,is_assigned,record_source,review_status,notes)
select pg_temp.fixture_id(case when n<=8 then 100 else 200 end),pg_temp.fixture_id(case when n<=8 then 101 else 201 end),
 pg_temp.fixture_id(n),'present',true,'leader','verified','Synthetic recovery note'
from generate_series(1,10) n;
set local session_replication_role=origin;

-- Oversight is granted by an admin, not inferred from role titles.
select pg_temp.login(1);
set local role authenticated;
insert into public.attendance_leader_scopes(org_id,user_id,team,created_by)
select pg_temp.fixture_id(100),pg_temp.fixture_id(n),team,pg_temp.fixture_id(1)
from (values(2,'music'),(3,'music'),(3,'tech')) v(n,team);
select pg_temp.expect_denied($q$insert into public.attendance_leader_scopes(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(5),'music',pg_temp.fixture_id(1))$q$,'scope requires approved leadership');
reset role;

select pg_temp.login(1);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=8 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'admin reads own church only');
select pg_temp.assert_ok((select count(*)=8 from public.get_event_attendance_roster(pg_temp.fixture_id(101))),'admin roster');
insert into public.attendance_team_memberships(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(8),'music',pg_temp.fixture_id(1));
delete from public.attendance_team_memberships where user_id=pg_temp.fixture_id(8);
select pg_temp.expect_denied($q$insert into public.attendance_team_memberships(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(10),'music',pg_temp.fixture_id(1))$q$,'admin cannot assign foreign member');
reset role;

select pg_temp.login(2);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=3 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'music sees own record, music and dual members');
select pg_temp.assert_ok((select count(*)=2 from public.get_event_attendance_roster(pg_temp.fixture_id(101))),'music roster excludes production and unassigned');
select pg_temp.assert_ok((select count(*)=2 from public.get_all_members_attendance_stats(extract(year from current_date)::integer,extract(quarter from current_date)::integer) where user_id::text like 'fc250925-%'),'music stats scope');
with changed as (update public.event_attendance set notes='Synthetic allowed correction' where user_id=pg_temp.fixture_id(5) returning id)
select pg_temp.assert_ok((select count(*)=1 from changed),'music can edit music attendance');
with changed as (update public.event_attendance set notes='Forbidden synthetic correction' where user_id=pg_temp.fixture_id(6) returning id)
select pg_temp.assert_ok((select count(*)=0 from changed),'music cannot edit production attendance');
select pg_temp.expect_denied($q$insert into public.attendance_team_memberships(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(8),'music',pg_temp.fixture_id(2))$q$,'leader cannot grant team access');
reset role;

select pg_temp.login(3);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=4 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'Production Director sees own record, Music, Tech and dual members');
select pg_temp.assert_ok((select count(*)=3 from public.get_event_attendance_roster(pg_temp.fixture_id(101))),'Production Director roster covers both groups');
with changed as (update public.event_attendance set notes='Synthetic overall director correction' where user_id=pg_temp.fixture_id(5) returning id)
select pg_temp.assert_ok((select count(*)=1 from changed),'Production Director can edit Music attendance');
reset role;

select pg_temp.login(4);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'coordinator does not gain attendance scope');
select pg_temp.assert_ok((select count(*)=0 from public.get_event_attendance_roster(pg_temp.fixture_id(101))),'coordinator roster contains no other members');
reset role;

select pg_temp.login(5);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'volunteer reads own attendance only');
select pg_temp.expect_denied($q$insert into public.user_roles(user_id,org_id,role_id) select pg_temp.fixture_id(5),pg_temp.fixture_id(100),id from public.roles where name='Music Director'$q$,'volunteer cannot self-grant leadership');
reset role;

select pg_temp.login(8);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'unassigned volunteer retains own record');
reset role;

select pg_temp.login(9);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=2 from public.event_attendance where event_id in (pg_temp.fixture_id(101),pg_temp.fixture_id(201))),'other church admin cannot read first church');
reset role;

-- Revoke membership as the fixture church admin and check immediate loss of access.
select pg_temp.login(1);
set local role authenticated;
insert into public.attendance_leader_scopes(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(2),'tech',pg_temp.fixture_id(1));
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=3 from public.get_event_attendance_roster(pg_temp.fixture_id(101))),'Music Director can oversee both groups when configured');
select pg_temp.expect_denied($q$insert into public.attendance_leader_scopes(org_id,user_id,team,created_by) values(pg_temp.fixture_id(100),pg_temp.fixture_id(4),'music',pg_temp.fixture_id(2))$q$,'leader cannot grant oversight');
reset role;
select pg_temp.login(1);
set local role authenticated;
delete from public.attendance_leader_scopes where user_id=pg_temp.fixture_id(2) and team='tech';
delete from public.attendance_team_memberships where user_id=pg_temp.fixture_id(5);
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=0 from public.event_attendance where user_id=pg_temp.fixture_id(5)),'membership removal immediately revokes leader visibility');
reset role;
select 'PASS restored-schema roles, direct RLS, rosters, stats, edits, self-escalation, church isolation and revocation' as result;
