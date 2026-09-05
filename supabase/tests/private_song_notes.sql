-- Safe against an existing database: touches only a unique private-note row,
-- with no notification/activity triggers, then rolls everything back.
begin;
create temporary table private_note_fixture as
select p.id as owner_id, p2.id as other_id, s.id as song_id,
       'qa-private-' || gen_random_uuid()::text as section_key
from public.profiles p join public.profiles p2 on p.org_id=p2.org_id and p.id<>p2.id
join public.songs s on s.org_id=p.org_id limit 1;
grant select on private_note_fixture to authenticated;
do $$ begin if not exists(select 1 from private_note_fixture) then raise exception 'Need two members and a song for isolated RLS checks'; end if; end $$;
select set_config('request.jwt.claim.sub', owner_id::text, true) from private_note_fixture;
set local role authenticated;
insert into public.private_song_notes(user_id,song_id,section_key,note)
select owner_id,song_id,section_key,'private fixture' from private_note_fixture;
do $$ begin
 if (select count(*) from public.private_song_notes n join private_note_fixture f using(song_id,section_key)) <> 1 then raise exception 'Owner cannot read'; end if;
 begin
  insert into public.private_song_notes(user_id,song_id,section_key,note) select other_id,song_id,section_key,'spoof' from private_note_fixture;
  raise exception 'Spoofed owner accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.private_song_notes set user_id=(select other_id from private_note_fixture) where section_key=(select section_key from private_note_fixture);
  raise exception 'Ownership reassignment accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', other_id::text, true) from private_note_fixture;
set local role authenticated;
do $$ declare changed int; begin
 if exists(select 1 from public.private_song_notes n join private_note_fixture f using(song_id,section_key)) then raise exception 'Other member can read private note'; end if;
 update public.private_song_notes set note='attack' where section_key=(select section_key from private_note_fixture);
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Other member changed note'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', owner_id::text, true) from private_note_fixture;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.private_song_notes n join private_note_fixture f using(song_id,section_key) where n.note='private fixture') then raise exception 'Account reopen did not retain note'; end if;
end $$;
update public.private_song_notes set note='' where section_key=(select section_key from private_note_fixture);
insert into public.private_song_notes(user_id,song_id,section_key,note)
select owner_id,song_id,section_key,'old device copy' from private_note_fixture on conflict do nothing;
do $$ begin
 if not exists(select 1 from public.private_song_notes n join private_note_fixture f using(song_id,section_key) where note='') then raise exception 'Import resurrected deleted note'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.private_song_notes; raise exception 'Anon access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner read/write, account reopen, other-user read/update denial, spoof/reassignment denial, deletion tombstone, anonymous denial' as result;
rollback;
