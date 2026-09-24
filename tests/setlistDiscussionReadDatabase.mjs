// Isolated PostgreSQL test: no production members or discussion writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const orgA = '00000000-0000-4000-8000-000000000001';
const orgB = '00000000-0000-4000-8000-000000000002';
const readerA = '00000000-0000-4000-8000-000000000011';
const readerB = '00000000-0000-4000-8000-000000000012';
const reviewerA = '00000000-0000-4000-8000-000000000013';
const setlistA = '00000000-0000-4000-8000-000000000021';
const setlistB = '00000000-0000-4000-8000-000000000022';
const firstView = '2026-09-23T19:46:51.158Z';
const reviewAt = '2026-09-24T04:41:44.236Z';
const commentAt = '2026-09-24T04:44:56.369Z';

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.organizations (id uuid primary key);
    create table public.profiles (id uuid primary key);
    create table public.setlists (
      id uuid primary key, org_id uuid not null, status text not null,
      reviewed_by uuid, reviewed_at timestamptz, review_note text, approval_notes text
    );
    create table public.setlist_revision_comments (
      id uuid primary key, org_id uuid not null, setlist_id uuid not null,
      user_id uuid not null, content text not null, reply_to uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    insert into public.organizations values ('${orgA}'), ('${orgB}');
    insert into public.profiles values ('${readerA}'), ('${readerB}'), ('${reviewerA}');
    insert into public.setlists (id, org_id, status, reviewed_by, reviewed_at, review_note)
      values ('${setlistA}', '${orgA}', 'revision_requested', '${reviewerA}', '${reviewAt}', 'Please revise'),
             ('${setlistB}', '${orgB}', 'pending_review', null, null, null);
    insert into public.setlist_revision_comments
      (id, org_id, setlist_id, user_id, content, created_at, updated_at)
      values ('00000000-0000-4000-8000-000000000031', '${orgA}', '${setlistA}', '${reviewerA}',
        'New revision note', '${commentAt}', '${commentAt}');
    insert into public.setlist_revision_comments
      (id, org_id, setlist_id, user_id, content, created_at, updated_at)
      values ('00000000-0000-4000-8000-000000000033', '${orgA}', '${setlistA}', '${readerA}',
        'Earlier comment', '2026-09-23T19:40:00.000Z', '2026-09-23T19:40:00.000Z');
    create function public.auth_org_id() returns uuid language sql stable as $$
      select nullif(current_setting('test.org', true), '')::uuid
    $$;
    create function public.can_access_setlist_revision_discussion(p_setlist_id uuid)
      returns boolean language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.setlists s
        where s.id = p_setlist_id
          and s.org_id = public.auth_org_id()
          and (s.org_id = '${orgA}' and auth.uid() in ('${readerA}'::uuid, '${reviewerA}'::uuid)
            or s.org_id = '${orgB}' and auth.uid() = '${readerB}'::uuid)
      )
    $$;
    grant select, update on public.setlists to authenticated;
    grant select, insert, update on public.setlist_revision_comments to authenticated;
    alter table public.setlist_revision_comments enable row level security;
    create policy comment_select on public.setlist_revision_comments for select to authenticated
      using (org_id = public.auth_org_id());
    create policy comment_insert on public.setlist_revision_comments for insert to authenticated
      with check (org_id = public.auth_org_id() and user_id = auth.uid());
    create policy comment_update on public.setlist_revision_comments for update to authenticated
      using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());
  `);
  const original = await readFile(new URL('../supabase/migrations/20260907110000_add_setlist_revision_discussion_views.sql', import.meta.url), 'utf8');
  await db.exec(original);
  await db.query(`insert into public.setlist_revision_discussion_views (org_id, setlist_id, user_id, viewed_at)
    values ($1, $2, $3, $4)`, [orgA, setlistA, readerA, firstView]);
  await db.query(`insert into public.setlist_revision_discussion_views (org_id, setlist_id, user_id, viewed_at)
    values ($1, $2, $3, $4)`, [orgA, setlistA, reviewerA, '2026-09-23T19:45:00.000Z']);

  const migration = await readFile(new URL('../supabase/migrations/20260924052340_track_current_setlist_revision_discussion_reads.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const authorMigration = await readFile(new URL('../supabase/migrations/20260924053709_credit_setlist_revision_discussion_authors.sql', import.meta.url), 'utf8');
  await db.exec(authorMigration);
  const as = async (role, user = '', org = '') => {
    await db.exec(`reset role; set role ${role}; set test.uid = '${user}'; set test.org = '${org}';`);
  };
  const read = setlistId => db.query(
    'select record_setlist_revision_discussion_read($1) as read_at', [setlistId],
  );
  const receipt = async setlistId => (await db.query(
    'select user_id, viewed_at, last_viewed_at from public.setlist_revision_discussion_views where setlist_id = $1',
    [setlistId],
  )).rows;

  await as('authenticated', readerA, orgA);
  const before = await receipt(setlistA);
  const oldReader = before.find(row => row.user_id === readerA);
  const noteAuthor = before.find(row => row.user_id === reviewerA);
  assert.equal(new Date(oldReader.viewed_at).toISOString(), firstView);
  assert.equal(new Date(oldReader.last_viewed_at).toISOString(), firstView,
    'migration preserves the historical read time');
  assert.equal(new Date(noteAuthor.viewed_at).toISOString(), '2026-09-23T19:45:00.000Z');
  assert.equal(new Date(noteAuthor.last_viewed_at).toISOString(), commentAt,
    'author backfill advances to the latest authored note without rewriting first view');
  await assert.rejects(db.query(`update public.setlist_revision_discussion_views
    set last_viewed_at = '2099-01-01' where setlist_id = $1`, [setlistA]), /permission denied/);
  await assert.rejects(db.query(`insert into public.setlist_revision_discussion_views
    (org_id, setlist_id, user_id, viewed_at) values ($1, $2, $3, '2099-01-01')`,
    [orgA, setlistA, readerB]), /permission denied/);

  const serverRead = (await read(setlistA)).rows[0].read_at;
  const after = await receipt(setlistA);
  const currentReader = after.find(row => row.user_id === readerA);
  assert.equal(new Date(currentReader.viewed_at).toISOString(), firstView,
    'a later read does not rewrite the first view');
  assert.ok(new Date(currentReader.last_viewed_at) > new Date(firstView),
    'a later read advances to a server time after the latest note');
  assert.equal(new Date(serverRead).toISOString(), new Date(currentReader.last_viewed_at).toISOString(),
    'RPC returns the timestamp actually stored');
  assert.equal((await db.query('select record_setlist_revision_discussion_view($1) as inserted', [setlistA])).rows[0].inserted, false,
    'installed clients still receive the old first-view response');

  await assert.rejects(read(setlistB), /inaccessible/);
  await as('authenticated', readerB, orgB);
  await assert.rejects(read(setlistA), /inaccessible/);
  assert.equal((await receipt(setlistA)).length, 0, 'another organization cannot inspect receipts');
  await assert.rejects(db.query(`insert into public.setlist_revision_comments
    (id, org_id, setlist_id, user_id, content)
    values ('00000000-0000-4000-8000-000000000034', $1, $2, $3, 'Cross-org note')`,
  [orgA, setlistA, readerB]), /row-level security/);
  await assert.rejects(db.query(`select private.credit_setlist_revision_discussion_author(
    $1, $2, $3, now())`, [orgA, setlistA, readerB]), /permission denied/);
  assert.equal((await db.query('select record_setlist_revision_discussion_view($1) as inserted', [setlistB])).rows[0].inserted, true,
    'installed clients can still create a first-view receipt');
  await read(setlistB);
  const ownReceipt = await receipt(setlistB);
  assert.equal(ownReceipt.length, 1);
  assert.equal(ownReceipt[0].user_id, readerB, 'the server records only the signed-in member');
  await assert.rejects(db.query(`update public.setlists set review_note = 'wrong church',
    reviewed_by = $1, reviewed_at = '2099-01-01' where id = $2`, [readerB, setlistA]),
  /another church/);

  await as('authenticated', reviewerA, orgA);
  await assert.rejects(db.query(`update public.setlists set review_note = 'forged reviewer',
    reviewed_by = $1, reviewed_at = '2099-01-01' where id = $2`, [readerA, setlistA]),
  /signed-in user/);
  await db.query(`update public.setlists set review_note = 'A clearer revision request',
    reviewed_by = $1, reviewed_at = '2099-01-01' where id = $2`, [reviewerA, setlistA]);
  const stampedReview = (await db.query('select reviewed_at from public.setlists where id = $1', [setlistA])).rows[0].reviewed_at;
  assert.ok(new Date(stampedReview).getTime() < Date.parse('2099-01-01'),
    'a new review request uses the database clock, not a supplied future date');
  let authorReceipt = (await receipt(setlistA)).find(row => row.user_id === reviewerA);
  assert.equal(new Date(authorReceipt.viewed_at).toISOString(), '2026-09-23T19:45:00.000Z');
  assert.equal(new Date(authorReceipt.last_viewed_at).toISOString(), new Date(stampedReview).toISOString(),
    'the reviewer is credited at the persisted review activity time');

  const newCommentId = '00000000-0000-4000-8000-000000000032';
  const insertedComment = (await db.query(`insert into public.setlist_revision_comments
    (id, org_id, setlist_id, user_id, content, created_at)
    values ($1, $2, $3, $4, 'New comment', '2099-01-01') returning created_at`,
  [newCommentId, orgA, setlistA, reviewerA])).rows[0];
  assert.ok(new Date(insertedComment.created_at).getTime() < Date.parse('2099-01-01'),
    'new comments also receive a server activity time');
  authorReceipt = (await receipt(setlistA)).find(row => row.user_id === reviewerA);
  assert.equal(new Date(authorReceipt.last_viewed_at).toISOString(), new Date(insertedComment.created_at).toISOString(),
    'a newly written comment credits its author at its own timestamp');

  await as('authenticated', readerA, orgA);
  await db.query(`update public.setlist_revision_comments set content = 'Edited by another member'
    where id = $1`, [newCommentId]);
  const editedAt = (await db.query('select updated_at from public.setlist_revision_comments where id = $1',
    [newCommentId])).rows[0].updated_at;
  const editReceipts = await receipt(setlistA);
  assert.equal(new Date(editReceipts.find(row => row.user_id === readerA).last_viewed_at).toISOString(),
    new Date(editedAt).toISOString(), 'an edit credits the actual editor');
  assert.equal(new Date(editReceipts.find(row => row.user_id === reviewerA).last_viewed_at).toISOString(),
    new Date(insertedComment.created_at).toISOString(), 'an edit does not falsely credit the original author');

  await as('anon');
  await assert.rejects(read(setlistA), /permission denied/);
  console.log('PASS setlist discussion read DB: historical authorship, server time, actual editor, no forged writes, old RPC, tenant bounds');
} finally {
  await db.close();
}
