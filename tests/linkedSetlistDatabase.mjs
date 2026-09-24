// Isolated PostgreSQL: no production data, notifications, or external hooks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20260924052422_canonical_linked_service_setlists.sql', import.meta.url), 'utf8');
const org = '00000000-0000-0000-0000-000000000001';
const otherOrg = '00000000-0000-0000-0000-000000000002';
const service = '00000000-0000-0000-0000-000000000011';
const rehearsal = '00000000-0000-0000-0000-000000000012';
const proposal = '00000000-0000-0000-0000-000000000021';
const leader = '00000000-0000-0000-0000-000000000031';
const otherLeader = '00000000-0000-0000-0000-000000000032';

async function fixture(db, withConflict = false) {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated;
    create table public.profiles(id uuid primary key, org_id uuid not null);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function public.auth_org_id() returns uuid language sql stable as $$
      select org_id from public.profiles where id=auth.uid()
    $$;
    create table public.events(id uuid primary key, org_id uuid not null, event_type text not null, linked_event_id uuid);
    create table public.setlists(id uuid primary key, event_id uuid not null references public.events(id), org_id uuid, status text, created_by uuid, last_edited_at timestamptz);
    create table public.setlist_songs(id uuid primary key, setlist_id uuid references public.setlists(id));
    create table public.setlist_revision_comments(id uuid primary key, setlist_id uuid references public.setlists(id));
    create table public.setlist_submissions(id uuid primary key, setlist_id uuid references public.setlists(id));
    create table public.setlist_revision_discussion_views(id uuid primary key, setlist_id uuid references public.setlists(id));
    create table public.roles(id uuid primary key, name text);
    create table public.user_roles(user_id uuid, org_id uuid, role_id uuid);
    create table public.event_assignments(event_id uuid, user_id uuid, org_id uuid, role_id uuid);
    create table public.activity_events(id integer generated always as identity);
    create table public.notifications(id integer generated always as identity);
    create function public.test_stamp_edit() returns trigger language plpgsql as $$
      begin new.last_edited_at := now(); return new; end
    $$;
    create function public.test_log_activity() returns trigger language plpgsql as $$
      begin insert into public.activity_events default values; return new; end
    $$;
    create function public.test_notify_status() returns trigger language plpgsql as $$
      begin if new.status is distinct from old.status then insert into public.notifications default values; end if; return new; end
    $$;
    create trigger setlists_set_last_edited_at before update on public.setlists for each row execute function public.test_stamp_edit();
    create trigger trg_activity_setlists after update on public.setlists for each row execute function public.test_log_activity();
    create trigger trg_setlist_status_changed after update on public.setlists for each row execute function public.test_notify_status();
    insert into public.profiles values ('${leader}','${org}'),('${otherLeader}','${otherOrg}');
    insert into public.events values ('${service}','${org}','Sunday Service',null),('${rehearsal}','${org}','Rehearsals','${service}');
    insert into public.setlists values ('${proposal}','${rehearsal}','${org}','revision_requested','${leader}','2026-01-01T00:00:00Z');
    insert into public.setlist_songs values ('00000000-0000-0000-0000-000000000041','${proposal}');
    insert into public.setlist_revision_comments values ('00000000-0000-0000-0000-000000000042','${proposal}');
    insert into public.setlist_submissions values ('00000000-0000-0000-0000-000000000043','${proposal}');
    insert into public.setlist_revision_discussion_views values ('00000000-0000-0000-0000-000000000044','${proposal}');
    insert into public.roles values ('00000000-0000-0000-0000-000000000051','Song Leader');
    insert into public.event_assignments values ('${rehearsal}','${leader}','${org}','00000000-0000-0000-0000-000000000051');
  `);
  if (withConflict) {
    await db.exec(`insert into public.setlists values ('00000000-0000-0000-0000-000000000022','${service}','${org}','draft','${leader}',null)`);
  }
}

const db = new PGlite();
try {
  await fixture(db);
  await db.exec(migration);
  const row = (await db.query(`select id,event_id,status,last_edited_at from public.setlists where id='${proposal}'`)).rows[0];
  assert.equal(row.id, proposal, 'proposal ID is stable');
  assert.equal(row.event_id, service, 'proposal moves to canonical service');
  assert.equal(row.status, 'revision_requested', 'review status is stable');
  assert.equal(new Date(row.last_edited_at).toISOString(), '2026-01-01T00:00:00.000Z', 'migration does not mark proposal edited');
  for (const table of ['setlist_songs', 'setlist_revision_comments', 'setlist_submissions', 'setlist_revision_discussion_views']) {
    assert.equal((await db.query(`select count(*)::int as count from public.${table} where setlist_id='${proposal}'`)).rows[0].count, 1, `${table} stays attached`);
  }
  assert.equal((await db.query('select count(*)::int as count from public.notifications')).rows[0].count, 0, 'no review notification');
  assert.equal((await db.query('select count(*)::int as count from public.activity_events')).rows[0].count, 0, 'no false activity entry');

  await db.exec(`select set_config('request.jwt.claim.sub','${leader}',false)`);
  assert.equal((await db.query(`select public.can_access_setlist_revision_discussion('${proposal}') as allowed`)).rows[0].allowed, true, 'rehearsal Song Leader retains discussion access');
  await db.exec(`select set_config('request.jwt.claim.sub','${otherLeader}',false)`);
  assert.equal((await db.query(`select public.can_access_setlist_revision_discussion('${proposal}') as allowed`)).rows[0].allowed, false, 'other church cannot read discussion');

  await assert.rejects(db.exec(`insert into public.setlists values (gen_random_uuid(),'${rehearsal}','${org}','draft','${leader}',null)`), /already has a setlist/, 'old app cannot create a split proposal');
  await assert.rejects(db.exec(`insert into public.setlists values (gen_random_uuid(),'${service}','${org}','draft','${leader}',null)`), /already has a setlist/, 'direct service insert cannot duplicate');
  await assert.rejects(db.exec(`insert into public.setlists values (gen_random_uuid(),'${service}','${otherOrg}','draft','${leader}',null)`), /same church/, 'setlist cannot claim another church');

  await db.exec(`insert into public.events values ('00000000-0000-0000-0000-000000000013','${org}','Rehearsals','00000000-0000-0000-0000-000000000014'),('00000000-0000-0000-0000-000000000014','${otherOrg}','Sunday Service',null)`);
  await assert.rejects(db.exec(`insert into public.setlists values (gen_random_uuid(),'00000000-0000-0000-0000-000000000013','${org}','draft','${leader}',null)`), /same church/, 'cross-church link is rejected');
  await db.exec(`insert into public.events values ('00000000-0000-0000-0000-000000000015','${org}','Sunday Service',null),('00000000-0000-0000-0000-000000000016','${org}','Rehearsals','00000000-0000-0000-0000-000000000015')`);
  await db.exec(`insert into public.setlists values ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000016','${org}','draft','${leader}',null)`);
  assert.equal((await db.query(`select event_id from public.setlists where id='00000000-0000-0000-0000-000000000023'`)).rows[0].event_id, '00000000-0000-0000-0000-000000000015', 'old app rehearsal insert stores service id');

  const standaloneService = '00000000-0000-0000-0000-000000000017';
  await db.exec(`insert into public.events values ('${standaloneService}','${org}','Sunday Service',null)`);
  await db.exec(`insert into public.setlists values ('00000000-0000-0000-0000-000000000024','${standaloneService}','${org}','draft','${leader}',null),('00000000-0000-0000-0000-000000000025','${standaloneService}','${org}','draft','${leader}',null)`);
  assert.equal((await db.query(`select count(*)::int as count from public.setlists where event_id='${standaloneService}'`)).rows[0].count, 2, 'unrelated Sunday Service retains existing multi-proposal behavior');

  const laterRehearsal = '00000000-0000-0000-0000-000000000018';
  const laterService = '00000000-0000-0000-0000-000000000019';
  const laterProposal = '00000000-0000-0000-0000-000000000026';
  await db.exec(`insert into public.events values ('${laterRehearsal}','${org}','Rehearsals',null),('${laterService}','${org}','Sunday Service',null);
    insert into public.setlists values ('${laterProposal}','${laterRehearsal}','${org}','draft','${leader}',null);
    insert into public.setlist_songs values ('00000000-0000-0000-0000-000000000045','${laterProposal}');`);
  await db.exec(`update public.events set linked_event_id='${laterService}' where id='${laterRehearsal}'`);
  assert.deepEqual((await db.query(`select id,event_id from public.setlists where id='${laterProposal}'`)).rows[0], { id: laterProposal, event_id: laterService }, 'linking later moves the original proposal atomically');
  assert.equal((await db.query(`select count(*)::int as count from public.setlist_songs where setlist_id='${laterProposal}'`)).rows[0].count, 1, 'later link preserves song relation');
  await assert.rejects(db.exec(`update public.events set linked_event_id=null where id='${laterRehearsal}'`), /shared setlist/, 'unlink cannot abandon shared proposal');
  await assert.rejects(db.exec(`update public.events set linked_event_id='${standaloneService}' where id='${laterRehearsal}'`), /shared setlist/, 'relink cannot abandon shared proposal');
  assert.equal((await db.query(`select linked_event_id from public.events where id='${laterRehearsal}'`)).rows[0].linked_event_id, laterService, 'rejected relink keeps original pair');

  const conflictingRehearsal = '00000000-0000-0000-0000-000000000027';
  const conflictingProposal = '00000000-0000-0000-0000-000000000028';
  await db.exec(`insert into public.events values ('${conflictingRehearsal}','${org}','Rehearsals',null);
    insert into public.setlists values ('${conflictingProposal}','${conflictingRehearsal}','${org}','draft','${leader}',null);`);
  await assert.rejects(db.exec(`update public.events set linked_event_id='${laterService}' where id='${conflictingRehearsal}'`), /combine or hide/, 'linking two real proposals is rejected');
  assert.equal((await db.query(`select event_id from public.setlists where id='${conflictingProposal}'`)).rows[0].event_id, conflictingRehearsal, 'conflicting proposal remains standalone');
  await assert.rejects(db.exec(`update public.events set linked_event_id='00000000-0000-0000-0000-000000000014' where id='${conflictingRehearsal}'`), /same church/, 'later cross-church link is rejected');

  const adoptRehearsal = '00000000-0000-0000-0000-000000000034';
  await db.exec(`insert into public.events values ('${adoptRehearsal}','${org}','Rehearsals',null)`);
  await db.exec(`update public.events set linked_event_id='${laterService}' where id='${adoptRehearsal}'`);
  assert.equal((await db.query(`select linked_event_id from public.events where id='${adoptRehearsal}'`)).rows[0].linked_event_id, laterService, 'empty rehearsal may adopt an existing service proposal');
  await assert.rejects(db.exec(`update public.events set linked_event_id='${standaloneService}' where id='${conflictingRehearsal}'`), /combine or hide/, 'link cannot point at historical multi-proposal service');

  const emptyRehearsal = '00000000-0000-0000-0000-000000000029';
  const emptyService = '00000000-0000-0000-0000-000000000030';
  const nextEmptyService = '00000000-0000-0000-0000-000000000033';
  await db.exec(`insert into public.events values ('${emptyRehearsal}','${org}','Rehearsals','${emptyService}'),('${emptyService}','${org}','Sunday Service',null),('${nextEmptyService}','${org}','Sunday Service',null)`);
  await db.exec(`update public.events set linked_event_id='${nextEmptyService}' where id='${emptyRehearsal}'`);
  await db.exec(`update public.events set linked_event_id=null where id='${emptyRehearsal}'`);
  assert.equal((await db.query(`select linked_event_id from public.events where id='${emptyRehearsal}'`)).rows[0].linked_event_id, null, 'empty pairs may relink and unlink');
  console.log('Linked setlist migration: preservation, auth, canonical inserts, duplicate and cross-org guards passed.');
} finally {
  await db.close();
}

const conflictDb = new PGlite();
try {
  await fixture(conflictDb, true);
  await assert.rejects(conflictDb.exec(migration), /already has a setlist/, 'existing service proposal aborts migration');
  assert.equal((await conflictDb.query(`select event_id from public.setlists where id='${proposal}'`)).rows[0].event_id, rehearsal, 'conflict leaves both proposals untouched');
  console.log('Linked setlist migration: conflict rollback passed.');
} finally {
  await conflictDb.close();
}
