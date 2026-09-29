import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.profiles (
      id uuid primary key, org_id uuid, is_org_admin boolean not null default false,
      updated_at timestamptz not null default now()
    );
    create table public.user_roles (user_id uuid not null);
    create table public.native_push_devices (user_id uuid not null);
    create table public.push_subscriptions (user_id uuid not null);
  `);
  const migration = await readFile(new URL('../supabase/migrations/20260929090100_queue_account_deletion_requests.sql', import.meta.url), 'utf8');
  await db.exec(migration);

  const user = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const org = '00000000-0000-4000-8000-000000000003';
  await db.query('insert into profiles (id, org_id, is_org_admin) values ($1, $3, true), ($2, $3, false)', [user, other, org]);
  for (const table of ['user_roles', 'native_push_devices', 'push_subscriptions']) {
    await db.query(`insert into ${table} (user_id) values ($1), ($2)`, [user, other]);
  }

  const first = await db.query('select public.queue_and_disable_account_deletion($1, $2) as id', [user, 'member@example.com']);
  const again = await db.query('select public.queue_and_disable_account_deletion($1, $2) as id', [user, 'member@example.com']);
  assert.equal(first.rows[0].id, again.rows[0].id, 'retry should keep one request');

  const profile = await db.query('select org_id, is_org_admin from profiles where id = $1', [user]);
  assert.equal(profile.rows[0].org_id, null);
  assert.equal(profile.rows[0].is_org_admin, false);
  const otherProfile = await db.query('select org_id from profiles where id = $1', [other]);
  assert.equal(otherProfile.rows[0].org_id, org, 'other church members remain');
  for (const table of ['user_roles', 'native_push_devices', 'push_subscriptions']) {
    const rows = await db.query(`select user_id from ${table}`);
    assert.deepEqual(rows.rows.map(row => row.user_id), [other], `${table} should retain only the other member`);
  }
  const requests = await db.query('select user_id, former_org_id, status from account_deletion_requests');
  assert.deepEqual(requests.rows, [{ user_id: user, former_org_id: org, status: 'pending' }]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.account_deletion_requests'), /permission denied/);
  await assert.rejects(
    db.query('select public.queue_and_disable_account_deletion($1, $2)', [other, 'other@example.com']),
    /permission denied/,
  );
  await db.exec('reset role');
  console.log('Account deletion queue: request, retry, access removal, and other-member preservation passed');
} catch (error) {
  console.error('Account deletion queue test failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
