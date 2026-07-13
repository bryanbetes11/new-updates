-- SECURITY DEFINER functions should never inherit the default anonymous EXECUTE grant.
-- Authenticated and service roles keep their existing explicit privileges.
do $$
declare
  function_record record;
begin
  for function_record in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      function_record.function_signature
    );
  end loop;
end;
$$;

-- The invitation preview is intentionally available before sign-in.
grant execute on function public.get_organization_invitation_by_token(text) to anon;

-- High-traffic relationship indexes used by roster, attendance, chat, and setlist flows.
create index if not exists idx_event_assignments_user_id
  on public.event_assignments (user_id);

create index if not exists idx_event_assignments_role_id
  on public.event_assignments (role_id);

create index if not exists idx_event_attendance_user_id
  on public.event_attendance (user_id);

create index if not exists idx_announcement_views_user_id
  on public.announcement_views (user_id);

create index if not exists idx_announcement_comments_announcement_id
  on public.announcement_comments (announcement_id);

create index if not exists idx_messages_sender_id
  on public.messages (sender_id);

create index if not exists idx_messages_reply_to_id
  on public.messages (reply_to_id)
  where reply_to_id is not null;

create index if not exists idx_setlist_songs_song_id
  on public.setlist_songs (song_id);

create index if not exists idx_user_availability_user_id
  on public.user_availability (user_id);

create index if not exists idx_user_availability_target_id
  on public.user_availability (target_id)
  where target_id is not null;

create index if not exists idx_user_availability_requester_assignment_id
  on public.user_availability (requester_assignment_id)
  where requester_assignment_id is not null;

create index if not exists idx_user_availability_target_assignment_id
  on public.user_availability (target_assignment_id)
  where target_assignment_id is not null;
