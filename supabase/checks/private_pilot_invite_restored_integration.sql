-- LOCAL RESTORE ONLY. Run inside isolated rehearsal after invitation migration.
do $$ begin
  if current_setting('servesync.isolated_rehearsal', true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off' then raise exception 'Unsafe invite rehearsal'; end if;
end $$;
set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at)
values (pg_temp.fixture_id(11),'pilot-synthetic@example.invalid',now());
insert into public.profiles(id,email,first_name,last_name)
values (pg_temp.fixture_id(11),'pilot-synthetic@example.invalid','Pilot','Synthetic');
set local session_replication_role=origin;

select pg_temp.login(11);
set local role authenticated;
select pg_temp.expect_denied($q$select public.create_organization_for_approved_pilot_admin('Bypass Test','bypass-test-fc250925',null)$q$, 'Unrestricted creator is not callable');
do $$ begin
  begin
    perform public.create_organization_for_current_user('Denied Test','denied-test-fc250925',null);
    raise exception 'FAIL uninvited church created';
  exception when raise_exception then
    if sqlerrm not like '%private pilot invitation is required%' then raise; end if;
  end;
end $$;
reset role;
insert into private.church_pilot_invites(email,expires_at)
values ('pilot-synthetic@example.invalid',now()+interval '7 days');
set local role authenticated;
select public.confirm_private_pilot_adult();
select public.accept_private_pilot_terms('2026-09-25');
select public.create_organization_for_current_user('Approved Test','approved-test-fc250925',null);
reset role;
select pg_temp.assert_ok((select count(*)=1 from public.organizations where slug='approved-test-fc250925' and billing_status='exempt' and subscription_status='active' and is_billing_exempt and is_private_pilot), 'Pilot church is free and active');
select pg_temp.assert_ok((select count(*)=1 from private.church_pilot_invites where email='pilot-synthetic@example.invalid' and claimed_by=pg_temp.fixture_id(11)), 'Invite claimed once');
select pg_temp.assert_ok((select count(*)=1 from private.pilot_churches pc join public.organizations o on o.id=pc.org_id where o.slug='approved-test-fc250925'), 'New church marked adult pilot');
select pg_temp.login(11);
set local role authenticated;
do $$ begin
  begin
    update public.organizations set is_billing_exempt=false where slug='approved-test-fc250925';
    raise exception 'FAIL pilot admin changed billing';
  exception when raise_exception then
    if sqlerrm not like '%Pilot billing is managed%' then raise; end if;
  end;
end $$;
reset role;
set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at)
values (pg_temp.fixture_id(12),'pilot-adult@example.invalid',now()),
       (pg_temp.fixture_id(13),'pilot-minor@example.invalid',now());
insert into public.profiles(id,email,first_name,last_name,birthday)
values (pg_temp.fixture_id(12),'pilot-adult@example.invalid','Adult','Synthetic',null),
       (pg_temp.fixture_id(13),'pilot-minor@example.invalid','Minor','Synthetic',(current_date - interval '15 years')::date);
insert into public.organization_invitations(id,org_id,email,role_ids,is_admin,token,expires_at)
select pg_temp.fixture_id(351),id,'pilot-adult@example.invalid',array[]::uuid[],false,'synthetic-adult-token',now()+interval '7 days'
from public.organizations where slug='approved-test-fc250925';
insert into public.organization_invitations(id,org_id,email,role_ids,is_admin,token,expires_at)
select pg_temp.fixture_id(352),id,'pilot-minor@example.invalid',array[]::uuid[],false,'synthetic-minor-token',now()+interval '7 days'
from public.organizations where slug='approved-test-fc250925';
set local session_replication_role=origin;
select pg_temp.login(12);
set local role authenticated;
do $$ begin
  begin
    perform public.accept_organization_invitation('synthetic-adult-token');
    raise exception 'FAIL adult joined without confirmation';
  exception when raise_exception then
    if sqlerrm not like '%private pilot is for adults only%' then raise; end if;
  end;
end $$;
select pg_temp.assert_ok(public.is_private_pilot_invitation('synthetic-adult-token'), 'Adult invite identified as pilot');
select public.confirm_private_pilot_adult();
select public.accept_private_pilot_terms('2026-09-25');
select public.accept_organization_invitation('synthetic-adult-token');
reset role;
select pg_temp.assert_ok((select org_id is not null from public.profiles where id=pg_temp.fixture_id(12)), 'Confirmed adult joined pilot');
select pg_temp.login(13);
set local role authenticated;
do $$ begin
  begin
    perform public.confirm_private_pilot_adult();
    raise exception 'FAIL recorded minor self-confirmed adult';
  exception when raise_exception then
    if sqlerrm not like '%private pilot is for adults only%' then raise; end if;
  end;
end $$;
reset role;
select pg_temp.assert_ok((select org_id is null from public.profiles where id=pg_temp.fixture_id(13)), 'Recorded minor remains outside pilot');
select 'PASS invited church creation and uninvited rejection' as result;
