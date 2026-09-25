import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260925011929_guard_leadership_role_assignments.sql', import.meta.url), 'utf8');
const orgA = '00000000-0000-4000-8000-000000000001';
const orgB = '00000000-0000-4000-8000-000000000002';
const member = '00000000-0000-4000-8000-000000000011';
const manager = '00000000-0000-4000-8000-000000000012';
const admin = '00000000-0000-4000-8000-000000000013';
const otherAdmin = '00000000-0000-4000-8000-000000000014';
const music = '00000000-0000-4000-8000-000000000021';
const director = '00000000-0000-4000-8000-000000000022';

try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.profiles (id uuid primary key, org_id uuid, is_org_admin boolean not null, can_manage boolean not null);
    create table public.roles (id uuid primary key, is_leadership boolean not null);
    create table public.user_roles (id integer generated always as identity primary key, user_id uuid not null, role_id uuid not null, org_id uuid not null);
    grant select on public.profiles, public.roles to authenticated;
    grant select, insert, delete on public.user_roles to authenticated;
    grant usage, select on sequence public.user_roles_id_seq to authenticated;
    alter table public.user_roles enable row level security;
    create function public.auth_org_id() returns uuid language sql stable security definer set search_path = '' as $$
      select org_id from public.profiles where id = auth.uid()
    $$;
    create function public.auth_is_org_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select coalesce(is_org_admin, false) from public.profiles where id = auth.uid()
    $$;
    create function public.auth_can_manage_org_profiles() returns boolean language sql stable security definer set search_path = '' as $$
      select coalesce(is_org_admin or can_manage, false) from public.profiles where id = auth.uid()
    $$;
    create policy "Users can view same-org user roles" on public.user_roles for select to authenticated
      using (org_id = public.auth_org_id());
    create policy "Users can insert own roles in current org" on public.user_roles for insert to authenticated
      with check (user_id = auth.uid() and org_id = public.auth_org_id());
    create policy "Users can delete own roles in current org" on public.user_roles for delete to authenticated
      using (user_id = auth.uid() and org_id = public.auth_org_id());
    create policy "Org leaders can manage same-org user roles" on public.user_roles for insert to authenticated
      with check (org_id = public.auth_org_id());
    create policy "Org leaders can delete same-org user roles" on public.user_roles for delete to authenticated
      using (org_id = public.auth_org_id());
    insert into public.profiles values
      ('${member}','${orgA}',false,false), ('${manager}','${orgA}',false,true),
      ('${admin}','${orgA}',true,true), ('${otherAdmin}','${orgB}',true,true);
    insert into public.roles values ('${music}',false),('${director}',true);
  `);
  const as = async user => db.exec(`reset role; set role authenticated; set test.uid = '${user}';`);
  const add = (userId, roleId, orgId = orgA) => db.query(
    'insert into public.user_roles (user_id, role_id, org_id) values ($1, $2, $3) returning id',
    [userId, roleId, orgId],
  );
  const remove = (userId, roleId) => db.query(
    'delete from public.user_roles where user_id = $1 and role_id = $2 returning id',
    [userId, roleId],
  );

  await as(member);
  assert.equal((await add(member, director)).rows.length, 1, 'baseline reproduces self-grant');
  await db.exec(`reset role; delete from public.user_roles;`);
  await db.exec(migration);

  await as(member);
  await assert.rejects(add(member, director), /row-level security policy/);
  await assert.rejects(add(member, music), /row-level security policy/);
  await assert.rejects(add(otherAdmin, music, orgB), /row-level security policy/);

  await as(manager);
  await assert.rejects(add(member, director), /row-level security policy/);
  assert.equal((await add(member, music)).rows.length, 1, 'profile managers can assign same-church non-leadership roles');
  await assert.rejects(add(otherAdmin, music, orgA), /row-level security policy/);

  await as(member);
  assert.equal((await remove(member, music)).rows.length, 0, 'member cannot remove even their own role');

  await as(admin);
  assert.equal((await add(member, director)).rows.length, 1, 'church admin can grant leadership');
  await as(member);
  assert.equal((await remove(member, director)).rows.length, 0, 'member cannot remove own leadership grant');
  await as(manager);
  assert.equal((await remove(member, director)).rows.length, 0, 'profile manager cannot remove leadership grant');
  await as(otherAdmin);
  assert.equal((await remove(member, director)).rows.length, 0, 'another church cannot remove leadership grant');
  await as(admin);
  assert.equal((await remove(member, director)).rows.length, 1, 'church admin can remove leadership');
  assert.equal((await remove(member, music)).rows.length, 1, 'church admin can remove non-leadership role');
  console.log('PASS role assignment RLS: self-edits blocked; manager, admin, and cross-church paths');
} finally {
  await db.close();
}
