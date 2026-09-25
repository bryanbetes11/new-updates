import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260925012244_attendance_team_memberships.sql', import.meta.url), 'utf8');
const orgA = '00000000-0000-4000-8000-000000000001';
const orgB = '00000000-0000-4000-8000-000000000002';
const adminA = '00000000-0000-4000-8000-000000000011';
const memberA = '00000000-0000-4000-8000-000000000012';
const adminB = '00000000-0000-4000-8000-000000000013';

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.organizations(id uuid primary key);
    create table public.profiles(id uuid primary key, org_id uuid, is_org_admin boolean not null);
    create table public.roles(id uuid primary key,is_leadership boolean);
    create table public.user_roles(user_id uuid,org_id uuid,role_id uuid);
    grant select on public.roles,public.user_roles to authenticated;
    grant select on public.profiles to authenticated;
    create function public.auth_org_id() returns uuid language sql stable security definer set search_path = '' as $$
      select org_id from public.profiles where id = auth.uid()
    $$;
    create function public.auth_is_org_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select coalesce(is_org_admin, false) from public.profiles where id = auth.uid()
    $$;
    insert into public.organizations values ('${orgA}'), ('${orgB}');
    insert into public.profiles values
      ('${adminA}','${orgA}',true), ('${memberA}','${orgA}',false), ('${adminB}','${orgB}',true);
  `);
  await db.exec(migration);
  const as = async user => db.exec(`reset role; set role authenticated; set test.uid = '${user}';`);
  const assign = (userId, team, orgId = orgA, by = adminA) => db.query(
    'insert into public.attendance_team_memberships (org_id,user_id,team,created_by) values ($1,$2,$3,$4)',
    [orgId,userId,team,by],
  );
  const visible = async () => (await db.query('select user_id, team from public.attendance_team_memberships')).rows;

  await as(memberA);
  await assert.rejects(assign(memberA, 'music', orgA, memberA), /row-level security policy/);
  await as(adminA);
  await assign(memberA, 'music');
  await assign(memberA, 'tech');
  const scope = (target, team, church = orgA, by = adminA) => db.query(
    'insert into attendance_leader_scopes(org_id,user_id,team,created_by) values($1,$2,$3,$4)',[church,target,team,by]);
  await assert.rejects(scope(memberA,'music'), /row-level security/, 'ordinary members cannot receive leader access');
  await db.exec(`reset role; insert into roles values ('${orgA}',true); insert into user_roles values ('${memberA}','${orgA}','${orgA}')`);
  await as(adminA);
  await scope(memberA,'music'); await scope(memberA,'tech');
  await assert.rejects(scope(adminB,'music'), /row-level security/);
  await as(memberA);
  assert.equal((await db.query('delete from attendance_leader_scopes returning team')).rows.length,0);
  await assert.rejects(scope(memberA,'music',orgA,memberA), /row-level security/);
  await as(adminB);
  assert.equal((await db.query('select * from attendance_leader_scopes')).rows.length,0);
  await db.exec(`reset role; delete from user_roles where user_id='${memberA}'`);
  assert.equal((await db.query('select * from attendance_leader_scopes')).rows.length,0,'last leadership removal clears scopes');
  await db.exec(`insert into user_roles values ('${memberA}','${orgA}','${orgA}')`);
  await as(adminA); await scope(memberA,'music');
  await assert.rejects(assign(adminB, 'music'), /row-level security policy/);
  await assert.rejects(assign(memberA, 'unknown'), /check constraint/);
  assert.equal((await visible()).length, 2, 'dual-team membership is supported');
  await as(adminB);
  assert.equal((await visible()).length, 0, 'another church cannot read memberships');
  assert.equal((await db.query('delete from public.attendance_team_memberships returning team')).rows.length, 0);

  await db.exec(`reset role; update public.profiles set org_id = '${orgB}' where id = '${memberA}'`);
  await as(adminA);
  assert.equal((await visible()).length, 0, 'team membership is cleared on church exit');
  assert.equal((await db.query('select * from attendance_leader_scopes')).rows.length,0,'leader scopes cleared on church exit');
  console.log('PASS attendance teams: admin assignment, dual membership, tenant isolation, church-exit cleanup');
} finally {
  await db.close();
}
