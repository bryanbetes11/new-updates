// Isolated PostgreSQL: no live members, notification delivery or external hooks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260912064817_event_reschedule_reconfirmation.sql', import.meta.url), 'utf8');
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table profiles(id uuid primary key, org_id uuid);
    create table events(id uuid primary key, org_id uuid, created_by uuid, title text, event_date date, start_time time, end_time time, event_type text);
    create table event_assignments(event_id uuid, org_id uuid, user_id uuid, status text, confirmed_at timestamptz, decline_reason text, updated_at timestamptz);
    create table notification_rules(org_id uuid, type text, label text, category text default 'events', description text,
      enabled boolean default true, required boolean default true, in_app_enabled boolean default true,
      push_enabled boolean default true, priority text default 'high', template_title text, template_body text, unique(org_id,type));
    create table notification_preferences(user_id uuid, org_id uuid, muted_types text[], in_app_enabled boolean, push_enabled boolean);
    create table notification_system_settings(org_id uuid, push_delivery_enabled boolean);
    create table notifications(id uuid default gen_random_uuid() primary key, user_id uuid, org_id uuid, type text, title text, body text, data jsonb,
      category text, priority text, required boolean, delivery_channels jsonb, scheduled_for timestamptz, push_status text, dedupe_key text, push_attempted_at timestamptz);
    create schema vault; create schema net;
    create table vault.decrypted_secrets(name text, decrypted_secret text);
    insert into vault.decrypted_secrets values ('send_push_webhook_secret','isolated-test-only');
    create table public.push_requests(payload jsonb);
    create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint language plpgsql as $$
      begin insert into public.push_requests values (body); return 1; end;
    $$;
    create function public.create_notification(uuid,text,text,text,jsonb) returns void language sql as $$
      insert into public.notifications(user_id,type,title,body,data) values ($1,$2,$3,$4,$5);
    $$;
  `);
  await db.exec(migration);
  await db.exec(`create table organizations(id uuid primary key);
    insert into organizations values ('00000000-0000-0000-0000-000000000001');
    alter table notification_rules add column target_roles text[], add column reminder_offsets integer[];`);
  const catalogMigration = await readFile(new URL('../supabase/migrations/20260803161112_notification_control_center.sql', import.meta.url), 'utf8');
  const catalogStart = catalogMigration.indexOf('create or replace function private.default_notification_rules()');
  await db.exec(catalogMigration.slice(catalogStart, catalogMigration.indexOf('$$;', catalogStart) + 3));
  const separateRuleMigration = await readFile(new URL('../supabase/migrations/20260912071930_separate_event_rescheduled_notifications.sql', import.meta.url), 'utf8');
  await db.exec(separateRuleMigration);
  await db.exec(separateRuleMigration);
  assert.equal((await db.query("select * from notification_rules where type='event_rescheduled'")).rows.length, 1, 'separate rule seeded once');
  assert.equal((await db.query("select * from private.default_notification_rules() where type='event_rescheduled'")).rows.length, 1, 'future organizations get new rule');
  await db.exec(await readFile(new URL('../supabase/migrations/20260912070351_event_reschedule_history.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('./fixtures/rescheduleNotificationPipeline.sql', import.meta.url), 'utf8'));
  await db.exec(`create trigger configure before insert on notifications for each row execute function private.configure_notification_insert();
    create trigger send_push after insert on notifications for each row execute function public.trigger_push_notification();`);
  await db.exec(`create trigger events_create_update_notifications after update of title,event_date,start_time,end_time,event_type on events for each row execute function private.notify_event_change();
    insert into profiles values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002');
    insert into events values ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','Revamp','2026-10-01','10:00','12:00','Revamp Session');
    insert into event_assignments select e.id,p.org_id,p.id,'confirmed',now(),null,now() from events e cross join profiles p;
    insert into event_assignments select e.id,e.org_id,e.created_by,'declined',null,'Old schedule conflict',now() from events e;
  `);
  const rows = async sql => (await db.query(sql)).rows;
  await db.exec("update events set event_date=event_date");
  assert.equal((await rows('select * from notifications')).length, 0, 'no-op does not notify');
  await db.exec("update events set title='Revamp Session'");
  assert.ok((await rows('select * from notifications')).every(n => n.type === 'event_updated'), 'ordinary edits keep existing type');
  await db.exec("update notification_rules set enabled=false where type='event_updated'");
  assert.equal((await rows('select rescheduled_from_date from events'))[0].rescheduled_from_date, null, 'ordinary edit does not create reschedule history');
  assert.equal((await rows("select * from event_assignments where status='confirmed'")).length, 3, 'title edit preserves confirmations');
  await db.exec("delete from notifications; delete from push_requests; update events set event_date='2026-10-02'");
  const notices = await rows('select * from notifications');
  assert.equal((await rows('select rescheduled_from_date::text as date from events'))[0].date, '2026-10-01', 'previous date is persisted');
  assert.equal(notices.length, 2, 'one per same-org member, including organizer, regardless of role count');
  assert.ok(notices.every(n => n.type === 'event_rescheduled'), 'reschedules use independent rule even when ordinary updates are disabled');
  assert.ok(notices.every(n => n.delivery_channels.in_app && n.delivery_channels.push && n.push_status === 'dispatching'), 'real configuration enables inbox and push');
  const requests = await rows('select payload from push_requests');
  assert.equal(requests.length, 2, 'real dispatch function hands one payload per member to HTTP adapter');
  assert.ok(requests.every(({payload}) => payload.title.includes('rescheduled') && payload.body.includes('confirm your availability again') && payload.data.url === '/events/00000000-0000-0000-0000-000000000021'), 'push carries reschedule copy and correct event link');
  assert.ok(notices.every(n => n.data.requires_reconfirmation && n.body.includes('October 1, 2026') && n.body.includes('October 2, 2026')));
  assert.equal((await rows("select * from event_assignments where org_id='00000000-0000-0000-0000-000000000001' and status='pending' and confirmed_at is null and decline_reason is null")).length, 3, 'confirmed and declined reset with old response metadata cleared');
  assert.equal((await rows("select status from event_assignments where org_id='00000000-0000-0000-0000-000000000002'"))[0].status, 'confirmed', 'other org untouched');
  await db.exec("delete from notifications; update events set start_time='11:00'");
  assert.equal((await rows('select * from notifications')).length, 2, 'time-only move notifies');
  assert.equal((await rows('select rescheduled_from_start_time::text as time from events'))[0].time, '10:00:00', 'time-only move records previous start');
  assert.equal((await rows('select rescheduled_from_date::text as date from events'))[0].date, '2026-10-02', 'subsequent move uses immediately previous schedule');
  await db.exec("update events set rescheduled_from_date='2000-01-01'");
  assert.equal((await rows('select rescheduled_from_date::text as date from events'))[0].date, '2026-10-02', 'history cannot be overwritten without a schedule change');
  await db.exec("delete from notifications; update events set end_time='13:00'");
  assert.equal((await rows('select * from notifications')).length, 2, 'end-only move notifies');
  await db.exec("delete from notifications; delete from push_requests; insert into notification_preferences values ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','{}',true,false); update events set end_time='14:00'");
  assert.equal((await rows('select * from notifications')).length, 2, 'push opt-out retains inbox notification');
  assert.equal((await rows('select * from push_requests')).length, 1, 'push opt-out is respected');
  await db.exec("begin; delete from notifications; delete from push_requests; update notification_rules set enabled=false where type='event_rescheduled'; update events set end_time='15:00'");
  assert.equal((await rows('select * from notifications')).length, 0, 'separate reschedule switch disables reschedule notifications');
  assert.equal((await rows('select * from push_requests')).length, 0, 'disabled reschedule switch prevents push dispatch');
  await db.exec('rollback');
  await db.exec('alter table events add column proposal_due_date timestamptz;');
  await db.exec(await readFile(new URL('../supabase/migrations/20260912070845_event_setlist_requirement.sql', import.meta.url), 'utf8'));
  assert.equal((await rows('select setlist_required from events'))[0].setlist_required, true, 'existing events retain setlist workflow');
  await db.exec("delete from notifications; update events set setlist_required=false, proposal_due_date=now()");
  assert.equal((await rows('select proposal_due_date from events'))[0].proposal_due_date, null, 'disabling setlist clears deadline');
  assert.equal((await rows('select * from notifications')).length, 0, 'requirement toggle does not send reschedule notifications');
  await db.exec("update events set setlist_required=true, proposal_due_date='2026-10-01'");
  assert.ok((await rows('select proposal_due_date from events'))[0].proposal_due_date, 'reenabling accepts restored deadline');
  await db.exec("insert into events(id,title,event_date,setlist_required,proposal_due_date) values ('00000000-0000-0000-0000-000000000099','No songs','2026-10-04',false,now())");
  assert.equal((await rows("select proposal_due_date from events where id='00000000-0000-0000-0000-000000000099'"))[0].proposal_due_date, null, 'creation without setlist has no deadline');
  await db.exec("delete from events where id='00000000-0000-0000-0000-000000000099'");
  await db.exec("delete from notifications; update event_assignments set status='confirmed'; alter table notifications add constraint fail_insert check (false) not valid;");
  await assert.rejects(db.exec("update events set event_date='2026-10-03'"), /fail_insert/);
  assert.equal((await rows("select event_date::text as date from events"))[0].date, '2026-10-02', 'notification failure rolls back schedule');
  assert.equal((await rows('select rescheduled_from_end_time::text as time from events'))[0].time, '13:00:00', 'notification failure rolls back history');
  assert.equal((await rows("select * from event_assignments where status='pending'")).length, 0, 'notification failure rolls back responses');
  const access = await rows("select has_function_privilege('authenticated','private.notify_event_change()','execute') as allowed");
  assert.equal(access[0].allowed, false, 'private definer cannot be called directly');
  await db.exec('alter table notifications drop constraint fail_insert');
  await db.exec(await readFile(new URL('./fixtures/assignmentResponseProducer.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into notification_rules(org_id,type,enabled,template_title) values ('00000000-0000-0000-0000-000000000001','role_changed',false,'Custom role title');
    update notification_preferences set muted_types=array['role_changed'];`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260912072338_granular_notification_controls.sql', import.meta.url), 'utf8'));
  assert.equal((await rows("select enabled from notification_rules where type='role_added'"))[0].enabled,false,'existing parent delivery setting carried over');
  assert.equal((await rows("select template_title from notification_rules where type='role_removed'"))[0].template_title,'Custom role title','custom copy preserved');
  assert.ok((await rows('select muted_types from notification_preferences'))[0].muted_types.includes('role_added'),'member mute carried over');
  await db.exec(await readFile(new URL('../supabase/migrations/20260912072525_enable_notification_event_wording.sql', import.meta.url), 'utf8'));
  const cases = [
    ['assignment',{response_kind:'attendance'},'event_invitation'],
    ['assignment_confirmation_reminder',{response_kind:'attendance'},'event_invitation_reminder'],
    ...['confirmed','declined'].flatMap(status => ['attendance','assignment'].map(response_kind => ['assignment_response',{status,response_kind},response_kind==='attendance' ? `event_invitation_${status==='confirmed'?'accepted':'declined'}` : `assignment_${status}`])),
    ['leave_response',{status:'approved'},'leave_approved'],['leave_response',{status:'rejected'},'leave_declined'],
    ['role_changed',{action:'added'},'role_added'],['role_changed',{action:'removed'},'role_removed'],
    ['mention',{announcement_id:'a'},'announcement_mention'],['mention',{announcement_id:'a',comment_id:'c'},'announcement_comment_mention'],
    ['mention',{conversation_id:'c'},'chat_mention'],['mention',{setlist_id:'s'},'setlist_revision_mention'],
    ['featured_event_created',{event_type:'Revamp Session'},'revamp_event_created'],['featured_event_created',{event_type:'Youth Recharge'},'youth_event_created'],
    ...Object.entries({due_soon:'observation_due_tomorrow',due_today:'observation_due_today',overdue:'observation_overdue'}).map(([reminder_kind,type]) => ['post_event_observation_due',{reminder_kind},type]),
    ...Object.entries({resolved:'observation_resolved',monitoring:'observation_monitoring',open:'observation_open'}).map(([observation_status,type]) => ['post_event_observation_status_changed',{observation_status},type]),
  ];
  for (const [source,data,expected] of cases) {
    const result = (await db.query('select private.classify_notification($1,$2) as type',[source,JSON.stringify(data)])).rows[0];
    assert.equal(result.type,expected,source+' routes by context');
    assert.equal((await db.query('select count(*)::int as n from notification_rules where type=$1',[expected])).rows[0].n,1,'independent setting seeded');
  }
  assert.equal((await rows("select private.classify_notification('mention','{}') as type"))[0].type,'mention','unknown context retains fallback');
  assert.ok((await rows("select pg_get_functiondef('public.on_assignment_status_changed()'::regprocedure) as definition"))[0].definition.includes("'status', new.status"),'producer provides status metadata');
  await db.exec("delete from notifications; delete from push_requests; update notification_rules set enabled=false where type='leave_approved';");
  await db.query('select public.create_notification($1,$2,$3,$4,$5)',['00000000-0000-0000-0000-000000000011','leave_response','Approved','Leave approved',JSON.stringify({status:'approved'})]);
  assert.equal((await rows('select * from notifications')).length,0,'approved switch blocks only approvals');
  await db.query('select public.create_notification($1,$2,$3,$4,$5)',['00000000-0000-0000-0000-000000000011','leave_response','Declined','Leave declined',JSON.stringify({status:'rejected'})]);
  assert.equal((await rows('select type from notifications'))[0].type,'leave_declined','declines still delivered independently');
  await db.exec(`update notification_rules set event_type_templates='{"Revamp Session":{"title":"Changed [Event]","body":"New date: [date]"}}' where type='event_rescheduled'; delete from notifications;`);
  await db.query('select public.create_notification($1,$2,$3,$4,$5)',['00000000-0000-0000-0000-000000000011','event_rescheduled','Default','Default',JSON.stringify({event_id:'00000000-0000-0000-0000-000000000021'})]);
  const custom = (await rows('select title,body from notifications'))[0];
  assert.ok(custom.title.startsWith('Changed Revamp') && custom.body.includes('October'),'event-type custom text rendered');
  await db.exec("insert into organizations values ('00000000-0000-0000-0000-000000000003')");
  assert.equal((await rows("select count(*)::int as n from notification_rules where org_id='00000000-0000-0000-0000-000000000003'"))[0].n,22,'future organization gets separate rules');
  console.log('Granular notification checks passed: 22 independent types, rule switches, metadata, fallback and per-event-type templates.');
  console.log('Event reschedule database checks passed: resets, deduplication, org boundary, no-op, time changes, atomic rollback, private privileges.');
} finally {
  await db.close();
}
