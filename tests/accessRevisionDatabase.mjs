import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const sql = await readFile(new URL('../supabase/migrations/20260925035444_live_access_revision_signals.sql', import.meta.url),'utf8');
const db = new PGlite();
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table profiles(id uuid primary key,org_id uuid,is_org_admin boolean,email text);
    create table user_roles(id integer,user_id uuid);
    create table organization_member_settings(user_id uuid,capabilities jsonb);
    insert into profiles values('${a}','${a}',false,'a@example.test'),('${b}','${b}',false,'b@example.test');`);
  // PGlite does not stream logical replication; publication is verified on Supabase.
  await db.exec(sql.replace('alter publication supabase_realtime add table public.user_access_revisions;',''));
  const revision=async()=>Number((await db.query('select revision from user_access_revisions where user_id=$1',[a])).rows[0].revision);
  assert.equal(await revision(),1);
  await db.exec(`update profiles set is_org_admin=true where id='${a}'`);
  assert.equal(await revision(),2);
  await db.exec(`insert into user_roles values(1,'${a}'); delete from user_roles where id=1;`);
  assert.equal(await revision(),4);
  await db.exec(`insert into organization_member_settings values('${a}','{}'); update organization_member_settings set capabilities='{"manage_members":true}'; delete from organization_member_settings;`);
  assert.equal(await revision(),7);
  await db.exec(`select set_config('test.uid','${a}',false); set role authenticated;`);
  assert.deepEqual((await db.query('select user_id from user_access_revisions')).rows,[{user_id:a}]);
  await assert.rejects(db.query('update user_access_revisions set revision=99'),/permission denied/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from user_access_revisions'),/permission denied/);
  await db.exec(`reset role; delete from profiles where id='${a}';`);
  assert.equal((await db.query('select * from user_access_revisions where user_id=$1',[a])).rows.length,0);
  console.log('PASS access revisions: admin, roles, capabilities, deletion, own-only reads and denied writes');
} finally { await db.close(); }
