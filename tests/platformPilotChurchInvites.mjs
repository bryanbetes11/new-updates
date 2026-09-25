import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20260925120108_platform_pilot_church_invites.sql', import.meta.url), 'utf8');
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create table public.profiles (id uuid primary key, email text, org_id uuid);
    create table private.church_pilot_invites (
      email text primary key, expires_at timestamptz not null,
      claimed_at timestamptz, created_at timestamptz not null default now()
    );
    insert into public.profiles values
      ('${owner}', 'bryanbetes11@gmail.com', null),
      ('${member}', 'member@example.test', null);
    create function public.is_platform_owner() returns boolean
      language sql stable security definer set search_path = public as $$
      select exists(select 1 from public.profiles where id=auth.uid()
        and lower(email)='bryanbetes11@gmail.com')
      $$;
    grant usage on schema auth to authenticated;
  `);
  await db.exec(migration);

  const asUser = async id => {
    await db.exec('reset role');
    await db.query("select set_config('test.uid',$1,false)", [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
  };
  await asUser(member);
  await assert.rejects(db.query('select * from public.list_platform_pilot_church_invites()'), /Platform owner access required/);
  await assert.rejects(db.query("select public.approve_platform_pilot_church_invite('pilot@example.test')"), /Platform owner access required/);
  await asUser(null);
  await assert.rejects(db.query('select * from public.list_platform_pilot_church_invites()'), /permission denied/);

  await asUser(owner);
  await assert.rejects(db.query("select public.approve_platform_pilot_church_invite('bad')"), /valid administrator email/);
  const first = await db.query("select public.approve_platform_pilot_church_invite(' Pilot@Example.Test ') as expiry");
  assert.ok(new Date(first.rows[0].expiry).getTime() > Date.now());
  let rows = (await db.query('select * from public.list_platform_pilot_church_invites()')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'pilot@example.test');
  await db.query("select public.approve_platform_pilot_church_invite('pilot@example.test')");
  rows = (await db.query('select * from public.list_platform_pilot_church_invites()')).rows;
  assert.equal(rows.length, 1);
  await db.query("select public.revoke_platform_pilot_church_invite('pilot@example.test')");
  assert.equal((await db.query('select * from public.list_platform_pilot_church_invites()')).rows.length, 0);

  await db.query("select public.approve_platform_pilot_church_invite('pilot@example.test')");
  await db.exec('reset role');
  await db.query("update private.church_pilot_invites set claimed_at=now() where email='pilot@example.test'");
  await asUser(owner);
  await assert.rejects(db.query("select public.approve_platform_pilot_church_invite('pilot@example.test')"), /already been used/);
  await assert.rejects(db.query("select public.revoke_platform_pilot_church_invite('pilot@example.test')"), /No unused invitation found/);
  await db.exec('reset role');
  await db.query("update public.profiles set org_id=$1 where id=$2", [member, member]);
  await asUser(owner);
  await assert.rejects(db.query("select public.approve_platform_pilot_church_invite('member@example.test')"), /already belongs to a church/);
  console.log('PASS pilot church invites: owner approval/list/revoke, normalization, claimed guard, existing member guard, non-owner denial');
} finally {
  await db.close();
}
