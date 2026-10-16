// Execute the migration in isolated Postgres; there is no HTTP worker or real recipient.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20261013092058_repair_survey_and_background_requests.sql', import.meta.url), 'utf8');
const original = (await readFile(new URL('../supabase/migrations/20260811122304_ministry_reflection_campaigns.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const originalFunction = original.slice(original.indexOf('create or replace function private.check_survey_campaign_timing()'), original.indexOf('\ndo $$ begin\n  perform cron.unschedule', original.indexOf('create or replace function private.check_survey_campaign_timing()')));
const rows = async sql => (await db.query(sql)).rows;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`
    create schema private; create schema cron;
    create role anon; create role authenticated;
    create table survey_campaigns(id uuid primary key, org_id uuid, status text, starts_at timestamptz, updated_at timestamptz);
    create table survey_participations(id uuid primary key, campaign_id uuid, user_id uuid, status text, temporary_access_until timestamptz, submitted_at timestamptz);
    create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, org_id uuid, type text, title text, body text, data jsonb,
      delivery_channels jsonb, dedupe_key text, created_at timestamptz default now(), push_status text default 'pending', is_read boolean default false);
    create unique index notifications_recipient_dedupe_idx on notifications(user_id,dedupe_key) where dedupe_key is not null;
    create table cron.job(jobid bigint primary key, jobname text, schedule text, active boolean, command text);
    create function cron.alter_job(job_id bigint, command text) returns void language sql as
      'update cron.job set command=$2 where jobid=$1';
  `);
  await db.exec(originalFunction);
  await db.exec('revoke all on function private.check_survey_campaign_timing() from public,anon,authenticated;');
  await assert.rejects(db.query('select private.check_survey_campaign_timing()'), /no unique or exclusion constraint/, 'reproduces the production failure even with no due rows');
  const jobNames = ['check-attendance-timed-reminders','check-attendance-mark-absent','check-attendance-remind','check-attendance-missed-evening','check-attendance-missed-final'];
  for (let n = 0; n < jobNames.length; n++) {
    await db.query('insert into cron.job values ($1,$2,$3,$4,$5)', [n + 1, jobNames[n], n ? '0 1 * * *' : '* * * * *', n !== 1,
      "select net.http_post(url := 'https://fixture.invalid/check-attendance?action=remind', headers := '{\"x-internal-secret\":\"fixture-only\"}', body := '{}'::jsonb);"]);
  }
  await db.exec("insert into cron.job values (20,'unrelated','*/15 * * * *',true,'select 1');");
  await db.query('insert into notifications(id,user_id,type,title,body,data,push_status,created_at,is_read) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id(900), id(901), 'setlist_revision', 'Complete inbox record', 'x'.repeat(1091), { url: '/setlists/example' }, 'dispatching', '2026-09-24T04:41:46Z', true]);
  await db.query('insert into notifications(user_id,type,body,push_status,created_at) values ($1,$2,$3,$4,now())', [id(902), 'setlist_revision', 'x'.repeat(1091), 'dispatching']);
  const beforeJobs = await rows('select * from cron.job order by jobid');
  const oldInbox = (await rows(`select * from notifications where id='${id(900)}'`))[0];
  await db.exec(migration);
  const repairedJobs = await rows('select * from cron.job order by jobid');
  for (let n = 0; n < jobNames.length; n++) {
    assert.equal(repairedJobs[n].command, beforeJobs[n].command.replace("body := '{}'::jsonb", "body := '{}'::jsonb, timeout_milliseconds := 15000"));
    assert.deepEqual({ ...repairedJobs[n], command: beforeJobs[n].command }, beforeJobs[n], 'schedule, auth and active flag are preserved');
  }
  assert.deepEqual(repairedJobs.at(-1), beforeJobs.at(-1), 'unrelated job unchanged');
  const retainedInbox = (await rows(`select * from notifications where id='${id(900)}'`))[0];
  assert.equal(retainedInbox.push_status, 'failed');
  assert.deepEqual({ ...retainedInbox, push_status: oldInbox.push_status }, oldInbox, 'full text, data and read state stay intact');
  assert.equal((await rows(`select push_status from notifications where user_id='${id(902)}'`))[0].push_status, 'dispatching', 'current notifications are untouched');
  await db.exec(migration);
  assert.deepEqual(await rows('select * from cron.job order by jobid'), repairedJobs, 'migration rerun is safe');
  assert.equal((await rows("select has_function_privilege('anon','private.check_survey_campaign_timing()','execute') allowed"))[0].allowed, false);
  assert.equal((await rows("select has_function_privilege('authenticated','private.check_survey_campaign_timing()','execute') allowed"))[0].allowed, false);
  for (const [n, status, time] of [[1,'live',"now()-interval '1 day'"],[2,'closed','now()'],[3,'paused','now()'],[4,'scheduled',"now()-interval '1 minute'"],[5,'scheduled',"now()+interval '1 day'"]]) {
    await db.exec(`insert into survey_campaigns values ('${id(n)}','${id(n===4?102:101)}','${status}',${time},now());`);
  }
  const parts = [[11,1,'60 minutes',false],[12,1,'-1 minute',false],[13,2,'-1 minute',false],[14,3,'60 minutes',false],[15,1,'60 minutes',true],[16,4,'60 minutes',false],[17,5,'60 minutes',false],[18,1,'76 minutes',false],[19,1,'44 minutes',false],[20,1,'-1 minute',true]];
  for (const [n, campaign, delay, submitted] of parts) {
    await db.exec(`insert into survey_participations values ('${id(n)}','${id(campaign)}','${id(n+200)}','temporary_access_active',now()+interval '${delay}',${submitted?'now()':'null'});`);
  }
  await db.exec(`insert into notifications(user_id,dedupe_key) values ('${id(999)}','survey-access-hour:${id(11)}');`);
  await db.exec('select private.check_survey_campaign_timing(); select private.check_survey_campaign_timing();');
  const notices = await rows("select * from notifications where type like 'survey_access_%' order by user_id");
  assert.equal(notices.length, 3, 'repeat runs do not duplicate expiring/expired notices');
  assert.deepEqual(notices.map(n => n.user_id), [id(211), id(212), id(216)]);
  assert.equal(notices[2].org_id, id(102), 'campaign organization is preserved');
  assert.ok(notices.every(n => n.data.url === '/reflection' && n.delivery_channels.in_app && n.delivery_channels.push));
  assert.equal((await rows(`select status from survey_participations where id='${id(12)}'`))[0].status, 'access_expired');
  assert.equal((await rows(`select status from survey_participations where id='${id(13)}'`))[0].status, 'access_expired', 'closed campaign still records expired access without a reminder');
  assert.equal((await rows(`select status from survey_participations where id='${id(20)}'`))[0].status, 'temporary_access_active', 'submitted records are not overwritten');
  assert.equal((await rows(`select status from survey_campaigns where id='${id(4)}'`))[0].status, 'live');
  assert.equal((await rows(`select status from survey_campaigns where id='${id(5)}'`))[0].status, 'scheduled');
  await db.exec("begin; update cron.job set command='unexpected request' where jobid=1;");
  await assert.rejects(db.exec(migration), /did not match/, 'unexpected job text fails instead of replacing unrelated content');
  await db.exec('rollback;');
  assert.deepEqual(await rows('select * from cron.job order by jobid'), repairedJobs);
  console.log('PASS survey/background repair: reproduced failure, recipient dedupe, timing boundaries, campaign lifecycle, submitted data, retained inbox, schedules/auth, idempotency, safe mismatch rollback');
} catch (error) {
  console.error('FAIL survey/background repair:', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
