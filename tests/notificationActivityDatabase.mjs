import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const org = '00000000-0000-4000-8000-000000000001', otherOrg = '00000000-0000-4000-8000-000000000002';
const admin = '00000000-0000-4000-8000-000000000011', member = '00000000-0000-4000-8000-000000000012', outsider = '00000000-0000-4000-8000-000000000021';
const n1 = '00000000-0000-4000-8000-000000000031', n2 = '00000000-0000-4000-8000-000000000032', n3 = '00000000-0000-4000-8000-000000000033';
try {
  await db.exec(`create schema private; create schema auth; create role anon; create role authenticated;
    grant usage on schema auth to authenticated;
    create table organizations(id uuid primary key);
    create table profiles(id uuid primary key,org_id uuid,is_org_admin boolean);
    create table roles(id uuid primary key,name text);
    create table user_roles(user_id uuid,org_id uuid,role_id uuid);
    grant select on user_roles,roles to authenticated;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.auth_org_id() returns uuid language sql security definer set search_path='' as $$ select org_id from public.profiles where id=auth.uid() $$;
    create function public.auth_is_org_admin() returns boolean language sql security definer set search_path='' as $$ select is_org_admin from public.profiles where id=auth.uid() $$;
    create function public.is_platform_owner() returns boolean language sql as $$ select false $$;
    create table notifications(id uuid primary key,org_id uuid,user_id uuid,title text,body text,type text,
      data jsonb default '{}',created_at timestamptz default now(),push_status text default 'pending',is_read boolean default false);
    insert into organizations values ('${org}'),('${otherOrg}');
    insert into profiles values ('${admin}','${org}',true),('${member}','${org}',false),('${outsider}','${otherOrg}',true);
    insert into notifications(id,org_id,user_id,title,type) values (gen_random_uuid(),'${org}','${member}','Old alert','event_created');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260909065233_notification_open_activity.sql',import.meta.url),'utf8'));
  const rows = async query => (await db.query(query)).rows;
  assert.equal((await rows('select count(*) n from notification_activity'))[0].n,0,'no historical backfill');
  await db.exec(`insert into notifications(id,org_id,user_id,title,body,type) values
    ('${n1}','${org}','${admin}','Event reminder','Revamp tomorrow','event_reminder'),
    ('${n2}','${org}','${member}','Event reminder','Revamp tomorrow','event_reminder'),
    ('${n3}','${otherOrg}','${outsider}','Event reminder','Revamp tomorrow','event_reminder');
    insert into notifications(id,org_id,user_id,title,type) values(gen_random_uuid(),'${org}','${member}','Private chat','message');
    update notifications set is_read=true,push_status='sent' where id='${n2}';`);
  assert.equal((await rows('select count(*) n from notification_activity'))[0].n,3,'chat excluded');
  const before = (await rows(`select * from notification_activity where notification_id='${n2}'`))[0];
  assert.equal(before.is_read,true); assert.equal(before.bell_opened_at,null,'read is not an open');
  await db.exec(`set role authenticated; select set_config('test.uid','${member}',false)`);
  assert.equal((await rows('select count(*) n from notification_activity'))[0].n,0,'members cannot read activity');
  assert.equal((await rows("select count(*) n from get_notification_activity_groups()"))[0].n,0);
  const record = (id,source) => rows(`select record_notification_open('${id}','${source}') ok`);
  assert.equal((await record(n2,'bell'))[0].ok,true);
  assert.equal((await record(n1,'bell'))[0].ok,false,'cannot record another recipient');
  assert.equal((await record(n3,'push'))[0].ok,false,'cannot record another church');
  await assert.rejects(() => record(n2,'invalid'), /Invalid notification source/);
  await assert.rejects(() => db.exec(`update notification_activity set push_opened_at=now()`), /permission denied/);
  await record(n2,'bell'); await record(n2,'push');
  await db.exec(`select set_config('test.uid','${admin}',false)`);
  const groups = await rows('select * from get_notification_activity_groups()');
  assert.equal(groups.length,1,'same-batch matching alerts grouped, other church excluded');
  assert.equal(groups[0].recipient_count,2); assert.equal(groups[0].opened_count,1);
  assert.equal((await record(n2,'page'))[0].ok,false,'admins cannot forge another member open');
  const first = (await rows(`select bell_opened_at from notification_activity where notification_id='${n2}'`))[0].bell_opened_at;
  await db.exec(`select set_config('test.uid','${member}',false)`); await record(n2,'bell');
  await db.exec(`reset role; delete from notifications where id='${n2}';`);
  assert.equal((await rows(`select count(*) n from notification_activity where notification_id='${n2}'`))[0].n,1,'inbox clearing preserves the report');
  assert.equal((await rows(`select bell_opened_at from notification_activity where notification_id='${n2}'`))[0].bell_opened_at.toISOString(),first.toISOString(),'repeated taps preserve first timestamp');
  assert.equal((await rows("select has_function_privilege('anon','public.record_notification_open(uuid,text)','execute') ok"))[0].ok,false);
  assert.equal((await rows("select has_function_privilege('authenticated','private.record_notification_open(uuid,text)','execute') ok"))[0].ok,false);
  console.log('PASS notification activity DB: migration, admin/member RLS, tenant isolation, recipient ownership, grouping, read/open distinction, dedupe and inbox deletion');
} catch(error) { console.error('FAIL notification activity DB:',error.message,error.where || ''); process.exitCode=1; }
finally { await db.close(); }
