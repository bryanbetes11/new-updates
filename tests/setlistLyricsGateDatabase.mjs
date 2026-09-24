// Isolated PostgreSQL: never touches live proposals, songs, or notifications.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20260924054602_require_readable_lyrics_for_setlist_review.sql', import.meta.url), 'utf8');
const db = new PGlite();
const org = '00000000-0000-0000-0000-000000000001';
const otherOrg = '00000000-0000-0000-0000-000000000002';
const service = '00000000-0000-0000-0000-000000000011';
const imported = '00000000-0000-0000-0000-000000000012';
const draft = '00000000-0000-0000-0000-000000000021';
const legacy = '00000000-0000-0000-0000-000000000022';
const archival = '00000000-0000-0000-0000-000000000023';
const song = '00000000-0000-0000-0000-000000000031';

try {
  await db.exec(`
    create schema private; create role anon; create role authenticated;
    create table public.events(id uuid primary key,org_id uuid,event_type text);
    create table public.setlists(id uuid primary key,event_id uuid,org_id uuid,status text,updated_at timestamptz default now());
    create table public.songs(id uuid primary key,org_id uuid,title text,lyrics text,chordpro_text text);
    create table public.setlist_songs(id uuid primary key,setlist_id uuid,song_id uuid,org_id uuid,position int);
    insert into public.events values ('${service}','${org}','Sunday Service'),('${imported}','${org}','imported');
    insert into public.setlists(id,event_id,org_id,status) values ('${draft}','${service}','${org}','draft'),('${legacy}','${service}','${org}','approved');
    insert into public.songs values ('${song}','${org}','Chart-only song',null,null);
    insert into public.setlist_songs values ('00000000-0000-0000-0000-000000000041','${draft}','${song}','${org}',1);
  `);
  await db.exec(migration);
  assert.equal((await db.query(`select status from public.setlists where id='${legacy}'`)).rows[0].status, 'approved', 'migration leaves historical approvals unchanged');
  await db.exec(`update public.setlists set updated_at=now() where id='${legacy}'`);

  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'submission names missing song');
  await db.exec(`update public.songs set chordpro_text='{c: Verse 1}\n[G] [C]\nChorus' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'section and chord-only chart cannot submit');
  await db.exec(`update public.songs set chordpro_text='|: C/G D/F# :|\nCmaj7/G  Dsus4/A  |  Am/F' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'slash chords and repeat bars are not lyrics');
  await db.exec(`update public.songs set chordpro_text='https://example.com/chart.pdf' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'file link cannot submit');
  await db.exec(`update public.songs set chordpro_text='![](chart.png)' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'image reference cannot submit');
  await db.exec(`update public.songs set chordpro_text=null,lyrics='Verse 1\nChorus' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Chart-only song/, 'saved headings cannot submit');
  await db.exec(`update public.songs set lyrics=null,chordpro_text='{c: Verse 1}\n[G]Amazing [C]grace' where id='${song}'`);
  await db.exec(`update public.setlists set status='pending_review' where id='${draft}'`);
  assert.equal((await db.query(`select status from public.setlists where id='${draft}'`)).rows[0].status, 'pending_review', 'readable ChordPro lyrics allow submission');
  await db.exec(`update public.songs set chordpro_text=null,lyrics='Jesus, my hope and song' where id='${song}'`);
  await db.exec(`update public.setlists set status='approved' where id='${draft}'`);
  assert.equal((await db.query(`select status from public.setlists where id='${draft}'`)).rows[0].status, 'approved', 'saved lyrics allow approval');

  await db.exec(`update public.setlists set status='draft' where id='${draft}'; update public.songs set org_id='${otherOrg}' where id='${song}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Untitled song/, 'another church song cannot satisfy gate');
  await db.exec(`update public.songs set org_id='${org}' where id='${song}'; delete from public.setlist_songs where setlist_id='${draft}'`);
  await assert.rejects(db.exec(`update public.setlists set status='pending_review' where id='${draft}'`), /Add songs/, 'empty proposal cannot submit');
  await assert.rejects(db.exec(`insert into public.setlists(id,event_id,org_id,status) values ('00000000-0000-0000-0000-000000000024','${service}','${org}','approved')`), /Add songs/, 'ordinary direct approved insert cannot bypass');
  await db.exec(`insert into public.setlists(id,event_id,org_id,status) values ('${archival}','${imported}','${org}','approved')`);
  assert.equal((await db.query(`select status from public.setlists where id='${archival}'`)).rows[0].status, 'approved', 'historical spreadsheet import may insert archive first');
  await assert.rejects(db.exec(`insert into public.setlists(id,event_id,org_id,status) values ('00000000-0000-0000-0000-000000000025','${imported}','${org}','pending_review')`), /Add songs/, 'imported event cannot bypass actual proposal submission');
  await assert.rejects(db.exec(`insert into public.setlists(id,event_id,org_id,status) values ('00000000-0000-0000-0000-000000000026','${imported}','${otherOrg}','approved')`), /Add songs/, 'archive exception is same church only');

  console.log('Setlist lyrics gate: saved/chart lyrics, missing content, tenant scope, empty set, and imported archive exception passed.');
} finally {
  await db.close();
}
