// Isolated PostgreSQL; no production data, push hooks, or network requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260912183404_announcement_reaction_notifications.sql', import.meta.url), 'utf8');
const deliveryMigration = await readFile(new URL('../supabase/migrations/20260909055525_event_type_wording_and_out_today.sql', import.meta.url), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    create table organizations(id uuid primary key);
    create table profiles(id uuid primary key, org_id uuid, first_name text, last_name text);
    create table roles(id uuid primary key, is_leadership boolean);
    create table user_roles(user_id uuid, role_id uuid, org_id uuid);
    create function public.auth_org_id() returns uuid language sql stable security definer set search_path='' as
      $$select org_id from public.profiles where id=auth.uid()$$;
    create function public.auth_is_org_leader() returns boolean language sql stable security definer set search_path='' as
      $$select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=auth.uid() and ur.org_id=public.auth_org_id() and r.is_leadership)$$;
    create table announcements(id uuid primary key, org_id uuid, title text, is_leaders_only boolean);
    alter table announcements enable row level security;
    create policy visible on announcements for select to authenticated using
      (org_id=public.auth_org_id() and (not coalesce(is_leaders_only,false) or public.auth_is_org_leader()));
    create table announcement_reactions(id uuid primary key, announcement_id uuid references announcements(id),
      org_id uuid, user_id uuid, emoji text, unique(announcement_id,user_id,emoji));
    alter table announcement_reactions enable row level security;
    create policy "Users can view same-org announcement reactions" on announcement_reactions for select to authenticated using(org_id=auth_org_id());
    create policy "Users can add same-org announcement reactions" on announcement_reactions for insert to authenticated with check(user_id=auth.uid() and org_id=auth_org_id());
    create policy remove_own on announcement_reactions for delete to authenticated using(user_id=auth.uid() and org_id=auth_org_id());
    create table notification_rules(org_id uuid, type text, label text, category text, description text,
      target_roles text[], enabled boolean, required boolean, in_app_enabled boolean, push_enabled boolean,
      priority text, template_title text, template_body text, event_type_templates jsonb default '{}', unique(org_id,type));
    create table notifications(user_id uuid, org_id uuid, type text, title text, body text, data jsonb, dedupe_key text,
      category text, priority text, required boolean, delivery_channels jsonb, scheduled_for timestamptz, push_status text);
    create table events(id uuid,org_id uuid,title text,event_type text,event_date date,start_time time);
    create table notification_preferences(user_id uuid, org_id uuid, muted_types text[], in_app_enabled boolean, push_enabled boolean);
    create table notification_system_settings(org_id uuid,push_delivery_enabled boolean);
    create unique index notification_dedupe on notifications(user_id,dedupe_key) where dedupe_key is not null;
    grant usage on schema public,auth to authenticated;
    grant select on announcements to authenticated;
    grant select,insert,delete on announcement_reactions to authenticated;
    insert into organizations values('${id(1)}'),('${id(2)}');
    insert into profiles values
      ('${id(11)}','${id(1)}','Alex','Member'),('${id(12)}','${id(1)}','Sam','Member'),
      ('${id(13)}','${id(1)}','Pat','Leader'),('${id(14)}','${id(1)}','Chris','Leader'),
      ('${id(21)}','${id(2)}','Other','Church');
    insert into roles values('${id(90)}',true);
    insert into user_roles values('${id(13)}','${id(90)}','${id(1)}'),('${id(14)}','${id(90)}','${id(1)}'),
      ('${id(14)}','${id(90)}','${id(1)}');
    insert into announcements values('${id(31)}','${id(1)}','Revamp Rescheduled',false),
      ('${id(32)}','${id(1)}','Private leadership update',true),('${id(33)}','${id(2)}','Other church',false);
    insert into announcement_reactions values('${id(40)}','${id(31)}','${id(1)}','${id(12)}','👍');
  `);
  for (const name of ['render_notification_template','notification_template_has_placeholders','configure_notification_insert']) {
    const definition = deliveryMigration.match(new RegExp(`create or replace function private\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0];
    assert(definition, `Actual notification pipeline function ${name} found`);
    await db.exec(definition);
  }
  await db.exec('create trigger configure before insert on notifications for each row execute function private.configure_notification_insert();');
  await db.exec(migration);
  const rows = async sql => (await db.query(sql)).rows;
  assert.equal((await rows('select count(*)::int as n from notifications'))[0].n, 0, 'no historical reaction notifications');
  assert.equal((await rows('select count(*)::int as n from notification_rules'))[0].n, 2, 'existing churches seeded');
  await db.exec(`insert into organizations values('${id(3)}');`);
  assert.equal((await rows('select count(*)::int as n from notification_rules'))[0].n, 3, 'future churches seeded');
  await db.exec(`update notification_rules set enabled=false where org_id='${id(1)}'; select private.seed_announcement_reaction_rule('${id(1)}');`);
  assert.equal((await rows(`select enabled from notification_rules where org_id='${id(1)}'`))[0].enabled, false, 'seeding preserves saved controls');
  await db.exec(`update notification_rules set enabled=true where org_id='${id(1)}';`);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(11)}';`);
  const reaction = (rid, announcement, actor, emoji='❤️', org=1) =>
    `insert into announcement_reactions values('${id(rid)}','${id(announcement)}','${id(org)}','${id(actor)}','${emoji}');`;
  await db.exec(reaction(41,31,11));
  await assert.rejects(db.exec(reaction(42,31,11)), /duplicate/i, 'duplicate insertion rejected');
  await assert.rejects(db.exec(reaction(43,32,11)), /row-level security/i, 'member cannot react to leaders-only announcement');
  await assert.rejects(db.exec(reaction(44,33,11)), /row-level security/i, 'forged same-org reaction on other church announcement rejected');
  await assert.rejects(db.exec(reaction(45,31,12,'😮')), /row-level security/i, 'cannot impersonate another member');
  await db.exec('reset role;');
  const sent = await rows('select * from notifications order by user_id');
  assert.deepEqual(sent.map(n=>n.user_id), [id(12),id(13),id(14)], 'all other same-church users, including author/leadership');
  assert(sent.every(n=>n.type==='announcement_reaction' && n.org_id===id(1)));
  assert.equal(sent[0].body, 'Alex Member reacted ❤️ (Love) to “Revamp Rescheduled”.');
  assert.equal(sent[0].data.reaction, '❤️');
  assert.equal(sent[0].data.url, `/announcements/${id(31)}`);
  assert.deepEqual(sent[0].delivery_channels, {in_app:true,push:true}, 'normal in-app and push pipeline used');
  assert.equal(sent[0].push_status, 'pending', 'push queued, not claimed delivered');
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(11)}'; delete from announcement_reactions where id='${id(41)}'; reset role;`);
  assert.equal((await rows('select count(*)::int as n from notifications'))[0].n, 3, 'removal does not notify');
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(13)}'; ${reaction(46,32,13,'👍')} reset role;`);
  const leaders = await rows(`select * from notifications where data->>'announcement_id'='${id(32)}'`);
  assert.deepEqual(leaders.map(n=>n.user_id), [id(14)], 'only another eligible leader; duplicate role does not duplicate notification');
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(11)}';`);
  assert.equal((await rows(`select count(*)::int as n from announcement_reactions where announcement_id='${id(32)}'`))[0].n, 0, 'private reactions hidden from members');
  await db.exec('reset role;');
  await db.exec(`update notification_rules set enabled=false where org_id='${id(1)}';
    set role authenticated; set request.jwt.claim.sub='${id(11)}'; ${reaction(47,31,11,'😂')} reset role;`);
  assert.equal((await rows('select count(*)::int as n from notifications'))[0].n,4,'disabled rule suppresses alerts without rejecting the reaction');
  await db.exec(`update notification_rules set enabled=true where org_id='${id(1)}';
    insert into notification_preferences values('${id(12)}','${id(1)}',array['announcement_reaction'],true,true);
    insert into notification_system_settings values('${id(1)}',false);
    set role authenticated; set request.jwt.claim.sub='${id(11)}'; ${reaction(48,31,11,'😮')} reset role;`);
  const muted = await rows(`select * from notifications where data->>'reaction_id'='${id(48)}'`);
  assert.deepEqual(muted.map(n=>n.user_id).sort(),[id(13),id(14)],'recipient mute preference respected');
  assert(muted.every(n=>n.push_status==='not_requested' && n.delivery_channels.in_app),'master push switch respected');
  for (const role of ['anon','authenticated']) {
    const privileges = await rows(`select has_function_privilege('${role}','private.notify_announcement_reaction()','EXECUTE') as allowed`);
    assert.equal(privileges[0].allowed, false, 'no directly callable privileged notification producer');
  }
  console.log('Announcement reaction notifications: recipient scope, private audience, RLS, copy/link, duplicates, removal, rule seeding, and grants passed.');
} finally { await db.close(); }
