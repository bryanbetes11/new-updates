// Isolated PostgreSQL (PGlite): no network, real users, push hooks, or live cron.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260909055525_event_type_wording_and_out_today.sql', import.meta.url), 'utf8');
try {
  await db.exec(`
    create schema private;
    create schema cron;
    create role anon;
    create role authenticated;
    create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';
    create table organizations(id uuid primary key);
    create table profiles(id uuid primary key, org_id uuid, ministry_status text, is_onboarded boolean);
    create table events(id uuid primary key, org_id uuid, title text, event_type text,
      event_date date, start_time time, lifecycle_override text);
    create table event_assignments(org_id uuid, event_id uuid, user_id uuid, status text);
    create table user_availability(org_id uuid, user_id uuid, status text, request_type text,
      leave_type text, unavailable_date date, start_date date, end_date date);
    create table notification_rules(org_id uuid, type text, label text, category text default 'system',
      description text, target_roles text[], enabled boolean default true, required boolean default false,
      in_app_enabled boolean default true, push_enabled boolean default true, priority text default 'normal',
      template_title text, template_body text, unique(org_id,type));
    create table notification_preferences(user_id uuid, org_id uuid, muted_types text[],
      in_app_enabled boolean, push_enabled boolean);
    create table notification_system_settings(org_id uuid, default_timezone text, push_delivery_enabled boolean);
    create table notifications(user_id uuid, org_id uuid, type text, title text, body text, data jsonb,
      category text, priority text, required boolean, delivery_channels jsonb, scheduled_for timestamptz,
      push_status text, dedupe_key text);
    create unique index on notifications(user_id,dedupe_key) where dedupe_key is not null;
  `);
  await db.exec(migration);
  await db.exec('create trigger configure before insert on notifications for each row execute function private.configure_notification_insert();');
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const alice = '00000000-0000-4000-8000-000000000011';
  const bob = '00000000-0000-4000-8000-000000000012';
  const inactive = '00000000-0000-4000-8000-000000000013';
  const other = '00000000-0000-4000-8000-000000000021';
  const event = '00000000-0000-4000-8000-000000000031';
  await db.exec(`
    insert into organizations values ('${orgA}'),('${orgB}');
    insert into profiles values ('${alice}','${orgA}','active',true),('${bob}','${orgA}','active',true),
      ('${inactive}','${orgA}','inactive',true),('${other}','${orgB}','active',true);
    insert into notification_system_settings values ('${orgA}','Asia/Manila',true),('${orgB}','UTC',true);
    insert into events values ('${event}','${orgA}','Team Reset','Revamp Session','2026-09-09','11:30',null);
    insert into event_assignments values ('${orgA}','${event}','${alice}','confirmed');
    insert into user_availability values
      ('${orgA}','${alice}','approved','leave','range',null,'2026-09-08','2026-09-10'),
      ('${orgA}','${alice}','approved','leave','single','2026-09-09',null,null),
      ('${orgA}','${bob}','pending','leave','single','2026-09-09',null,null),
      ('${orgA}','${bob}','approved','swap','single','2026-09-09',null,null),
      ('${orgA}','${inactive}','approved','leave','single','2026-09-09',null,null),
      ('${orgB}','${other}','approved','leave','single','2026-09-09',null,null);
  `);
  const rows = async sql => (await db.query(sql)).rows;
  assert.deepEqual(await rows("select * from private.out_today_digest('2026-09-08T21:59:00Z')"), [], 'no digest before church 6 AM');
  const digest = await rows("select * from private.out_today_digest('2026-09-08T22:05:00Z')");
  assert.equal(digest.length, 1, 'only the church with events qualifies');
  assert.equal(Number(digest[0].member_count), 1, 'distinct approved active leave, not swaps/pending');
  assert.equal(Number(digest[0].assigned_count), 1);
  assert.equal(digest[0].event_names, 'Revamp Session · Team Reset');
  assert.deepEqual(await rows("select * from private.out_today_digest('2026-09-11T00:00:00Z')"), [], 'no event or leave day');
  for (const date of ['2026-09-08', '2026-09-10']) {
    assert.equal((await rows(`select private.is_out_on_date('approved','leave','range',null,'2026-09-08','2026-09-10','${date}') as ok`))[0].ok, true);
  }
  // Test actual scheduler insertion using a deterministic clock source, only in this isolated DB.
  await db.exec(`alter function private.out_today_digest(timestamptz) rename to out_today_digest_at;
    create function private.out_today_digest() returns table(org_id uuid,local_date date,member_count bigint,event_names text,assigned_count bigint)
    language sql as $$ select * from private.out_today_digest_at('2026-09-08T22:05:00Z'); $$;`);
  assert.equal((await rows('select private.create_out_today_notifications() as n'))[0].n, 2, 'all active same-org members, no leadership requirement');
  assert.equal((await rows('select private.create_out_today_notifications() as n'))[0].n, 0, 'second run does not duplicate');
  const sent = await rows("select * from notifications where type='out_today'");
  assert.deepEqual(sent.map(n => n.user_id).sort(), [alice, bob].sort());
  assert.equal(sent[0].data.url, '/unavailable-members?date=2026-09-09');
  assert.equal('reason' in sent[0].data, false);
  await db.exec("delete from notifications where type='out_today'");
  assert.equal((await rows('select private.create_out_today_notifications() as n'))[0].n, 0, 'clearing inbox does not resend the daily digest');
  await db.exec(`insert into notification_rules(org_id,type,label,template_title,template_body,event_type_templates)
    values ('${orgA}','assignment','Assignment','Default','[event] on [event date]',
      '{"Revamp Session":{"title":"Let us reset","body":"Join [Event type]: [event title] on [event date]."},"Youth Recharge":{"title":"Youth time"}}');`);
  const insert = async (user = alice, data = { event_id: event }) => {
    await db.query("insert into notifications(user_id,type,title,body,data) values ($1,'assignment','Producer title','Producer body',$2)", [user, data]);
    return (await rows("select * from notifications where type='assignment'" )).at(-1);
  };
  const custom = await insert();
  assert.equal(custom.title, 'Let us reset');
  assert.equal(custom.body, 'Join Revamp Session: Team Reset on September 09, 2026.');
  await db.exec(`update notification_rules set event_type_templates='{}' where type='assignment';`);
  assert.equal((await insert()).title, 'Default', 'reset restores the default');
  await db.exec(`update notification_rules set template_body='Hello [missing]' where type='assignment';`);
  assert.equal((await insert()).body, 'Producer body · Revamp Session', 'unresolved values retain producer copy and add event type');
  const crossOrg = await insert(other);
  assert.equal(crossOrg.data.event_title, undefined, 'never resolves another church event');
  assert.equal((await insert(alice, { event_id: 'malformed' })).body, 'Producer body', 'bad event IDs do not break notification inserts');
  await db.exec(`insert into notification_preferences values ('${bob}','${orgA}',array['assignment'],true,true);`);
  const countBefore = (await rows('select count(*) as n from notifications'))[0].n;
  await insert(bob);
  assert.equal((await rows('select count(*) as n from notifications'))[0].n, countBefore, 'muted non-required alerts stay muted');
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await rows(`select has_table_privilege('${role}', 'private.out_today_deliveries', 'select') as ok`))[0].ok, false);
    assert.equal((await rows(`select has_function_privilege('${role}', 'private.create_out_today_notifications()', 'execute') as ok`))[0].ok, false);
    assert.equal((await rows(`select has_function_privilege('${role}', 'private.out_today_digest_at(timestamptz)', 'execute') as ok`))[0].ok, false);
  }
  console.log('PASS notification database: migration, event copy, fallbacks, tenant isolation, all-member audience, timezone, date ranges, dedupe, preferences and private permissions');
  // Admin test broadcast: synthesize auth helpers, never use a live identity.
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    alter table profiles add column is_org_admin boolean default false;
    create table roles(id uuid primary key, name text);
    create table user_roles(user_id uuid, org_id uuid, role_id uuid);
    create function public.auth_is_org_admin() returns boolean language sql as $$ select is_org_admin from public.profiles where id=auth.uid() $$;
    create function public.is_platform_owner() returns boolean language sql as $$ select false $$;
    create function public.has_org_capability(text) returns boolean language sql as $$ select false $$;
    update profiles set is_org_admin=true where id in ('${alice}','${inactive}','${other}');
    insert into roles values ('${event}','Admin');
    insert into user_roles values ('${bob}','${orgA}','${event}'),('${alice}','${orgA}','${event}');
    select set_config('test.uid','${alice}',false);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260909061440_notification_template_tests_all_admins.sql', import.meta.url), 'utf8'));
  const sendTest = () => rows("select public.send_notification_template_test_to_admins('event_created','New event test','Revamp Session · Team Reset on September 9') as result");
  let broadcast = (await sendTest())[0].result;
  assert.deepEqual(broadcast, { admin_count: 2, queued_count: 2, push_queued_count: 2, skipped_count: 0 });
  assert.deepEqual((await rows("select user_id from notifications where type='push_test'")).map(n => n.user_id).sort(), [alice,bob].sort(), 'org admin + Admin role, deduped, same church and active only');
  await db.exec("update notification_rules set enabled=false where type='push_test'");
  broadcast = (await sendTest())[0].result;
  assert.equal(broadcast.queued_count, 0, 'disabled rule must report zero rather than false success');
  assert.equal(broadcast.skipped_count, 2);
  await assert.rejects(() => rows("select public.send_notification_template_test_to_admins('event_created','','body')"), /both a title and message/);
  await assert.rejects(() => rows("select public.send_notification_template_test_to_admins('event_created','Title','[unknown]')"), /unsupported placeholders/);
  await db.exec(`select set_config('test.uid','${bob}',false)`);
  await assert.rejects(sendTest, /permission/);
  await db.exec("select set_config('test.uid','',false)");
  await assert.rejects(sendTest, /permission/);
  assert.equal((await rows("select has_function_privilege('anon','public.send_notification_template_test_to_admins(text,text,text)','execute') as ok"))[0].ok,false);
  assert.equal((await rows("select has_function_privilege('authenticated','private.send_notification_template_test_to_admins(text,text,text)','execute') as ok"))[0].ok,false);
  console.log('PASS admin test broadcast: all admins, tenant isolation, authorization, disabled delivery, validation and privileges');
} catch (error) {
  console.error('FAIL notification database:', error.message, error.detail || '', error.where || '');
  process.exitCode = 1;
} finally {
  await db.close();
}
