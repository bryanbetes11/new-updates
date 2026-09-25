-- LOCAL RESTORE ONLY. Run inside the synthetic tenant rehearsal transaction.
do $$ begin
  if current_setting('servesync.isolated_rehearsal', true) is distinct from 'confirmed'
    or current_setting('cron.launch_active_jobs') <> 'off' then
    raise exception 'Unsafe chat-media rehearsal';
  end if;
end $$;

set local session_replication_role=replica;
update public.messages set content=jsonb_build_object(
  'type','image', 'url',
  'https://example.supabase.co/storage/v1/object/public/chat-attachments/' ||
  pg_temp.fixture_id(1)::text || '/files/' || pg_temp.fixture_id(341)::text || '-synthetic.png'
)::text where id=pg_temp.fixture_id(331);
update public.messages set content=jsonb_build_object(
  'type','image', 'url',
  'https://example.supabase.co/storage/v1/object/public/chat-attachments/' ||
  pg_temp.fixture_id(9)::text || '/files/' || pg_temp.fixture_id(342)::text || '-synthetic.png'
)::text where id=pg_temp.fixture_id(332);
insert into storage.objects(bucket_id,name,owner_id) values
  ('chat-attachments',pg_temp.fixture_id(1)::text || '/files/' || pg_temp.fixture_id(341)::text || '-synthetic.png',pg_temp.fixture_id(1)::text),
  ('chat-attachments',pg_temp.fixture_id(9)::text || '/files/' || pg_temp.fixture_id(342)::text || '-synthetic.png',pg_temp.fixture_id(9)::text);
set local session_replication_role=origin;

select pg_temp.login(1);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from storage.objects where bucket_id='chat-attachments' and name like '%synthetic.png'), 'Church A can sign only its referenced media');
reset role;
select pg_temp.login(10);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from storage.objects where bucket_id='chat-attachments' and name like '%synthetic.png'), 'Church B can sign only its referenced media');
reset role;
set local role anon;
select pg_temp.assert_ok((select count(*)=0 from storage.objects where bucket_id='chat-attachments' and name like '%synthetic.png'), 'Anonymous caller cannot sign chat media');
reset role;
select pg_temp.assert_ok((select public is false from storage.buckets where id='chat-attachments'), 'Chat bucket is private');
select 'PASS private chat media visibility for Church A/B and anonymous callers' as result;
