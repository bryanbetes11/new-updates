// Isolated PostgreSQL test: no production setlists or timestamps are changed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20260924055426_preserve_first_setlist_submission_time.sql', import.meta.url), 'utf8');
const db = new PGlite();
const firstSubmission = '2026-09-23T20:29:00.000Z';
const attemptedReset = '2026-09-24T20:29:00.000Z';

try {
  await db.exec(`
    create table public.setlists (
      id integer primary key, status text not null, submitted_at timestamptz,
      created_at timestamptz not null default now()
    );
    insert into public.setlists(id, status, submitted_at) values
      (1, 'revision_requested', '${firstSubmission}'),
      (2, 'draft', null),
      (3, 'approved', null);
    create function public.set_submitted_at() returns trigger language plpgsql as $$
    begin
      if new.status = 'pending_review' and old.status is distinct from 'pending_review'
        and new.submitted_at is null then new.submitted_at := now(); end if;
      return new;
    end $$;
    create trigger trg_set_submitted_at before update on public.setlists
      for each row execute function public.set_submitted_at();
  `);
  await db.exec(migration);

  const before = await db.query('select id, status, submitted_at from public.setlists order by id');
  assert.deepEqual(before.rows.map(row => row.status), ['revision_requested', 'draft', 'approved'], 'migration leaves all existing statuses alone');
  assert.equal(new Date(before.rows[0].submitted_at).toISOString(), firstSubmission, 'migration leaves first submission alone');
  assert.equal(before.rows[1].submitted_at, null, 'migration does not invent a date for a draft');
  assert.equal(before.rows[2].submitted_at, null, 'migration does not backfill a legacy approval');

  await db.query("update public.setlists set status='pending_review', submitted_at=$1 where id=1", [attemptedReset]);
  assert.equal(new Date((await db.query('select submitted_at from public.setlists where id=1')).rows[0].submitted_at).toISOString(), firstSubmission,
    'revision resubmission keeps first submission even when an old client writes a new time');
  await db.query('update public.setlists set submitted_at=$1 where id=1', [attemptedReset]);
  assert.equal(new Date((await db.query('select submitted_at from public.setlists where id=1')).rows[0].submitted_at).toISOString(), firstSubmission,
    'direct timestamp overwrite is ignored');
  await db.exec("update public.setlists set status='approved' where id=1");
  assert.equal(new Date((await db.query('select submitted_at from public.setlists where id=1')).rows[0].submitted_at).toISOString(), firstSubmission,
    'approval keeps the original submission date');

  await db.exec("update public.setlists set status='pending_review' where id=2");
  assert.ok((await db.query('select submitted_at from public.setlists where id=2')).rows[0].submitted_at, 'first submission stamps a previously undated draft');
  await db.exec("insert into public.setlists(id, status) values (4, 'pending_review')");
  assert.ok((await db.query('select submitted_at from public.setlists where id=4')).rows[0].submitted_at, 'direct pending insertion gets a first-submission time');
  await db.exec("update public.setlists set status='revision_requested' where id=3");
  assert.equal((await db.query('select submitted_at from public.setlists where id=3')).rows[0].submitted_at, null,
    'an undated historical row is not backfilled by a revision status change');

  console.log('Setlist first submission: no backfill, first transition, resubmission, old-client overwrite, and approval passed.');
} finally {
  await db.close();
}
