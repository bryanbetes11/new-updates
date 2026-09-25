import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20260925011030_remove_unused_internal_leadership_notes.sql', import.meta.url), 'utf8');

async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create table public.profiles (id integer primary key, leadership_notes text);
    create table public.discipline_records (id integer primary key, leader_notes text);
  `);
  return db;
}

const populated = await makeDb();
await populated.exec("insert into public.profiles values (1, 'Needs private review')");
await assert.rejects(populated.exec(migration), /Internal leadership notes contain data/);
const retained = await populated.query('select leadership_notes from public.profiles where id = 1');
assert.equal(retained.rows[0].leadership_notes, 'Needs private review');
await populated.close();

const discipline = await makeDb();
await discipline.exec("insert into public.discipline_records values (1, 'Private context')");
await assert.rejects(discipline.exec(migration), /Internal leadership notes contain data/);
const retainedDiscipline = await discipline.query('select leader_notes from public.discipline_records where id = 1');
assert.equal(retainedDiscipline.rows[0].leader_notes, 'Private context');
await discipline.close();

const empty = await makeDb();
await empty.exec("insert into public.profiles values (1, ''), (2, '   ')");
await empty.exec('insert into public.discipline_records values (1, null)');
await empty.exec(migration);
const columns = await empty.query(`
  select table_name, column_name from information_schema.columns
  where table_schema = 'public' and column_name in ('leadership_notes', 'leader_notes')
`);
assert.equal(columns.rows.length, 0);
await empty.close();

console.log('PASS internal notes migration: populated guard and unused-column removal');
