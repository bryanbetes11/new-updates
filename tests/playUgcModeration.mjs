import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const org = '00000000-0000-4000-8000-000000000001';
const otherOrg = '00000000-0000-4000-8000-000000000002';
const alice = '00000000-0000-4000-8000-000000000011';
const bob = '00000000-0000-4000-8000-000000000012';
const outsider = '00000000-0000-4000-8000-000000000013';
const direct = '00000000-0000-4000-8000-000000000021';
const group = '00000000-0000-4000-8000-000000000022';
const directMessage = '00000000-0000-4000-8000-000000000031';

async function as(user, church = org) {
  await db.exec(`reset role; set test.uid = '${user}'; set test.org = '${church}'; set role authenticated;`);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.auth_org_id() returns uuid language sql stable as $$
      select nullif(current_setting('test.org', true), '')::uuid $$;
    create table public.organizations (id uuid primary key);
    create table public.profiles (id uuid primary key, org_id uuid references public.organizations(id));
    create table public.conversations (id uuid primary key, org_id uuid, type text not null);
    create table public.conversation_members (conversation_id uuid not null, user_id uuid not null, org_id uuid);
    create table public.messages (id uuid primary key, conversation_id uuid not null, sender_id uuid not null, org_id uuid);
    create table public.message_reactions (id uuid primary key, message_id uuid not null, user_id uuid not null, org_id uuid);
    create table public.announcements (id uuid primary key, org_id uuid);
    create table public.announcement_comments (id uuid primary key, org_id uuid, announcement_id uuid);
    create table public.event_messages (id uuid primary key, org_id uuid);
    create function public.is_conversation_member(p_conversation uuid, p_user uuid)
    returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.conversation_members
        where conversation_id = p_conversation and user_id = p_user) $$;
    grant usage on schema auth to authenticated;
    grant select, insert on public.conversations, public.conversation_members,
      public.messages, public.message_reactions, public.profiles to authenticated;
  `);
  const migration = await readFile(new URL('../supabase/migrations/20260928225243_play_ugc_moderation.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.query('insert into public.organizations(id) values ($1), ($2)', [org, otherOrg]);
  await db.query('insert into public.profiles(id,org_id) values ($1,$4),($2,$4),($3,$5)', [alice, bob, outsider, org, otherOrg]);
  await db.query("insert into public.conversations(id,org_id,type) values ($1,$3,'personal'),($2,$3,'group')", [direct, group, org]);
  await db.query('insert into public.conversation_members(conversation_id,user_id,org_id) values ($1,$3,$5),($1,$4,$5),($2,$3,$5),($2,$4,$5)', [direct, group, alice, bob, org]);
  await db.query('insert into public.messages(id,conversation_id,sender_id,org_id) values ($1,$2,$3,$4)', [directMessage, direct, bob, org]);

  await as(alice);
  await db.query('insert into public.user_blocks(org_id,blocker_id,blocked_id) values ($1,$2,$3)', [org, alice, bob]);
  await assert.rejects(db.query('insert into public.messages(id,conversation_id,sender_id,org_id) values (gen_random_uuid(),$1,$2,$3)', [direct, alice, org]), /Direct messaging is unavailable/);
  await db.query('insert into public.messages(id,conversation_id,sender_id,org_id) values (gen_random_uuid(),$1,$2,$3)', [group, alice, org]);
  await assert.rejects(db.query('insert into public.message_reactions(id,message_id,user_id,org_id) values (gen_random_uuid(),$1,$2,$3)', [directMessage, alice, org]), /Direct messaging is unavailable/);
  await assert.rejects(db.query('insert into public.user_blocks(org_id,blocker_id,blocked_id) values ($1,$2,$3)', [org, alice, outsider]), /row-level security|violates row-level security/);

  await db.query("insert into public.content_reports(org_id,reporter_id,kind,subject_id,reason) values ($1,$2,'message',$3,'harassment')", [org, alice, directMessage]);
  await db.query("insert into public.content_reports(org_id,reporter_id,kind,subject_id,reason) values ($1,$2,'user',$3,'spam')", [org, alice, bob]);
  await assert.rejects(db.query("insert into public.content_reports(org_id,reporter_id,kind,subject_id,reason) values ($1,$2,'user',$3,'spam')", [org, alice, outsider]), /unavailable for reporting/);
  await db.exec('reset role');

  await as(bob);
  await assert.rejects(db.query('insert into public.messages(id,conversation_id,sender_id,org_id) values (gen_random_uuid(),$1,$2,$3)', [direct, bob, org]), /Direct messaging is unavailable/);
  const hidden = await db.query('select * from public.user_blocks');
  assert.equal(hidden.rows.length, 0, 'blocked person cannot inspect the block table');
  const hiddenReports = await db.query('select * from public.content_reports');
  assert.equal(hiddenReports.rows.length, 0, 'other member cannot read submitted reports');
  await db.exec('reset role');
  console.log('Play UGC moderation: direct block, shared chat, reports, and tenant isolation passed');
} catch (error) {
  console.error('Play UGC moderation test failed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
