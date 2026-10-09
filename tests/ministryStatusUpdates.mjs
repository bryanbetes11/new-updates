import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20261009091226_guard_ministry_status_updates.sql', import.meta.url), 'utf8');
const orgA = '00000000-0000-4000-8000-000000000001';
const orgB = '00000000-0000-4000-8000-000000000002';
const manager = '00000000-0000-4000-8000-000000000011';
const member = '00000000-0000-4000-8000-000000000012';
const outsider = '00000000-0000-4000-8000-000000000013';
const update = (id, status) => db.query('update public.profiles set ministry_status=$1 where id=$2 returning id,ministry_status', [status, id]);
const as = uid => db.exec(`reset role; set role authenticated; set test.uid='${uid}';`);

try {
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.profiles (
      id uuid primary key, org_id uuid, first_name text not null default 'Member',
      can_manage boolean not null default false, is_org_admin boolean not null default false,
      ministry_status text not null default 'active' check (ministry_status in ('active','restoration','suspended','inactive'))
    );
    create function public.auth_org_id() returns uuid language sql stable security definer set search_path='' as $$
      select org_id from public.profiles where id=auth.uid()
    $$;
    create function public.auth_can_manage_org_profiles() returns boolean language sql stable security definer set search_path='' as $$
      select can_manage or is_org_admin from public.profiles where id=auth.uid()
    $$;
    alter table public.profiles enable row level security;
    grant select on public.profiles to authenticated;
    grant update(first_name) on public.profiles to authenticated;
    create policy read_profiles on public.profiles for select to authenticated using (org_id=public.auth_org_id());
    create policy edit_profiles on public.profiles for update to authenticated
      using (org_id=public.auth_org_id() and (id=auth.uid() or public.auth_can_manage_org_profiles()))
      with check (org_id=public.auth_org_id() and (id=auth.uid() or public.auth_can_manage_org_profiles()));
    insert into public.profiles(id,org_id,can_manage) values
      ('${manager}','${orgA}',true),('${member}','${orgA}',false),('${outsider}','${orgB}',true);
    create table public.event_assignments(user_id uuid references public.profiles(id));
    insert into public.event_assignments values ('${member}');
  `);
  await as(manager);
  await assert.rejects(update(member,'inactive'), /permission denied for table profiles/, 'reproduce current column-permission failure');
  await db.exec('reset role');
  await db.exec(migration);
  await as(manager);
  for (const status of ['restoration','suspended','inactive','active']) {
    assert.equal((await update(member,status)).rows[0].ministry_status,status);
  }
  await update(member,'inactive');
  assert.equal((await db.query('select id from public.profiles where id=$1',[member])).rows.length,1,'inactive remains visible in roster');
  assert.equal((await db.query("select id from public.profiles where id=$1 and ministry_status='active'",[member])).rows.length,0,'inactive excluded from picker query');
  assert.equal((await update(outsider,'inactive')).rows.length,0,'cross-church update is blocked');
  await assert.rejects(update(member,'invalid'),/check constraint/);
  await assert.rejects(update(member,null),/not-null constraint/);
  await assert.rejects(db.query('update public.profiles set is_org_admin=true where id=$1',[member]),/permission denied/);
  await assert.rejects(db.query('update public.profiles set org_id=$1 where id=$2',[orgB,member]),/permission denied/);
  await as(member);
  await assert.rejects(update(member,'active'),/Only church profile managers/,'member cannot reactivate self');
  assert.equal((await db.query("update public.profiles set first_name='Changed' where id=$1 returning first_name",[member])).rows[0].first_name,'Changed','self-service edit still works');
  assert.equal((await update(member,'inactive')).rows.length,1,'unchanged status does not block personal edits');
  await as('');
  assert.equal((await update(member,'active')).rows.length,0,'unauthenticated update blocked');
  await db.exec('reset role; set role anon;');
  await assert.rejects(update(member,'active'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select * from public.event_assignments where user_id=$1',[member])).rows.length,1,'assignments preserved');
  await db.exec(`update public.profiles set is_org_admin=true,can_manage=false where id='${manager}';`);
  await as(manager);
  assert.equal((await update(member,'active')).rows[0].ministry_status,'active','church admin can reactivate');
  console.log('PASS ministry status: baseline reproduced; all four statuses, roster/picker, history, self-service, manager/admin, anonymous and tenant/column boundaries verified');
} finally { await db.close(); }
