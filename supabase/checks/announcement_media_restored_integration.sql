-- LOCAL RESTORE ONLY. Run after synthetic tenant fixture and media migration.
do $$ begin
  if current_setting('servesync.isolated_rehearsal',true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off' then raise exception 'Unsafe announcement-media rehearsal'; end if;
end $$;
set local session_replication_role=replica;
update public.announcements set is_leaders_only=true,
  content_blocks=jsonb_build_array(jsonb_build_object('type','image','content',
    'https://example.supabase.co/storage/v1/object/public/announcements/' || pg_temp.fixture_id(1)::text || '/synthetic-a.png'))
where id=pg_temp.fixture_id(311);
update public.announcements set content_blocks=jsonb_build_array(jsonb_build_object('type','image','content',
    'https://example.supabase.co/storage/v1/object/public/announcements/' || pg_temp.fixture_id(9)::text || '/synthetic-b.png'))
where id=pg_temp.fixture_id(312);
insert into storage.objects(bucket_id,name,owner_id) values
  ('announcements',pg_temp.fixture_id(1)::text || '/synthetic-a.png',pg_temp.fixture_id(1)::text),
  ('announcements',pg_temp.fixture_id(9)::text || '/synthetic-b.png',pg_temp.fixture_id(9)::text);
set local session_replication_role=origin;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from storage.objects where bucket_id='announcements' and name like '%synthetic-%.png'), 'Church A leader can sign own leader notice');
reset role;
select pg_temp.login(5);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=0 from storage.objects where bucket_id='announcements' and name like '%synthetic-%.png'), 'Church A ordinary member cannot sign leader notice');
reset role;
select pg_temp.login(10);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from storage.objects where bucket_id='announcements' and name like '%synthetic-%.png'), 'Church B member can sign only own notice');
reset role;
set local role anon;
select pg_temp.assert_ok((select count(*)=0 from storage.objects where bucket_id='announcements' and name like '%synthetic-%.png'), 'Anonymous caller cannot sign notice');
reset role;
select pg_temp.assert_ok((select public is false from storage.buckets where id='announcements'), 'Announcement bucket private');
select 'PASS private leader-only announcement media and Church A/B isolation' as result;
