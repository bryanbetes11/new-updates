// Isolated PostgreSQL only: uses the shipped trigger functions, no live hooks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();
const org = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const actor = '00000000-0000-0000-0000-000000000003';
const event = '00000000-0000-0000-0000-000000000004';
const foreignEvent = '00000000-0000-0000-0000-000000000005';
const functionSQL = (sql, name) => {
  const start = sql.indexOf(`create or replace function ${name}()`);
  assert.ok(start >= 0);
  return sql.slice(start, sql.indexOf('$$;', start) + 3);
};
try {
  await db.exec(`
    create schema auth; create schema private; create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
    create function public.auth_org_id() returns uuid language sql as $$ select '${org}'::uuid $$;
    create function public.auth_is_org_admin() returns boolean language sql as $$ select false $$;
    create function public.auth_is_org_leader() returns boolean language sql as $$ select false $$;
    create function public.is_platform_owner() returns boolean language sql as $$ select false $$;
    create function public.has_org_capability(text) returns boolean language sql as $$ select false $$;
    create table public.events(id uuid primary key, org_id uuid, event_type text, linked_event_id uuid);
    create table public.setlists(id uuid primary key default gen_random_uuid(), event_id uuid references events(id),
      org_id uuid, created_by uuid default auth.uid(), status text default 'draft', approved_by uuid,
      reviewed_by uuid, reviewed_at timestamptz, review_note text, approval_notes text, last_edited_at timestamptz);
    insert into events values ('${event}','${org}','Sunday Service',null),('${foreignEvent}','${other}','Sunday Service',null);
    alter table public.setlists enable row level security;
    grant usage on schema public, auth to authenticated;
    grant select on events to authenticated;
    grant select, insert, update on setlists to authenticated;
    create policy own_church_read on setlists for select to authenticated using (org_id=auth_org_id());
    create policy own_church_insert on setlists for insert to authenticated with check (org_id=auth_org_id() and created_by=auth.uid());
    create policy own_church_update on setlists for update to authenticated using (org_id=auth_org_id() and created_by=auth.uid()) with check (org_id=auth_org_id());
  `);
  const tenantSQL = await read('20260502000700_rls_batch2_library_setlists.sql');
  await db.exec(functionSQL(tenantSQL, 'public.autofill_setlist_org_id'));
  await db.exec(`create trigger trg_setlists_autofill_org_id before insert on setlists for each row execute function autofill_setlist_org_id()`);
  await db.exec(await read('20260923204452_guard_setlist_review_decisions.sql'));
  const linkedSQL = await read('20260924052422_canonical_linked_service_setlists.sql');
  await db.exec(functionSQL(linkedSQL, 'private.canonicalize_linked_setlist_event'));
  await db.exec(`create trigger trg_canonicalize_linked_setlist_event before insert or update of event_id,org_id on setlists for each row execute function private.canonicalize_linked_setlist_event()`);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec(`insert into setlists(event_id) values ('${event}')`), /another church/, 'reproduces old APK creation failure');
  await db.exec('reset role');
  await db.exec(await read('20260925041501_order_setlist_org_before_review_guard.sql'));
  await db.exec('set role authenticated');
  const saved = (await db.query(`insert into setlists(event_id) values ('${event}') returning *`)).rows[0];
  assert.equal(saved.org_id, org);
  assert.equal(saved.status, 'draft');
  await db.exec(`update setlists set review_note=null where id='${saved.id}'`);
  await assert.rejects(db.exec(`insert into setlists(event_id) values ('${foreignEvent}')`), /another church/);
  await assert.rejects(db.exec(`insert into setlists(event_id,org_id) values ('${event}','${other}')`), /another church/);
  await assert.rejects(db.exec(`insert into setlists(event_id,org_id) values ('${foreignEvent}','${org}')`), /same church/);
  await assert.rejects(db.exec(`insert into setlists(event_id,status) values ('${event}','approved')`), /authorized setlist reviewers/);
  await assert.rejects(db.exec(`update setlists set status='approved' where id='${saved.id}'`), /submitted setlists|authorized setlist reviewers/);
  await db.exec('reset role');
  await db.exec(`alter trigger a_setlists_autofill_org_id on setlists rename to trg_setlists_autofill_org_id; set role authenticated`);
  await assert.rejects(db.exec(`insert into setlists(event_id) values ('${event}')`), /another church/, 'rollback restores original trigger order');
  assert.equal((await db.query('select count(*)::int as n from setlists')).rows[0].n, 1, 'existing draft is preserved');
  console.log('PASS setlist creation: reproduced failure, authenticated draft save, church isolation, review guard, reversible trigger ordering.');
} finally { await db.close(); }
