import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL fixture: no Supabase connection, pushes, or real users.
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [org, otherOrg, admin, music, production, coordinator, member, prodMember, dual, unassigned, foreignAdmin, foreignMember, event, foreignEvent, extraEvent, roleMusic, roleProduction, roleOther] =
  Array.from({ length: 18 }, (_, i) => id(i + 1));
const migration = await readFile(new URL('../supabase/migrations/20260925044402_enforce_attendance_team_access.sql', import.meta.url), 'utf8');
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const as = async user => db.exec(`reset role; set role authenticated; set test.jwt_role = 'authenticated'; set test.uid = '${user}';`);
const denied = promise => assert.rejects(promise, /Not authorized|row-level security|permission denied|not found/);
const own = "org_id = public.auth_org_id()";
const leader = `${own} and public.auth_is_org_leader()`;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('test.jwt_role',true)$$;
    grant usage on schema auth to authenticated, anon;
    create table profiles(id uuid primary key,org_id uuid,is_org_admin boolean default false,is_onboarded boolean default true,
      first_name text default 'Member',last_name text default 'Test',nickname text,avatar_url text,ministry_status text default 'active',gender text);
    create table roles(id uuid primary key,name text,is_leadership boolean);
    create table user_roles(user_id uuid,org_id uuid,role_id uuid);
    create table attendance_team_memberships(org_id uuid,user_id uuid,team text);
    create table attendance_leader_scopes(org_id uuid,user_id uuid,team text);
    create table events(id uuid primary key,org_id uuid,title text default 'Service',event_date date default '2025-01-05',start_time time default '09:00',event_type text default 'service',proposal_due_date timestamptz);
    create table setlists(event_id uuid,org_id uuid,submitted_at timestamptz,status text);
    create table user_availability(user_id uuid,org_id uuid,status text,leave_type text,unavailable_date date,start_date date,end_date date);
    create table event_assignments(id uuid default gen_random_uuid(),org_id uuid,user_id uuid,event_id uuid,role_id uuid,status text default 'confirmed',created_at timestamptz default now());
    create table organization_member_settings(org_id uuid,user_id uuid,include_in_attendance boolean);
    create table event_attendance(id uuid primary key default gen_random_uuid(),org_id uuid,event_id uuid,user_id uuid,
      status text default 'present',review_status text default 'verified',record_source text default 'leader',
      checked_in_at timestamptz,marked_at timestamptz,excused_reason text,notes text,is_assigned boolean default true,
      reviewed_by uuid,reviewed_at timestamptz,marked_by uuid,override_by uuid,override_at timestamptz,updated_at timestamptz,
      unique(event_id,user_id));
    create table discipline_records(id uuid primary key default gen_random_uuid(),org_id uuid,user_id uuid,source text,status text default 'open');
    create table attendance_offense_notifications(user_id uuid,org_id uuid,quarter_year integer,quarter_number integer,offense_level integer,
      unique(user_id,quarter_year,quarter_number,offense_level));
    create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,org_id uuid,type text,title text,body text,data jsonb);
    create table notification_activity(user_id uuid,org_id uuid,notification_type text,title text);
    create table activity_logs(id uuid default gen_random_uuid(),org_id uuid,target_user_id uuid,category text,entity_type text,action text);
    create function auth_org_id() returns uuid language sql stable security definer set search_path='' as $$select org_id from public.profiles where id=auth.uid()$$;
    create function auth_is_org_admin() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select is_org_admin from public.profiles where id=auth.uid()),false)$$;
    create function auth_is_org_leader() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id where u.user_id=auth.uid() and u.org_id=public.auth_org_id() and r.is_leadership)$$;
    create function get_quarter_start_date(y integer,q integer) returns date language sql immutable as $$select make_date(y,(q-1)*3+1,1)$$;
    create function get_quarter_end_date(y integer,q integer) returns date language sql immutable as $$select (make_date(y,(q-1)*3+1,1)+interval '3 months - 1 day')::date$$;
    create function get_quarter_from_date(d date) returns integer language sql immutable as $$select extract(quarter from d)::integer$$;
    create function get_user_offense_level_v2(l integer,a integer) returns integer language sql immutable as $$select least(greatest(l/3,a),4)$$;
    create function create_notification(u uuid,t text,heading text,b text,d jsonb) returns void language sql security definer set search_path='' as $$
      insert into public.notifications(user_id,org_id,type,title,body,data) select u,org_id,t,heading,b,d from public.profiles where id=u
    $$;
    insert into profiles(id,org_id,is_org_admin) values
      ('${admin}','${org}',true),('${music}','${org}',false),('${production}','${org}',false),('${coordinator}','${org}',false),
      ('${member}','${org}',false),('${prodMember}','${org}',false),('${dual}','${org}',false),('${unassigned}','${org}',false),
      ('${foreignAdmin}','${otherOrg}',true),('${foreignMember}','${otherOrg}',false);
    insert into roles values ('${roleMusic}','Music Director',true),('${roleProduction}','Production Director',true),('${roleOther}','Admin Coordinator',true);
    insert into user_roles values ('${music}','${org}','${roleMusic}'),('${production}','${org}','${roleProduction}'),('${coordinator}','${org}','${roleOther}');
    insert into attendance_team_memberships values ('${org}','${member}','music'),('${org}','${prodMember}','tech'),('${org}','${dual}','music'),('${org}','${dual}','tech'),('${otherOrg}','${foreignMember}','music');
    insert into attendance_leader_scopes values ('${org}','${music}','music'),('${org}','${production}','music'),('${org}','${production}','tech');
    insert into events(id,org_id) values ('${event}','${org}'),('${extraEvent}','${org}'),('${foreignEvent}','${otherOrg}');
    insert into event_assignments(org_id,user_id,event_id,role_id)
      select org_id,id,case when org_id='${org}' then '${event}'::uuid else '${foreignEvent}'::uuid end,'${roleMusic}' from profiles;
    insert into event_attendance(org_id,user_id,event_id) select org_id,user_id,event_id from event_assignments;
    insert into discipline_records(org_id,user_id,source) select org_id,id,'attendance' from profiles;
    insert into activity_logs(org_id,target_user_id,category,entity_type,action) select org_id,id,'attendance','event_attendance','attendance.marked' from profiles;
    insert into notification_activity(user_id,org_id,notification_type,title) select id,org_id,'attendance_qr_recorded','Attendance recorded: Late' from profiles;
    insert into notifications(user_id,org_id,type,title,body,data) values
      ('${music}','${org}','attendance_alert','Member name','Member offense details','{"offense_user_id":"${member}","offense_level":3}'),
      ('${music}','${org}','attendance_alert','Other team','Private details','{"offense_user_id":"${prodMember}"}'),
      ('${music}','${org}','attendance_alert','Bad UUID','Private details','{"offense_user_id":"invalid"}'),
      ('${music}','${org}','attendance_alert','Missing UUID','Private details','{}'),
      ('${music}','${org}','announcement','Team news','Ordinary notification','{}');
    grant select on profiles,roles,user_roles,attendance_team_memberships,events,event_assignments,organization_member_settings to authenticated;
    grant select,insert,update,delete on event_attendance,discipline_records,attendance_offense_notifications,notifications to authenticated;
    grant select on activity_logs,notification_activity to authenticated;
  `);
  // Load the actual private calculation and public wrapper definitions.
  const extract = (source, name) => {
    const start = source.indexOf(`create or replace function ${name}(`);
    assert.ok(start >= 0);
    return source.slice(start, source.indexOf('$$;', source.indexOf('as $$', start)) + 3);
  };
  const prior = await readFile(new URL('../supabase/migrations/20260816180330_add_dependability_review_workflow.sql',import.meta.url),'utf8');
  await db.exec(extract(prior,'private.get_finalized_member_attendance_stats'));
  const wrappers = await readFile(new URL('../supabase/migrations/20260504000400_add_member_accountability_rollups.sql',import.meta.url),'utf8');
  await db.exec(extract(wrappers,'public.get_my_accountability_summary'));
  await db.exec(extract(wrappers,'public.get_team_member_accountability_summaries'));
  // Reproduce the current permissive policies before applying the restriction.
  for (const table of ['event_attendance', 'discipline_records', 'attendance_offense_notifications']) {
    await db.exec(`alter table ${table} enable row level security;
      create policy leaders_read on ${table} for select to authenticated using (${leader});
      create policy leaders_insert on ${table} for insert to authenticated with check (${leader});`);
    if (table !== 'attendance_offense_notifications') await db.exec(`
      create policy leaders_update on ${table} for update to authenticated using (${leader}) with check (${leader});
      create policy members_read on ${table} for select to authenticated using (${own} and user_id=auth.uid());`);
  }
  await db.exec(`alter table notifications enable row level security;
    create policy recipient_read on notifications for select to authenticated using (${own} and user_id=auth.uid());
    alter table activity_logs enable row level security;
    create policy feed_read on activity_logs for select to authenticated using (${own});
    alter table notification_activity enable row level security;
    create policy delivery_read on notification_activity for select to authenticated using (${own});`);
  await as(music);
  assert.equal((await rows('select * from event_attendance')).length, 8, 'baseline reproduces broad leader access');
  await db.exec('reset role');
  await db.exec(migration);
  const visible = async table => (await rows(`select user_id from ${table}`)).map(r => r.user_id).sort();
  const stats = async () => (await rows('select * from get_all_members_attendance_stats(2025,1)'));
  const roster = async e => rows('select * from get_event_attendance_roster($1)', [e]);
  const history = u => rows('select * from get_member_attendance_history($1,20,2025,1)', [u]);
  const rollup = (o = org) => rows('select * from get_org_member_accountability_rollup($1,2025,1)',[o]);
  const resolve = (u, status = 'present', note = null, e = event) => rows('select resolve_attendance_review($1,$2,$3,$4)', [e,u,status,note]);
  for (const [viewer, team] of [[music,member],[production,prodMember]]) {
    const managed = viewer === music ? [member,dual] : [member,prodMember,dual];
    const readable = [viewer,...managed];
    await as(viewer);
    assert.deepEqual(await visible('event_attendance'), readable.sort());
    assert.deepEqual((await stats()).map(r=>r.user_id).sort(), managed.sort());
    assert.deepEqual((await roster(event)).map(r=>r.user_id).sort(), managed.sort());
    assert.deepEqual((await rollup()).map(r=>r.user_id).sort(), readable.sort());
    assert.deepEqual((await rows('select * from get_team_member_accountability_summaries(2025,1)')).map(r=>r.user_id).sort(),readable.sort());
    assert.equal((await history(team)).length, 1);
    assert.equal((await history(viewer)).length, 1, 'leaders keep their own history');
    await resolve(team);
    if (viewer === music) {
      await denied(history(prodMember));
      await denied(resolve(prodMember));
    } else {
      assert.equal((await history(member)).length,1,'Production Director can read Music history');
      await resolve(member);
    }
    await denied(history(unassigned));
    await denied(resolve(foreignMember,'present',null,foreignEvent));
    await denied(roster(foreignEvent));
    assert.deepEqual(await visible('discipline_records'), readable.sort());
  }
  await as(music);
  assert.equal((await stats())[0].present_count, 1, 'report counts remain intact');
  await db.exec('reset role');
  await db.query('insert into attendance_leader_scopes values($1,$2,$3)',[org,music,'tech']);
  await as(music);
  assert.equal((await history(prodMember)).length,1,'Music Director can oversee Tech when explicitly granted');
  await resolve(prodMember);
  await db.exec('reset role');
  await db.query('delete from attendance_leader_scopes where user_id=$1 and team=$2',[music,'tech']);
  await as(music); await denied(history(prodMember));
  await assert.rejects(resolve(member,'excused','  '), /explanation is required/);
  await assert.rejects(resolve(member,null), /Invalid attendance resolution/);
  await resolve(member,'excused','Approved schedule correction');
  assert.equal((await history(member))[0].notes,'Approved schedule correction');
  await denied(db.query('insert into event_attendance(org_id,event_id,user_id) values($1,$2,$3)',[org,extraEvent,prodMember]));
  await denied(db.query('insert into event_attendance(org_id,event_id,user_id) values($1,$2,$3)',[org,foreignEvent,member]));
  await denied(db.query('update event_attendance set user_id=$1 where user_id=$2',[unassigned,member]));
  assert.equal((await rows('update event_attendance set notes=\'tampered\' where user_id=$1 returning id',[prodMember])).length,0);
  await db.query('insert into event_attendance(org_id,event_id,user_id) values($1,$2,$3)',[org,extraEvent,member]);
  assert.equal((await rows('delete from event_attendance returning id')).length,0, 'does not grant deletion');
  await denied(rows('select private.can_manage_member_attendance($1,$2)',[admin,prodMember]));
  assert.equal((await rows('select * from notifications')).length,2, 'only current-team alert and ordinary news are visible');
  const alert=(await rows("select * from notifications where type='attendance_alert'"))[0];
  assert.equal(alert.title,'Attendance review');
  assert.equal(alert.data.offense_level,undefined);
  assert.equal((await rows('select * from activity_logs')).length,2);
  assert.deepEqual((await rows('select user_id from notification_activity')).map(r=>r.user_id).sort(),[member,dual].sort());

  await as(member);
  assert.deepEqual((await rollup()).map(r=>r.user_id),[member]);
  assert.deepEqual((await rows('select * from get_my_accountability_summary(2025,1)')).map(r=>r.user_id),[member]);
  await denied(rollup(otherOrg));
  assert.deepEqual(await visible('event_attendance'),[member,member]);
  assert.equal((await history(member)).length,1);
  await denied(history(prodMember)); await denied(resolve(member)); await denied(stats()); await denied(roster(event));
  await denied(db.query('insert into event_attendance(org_id,event_id,user_id) values($1,$2,$3)',[org,foreignEvent,member]));
  assert.equal((await rows('update event_attendance set notes=\'self edit\' returning id')).length,0);
  await as(coordinator);
  assert.equal((await stats()).length,0); assert.equal((await roster(event)).length,0);
  assert.deepEqual(await visible('event_attendance'),[coordinator]);
  assert.equal((await rows('select * from activity_logs')).length,0);
  await db.exec('reset role');
  await db.query('insert into attendance_leader_scopes values($1,$2,$3)',[org,coordinator,'tech']);
  await as(coordinator);
  assert.deepEqual((await roster(event)).map(r=>r.user_id).sort(),[prodMember,dual].sort(),'any approved leader can receive explicit oversight');
  await denied(history(member));
  await db.exec('reset role');
  await db.query('delete from attendance_leader_scopes where user_id=$1',[coordinator]);
  await db.query('delete from attendance_leader_scopes where user_id=$1',[production]);
  await as(production);
  assert.deepEqual(await visible('event_attendance'),[production],'director title alone grants no member access');
  await denied(history(prodMember));
  await db.exec('reset role');
  await db.query('insert into attendance_leader_scopes values($1,$2,$3),($1,$2,$4)',[org,production,'music','tech']);
  await as(admin);
  assert.equal((await rollup()).length,8);
  assert.equal((await stats()).length,8);
  assert.equal((await history(unassigned)).length,1);
  await resolve(unassigned);
  assert.equal((await visible('discipline_records')).length,8);
  await denied(history(foreignMember));
  assert.equal((await rows('delete from event_attendance returning id')).length,0,'admins were not given deletion');
  await as(foreignAdmin);
  await denied(rollup());
  assert.deepEqual(await visible('event_attendance'),[foreignAdmin,foreignMember].sort());
  await denied(history(member)); await denied(resolve(member)); await denied(roster(event));
  await db.exec('reset role; set role anon');
  await denied(history(member)); await denied(rows('select auth_can_view_member_attendance($1)',[member]));
  await denied(rollup());
  await db.exec("reset role; set role service_role; set test.jwt_role='service_role'; set test.uid='';");
  assert.equal((await rollup()).length,8,'trusted reminder job can calculate church totals');
  assert.equal((await rollup(otherOrg)).length,2);

  // The real trigger function runs against a local notification sink only.
  await db.exec(`reset role; create trigger attendance_alert after insert or update on event_attendance for each row execute function on_attendance_recorded();`);
  await as(music);
  await resolve(member,'absent');
  await db.exec('reset role');
  const generated=await rows("select * from notifications where type='attendance_alert' and data->>'offense_user_id'=$1",[member]);
  assert.deepEqual(generated.slice(1).map(r=>r.user_id).sort(),[admin,music,production].sort(),'admin, Music Director and overall Production Director notified');
  assert.ok(generated.every(r=>r.body==='Attendance records need review. Open ServeSync to view records you can access.' && r.data.offense_level===undefined));
  const count=generated.length;
  await as(music); await resolve(member,'absent');
  await db.exec('reset role');
  assert.equal((await rows("select * from notifications where type='attendance_alert' and data->>'offense_user_id'=$1",[member])).length,count,'repeated offense does not duplicate alerts');
  await db.query("update event_attendance set status='absent',review_status='needs_review' where user_id=$1",[prodMember]);
  assert.equal((await rows("select * from notifications where data->>'offense_user_id'=$1 and user_id=$2",[prodMember,production])).length,0,'unverified absence sends no alert');
  assert.equal((await rows("insert into notifications(user_id,org_id,type,title,body,data) values($1,$2,'attendance_alert','Private member','Named details',$3) returning id",[music,org,{offense_user_id:prodMember}])).length,0,'legacy producer cannot notify Music Director about Tech member');
  assert.equal((await rows("insert into notifications(user_id,org_id,type,title,body,data) values($1,$2,'leadership_member_action_reminder','Details','Private totals','{}') returning id",[music,org])).length,0,'legacy digest cannot notify non-admin');
  const digest=(await rows("insert into notifications(user_id,org_id,type,title,body,data) values($1,$2,'leadership_member_action_reminder','Details','Private totals',$3) returning *",[admin,org,{member_ids:[member],reminder_key:'fixture-day'}]))[0];
  assert.equal(digest.body,'Member records need review. Open ServeSync to view records you can access.');
  assert.deepEqual(digest.data,{url:'/leadership/team',reminder_key:'fixture-day'});
  await db.query('delete from attendance_team_memberships where user_id=$1',[member]);
  await as(music);
  assert.equal((await rows("select * from notifications where type='attendance_alert'")).length,0,'old alerts disappear after membership removal');
  await denied(history(member));
  await db.exec('reset role');
  await db.query('delete from user_roles where user_id=$1',[production]);
  await as(production); await denied(history(prodMember));
  console.log('PASS attendance team access: direct rows, five RPCs plus summary wrappers, dual/unassigned members, two churches, correction boundaries, alerts/digests, activity feed, revoked access, anonymous denial, trusted-job access');
} finally { await db.close(); }
