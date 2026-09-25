import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260925033252_fix_current_org_auth_audit_email_type.sql', import.meta.url), 'utf8');
const original = await readFile(new URL('../supabase/migrations/20260621120000_add_current_org_auth_audit.sql', import.meta.url), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create table profiles(id uuid,org_id uuid,is_org_admin boolean,email text,first_name text,last_name text,nickname text);
    create table auth.users(id uuid,email varchar(255),email_confirmed_at timestamptz,last_sign_in_at timestamptz,created_at timestamptz);
    create table roles(id uuid,name text);
    create table user_roles(user_id uuid,org_id uuid,role_id uuid);
    create table organization_invitations(id uuid,org_id uuid,email text,token text,expires_at timestamptz,accepted_at timestamptz,created_at timestamptz);
  `);
  for (const [n, org, admin, email] of [[1,100,true,'admin@example.test'],[2,100,false,'member@example.test'],[3,200,true,'other@example.test'],[4,100,false,'invite@example.test'],[5,100,false,'profile@example.test'],[6,100,false,'unconfirmed@example.test'],[7,100,false,'missing@example.test'],[8,null,false,'detached@example.test']]) {
    await db.query('insert into profiles values ($1,$2,$3,$4,$5,$6,$7)', [id(n),org===null?null:id(org),admin,email,`User ${n}`,'Test',null]);
    if (![4,7,8].includes(n)) await db.query('insert into auth.users values($1,$2,$3,now(),now())',[id(n),n===5?'different@example.test':email,n===6?null:new Date().toISOString()]);
  }
  await db.query("insert into organization_invitations values($1,$2,'invite@example.test','synthetic-token',now()+interval '1 day',null,now())",[id(300),id(100)]);
  const asUser = async n => {
    await db.exec('reset role');
    await db.query("select set_config('test.uid',$1,false)",[n===null?'':id(n)]);
    await db.exec('set role authenticated');
  };
  await db.exec(original);
  await asUser(1);
  await assert.rejects(db.query('select * from get_current_org_auth_audit()'), /structure of query does not match/);
  await db.exec('reset role');
  await db.exec(migration);
  await asUser(1);
  const { rows } = await db.query('select * from get_current_org_auth_audit()');
  assert.equal(rows.length,6);
  assert.equal(rows.find(r=>r.profile_id===id(1)).auth_email,'admin@example.test');
  for (const [n,status] of [[1,'ready'],[2,'ready'],[4,'invite_pending'],[5,'email_mismatch'],[6,'email_unconfirmed'],[7,'missing_auth_account']]) assert.equal(rows.find(r=>r.profile_id===id(n)).auth_status,status);
  assert.equal(rows.find(r=>r.profile_id===id(4)).pending_invite_token,'synthetic-token');
  await asUser(3);
  assert.deepEqual((await db.query('select profile_id from get_current_org_auth_audit()')).rows.map(r=>r.profile_id),[id(3)]);
  for (const n of [2,8,null]) {
    await asUser(n);
    await assert.rejects(db.query('select * from get_current_org_auth_audit()'), /Not authorized/);
  }
  await db.exec('reset role');
  await db.query("insert into roles values($1,'Production Director')",[id(400)]);
  await db.query('insert into user_roles values($1,$2,$3)',[id(2),id(100),id(400)]);
  await asUser(2);
  assert.equal((await db.query('select * from get_current_org_auth_audit()')).rows.length,6);
  console.log('PASS auth audit: reproduced varchar failure; fixed statuses; admin/director access; tenant isolation; member/detached/anonymous denial');
} finally { await db.close(); }
