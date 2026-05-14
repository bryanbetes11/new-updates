-- ============================================================================
-- Church-scoped activity log
-- ----------------------------------------------------------------------------
-- Captures high-level product activity for the owner account's own church only.
-- Chat/conversation tables are intentionally excluded for member privacy.
-- ============================================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  org_name text,
  actor_id uuid,
  actor_name text,
  actor_email text,
  target_user_id uuid,
  target_user_name text,
  target_user_email text,
  category text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'database',
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_org_created_at_idx
  on public.activity_logs (org_id, created_at desc);

create index if not exists activity_logs_category_created_at_idx
  on public.activity_logs (category, created_at desc);

create index if not exists activity_logs_actor_created_at_idx
  on public.activity_logs (actor_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Platform owner can view activity logs" on public.activity_logs;
drop policy if exists "Platform owner can view own church activity logs" on public.activity_logs;
create policy "Platform owner can view own church activity logs"
  on public.activity_logs
  for select
  to authenticated
  using (
    (select public.is_platform_owner())
    and org_id = (select public.auth_org_id())
  );

revoke all on table public.activity_logs from anon, authenticated;
grant select on table public.activity_logs to authenticated;

comment on table public.activity_logs is
  'Owner-only activity stream for the current church. Chat/conversation activity and private body text are intentionally excluded.';

create or replace function public.activity_try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or trim(p_value) = '' then
    return null;
  end if;

  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.activity_display_name(
  p_first_name text,
  p_last_name text,
  p_nickname text,
  p_email text
)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(trim(coalesce(p_nickname, '')), ''),
    nullif(trim(concat_ws(' ', nullif(trim(coalesce(p_first_name, '')), ''), nullif(trim(coalesce(p_last_name, '')), ''))), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    'Unknown user'
  );
$$;

create or replace function public.activity_changed_fields(p_old jsonb, p_new jsonb)
returns text[]
language sql
stable
set search_path = public
as $$
  with keys as (
    select field_name as key
    from jsonb_object_keys(coalesce(p_old, '{}'::jsonb) || coalesce(p_new, '{}'::jsonb)) as fields(field_name)
  ),
  changed as (
    select key
    from keys
    where key <> all(array[
      'id',
      'org_id',
      'created_at',
      'updated_at',
      'submitted_at',
      'reviewed_at',
      'analyzed_at',
      'decided_at',
      'pinned_at',
      'sent_at',
      'marked_at',
      'override_at',
      'checked_in_at',
      'accepted_at',
      'target_response_at',
      'leadership_response_at',
      'is_typing_expires_at',
      'last_read_at',
      'last_checker_run_at'
    ]::text[])
    and coalesce(p_old -> key, 'null'::jsonb) is distinct from coalesce(p_new -> key, 'null'::jsonb)
  )
  select coalesce(array_agg(key order by key), '{}'::text[])
  from changed;
$$;

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  old_data jsonb := '{}'::jsonb;
  changed_fields text[] := '{}'::text[];
  actor_id uuid;
  target_user_id uuid;
  org_id uuid;
  entity_id uuid;
  actor_name text;
  actor_email text;
  target_user_name text;
  target_user_email text;
  org_name text;
  category text := coalesce(nullif(TG_ARGV[0], ''), 'system');
  entity_type text := coalesce(nullif(TG_ARGV[1], ''), TG_TABLE_NAME);
  action text;
  summary text;
  entity_label text;
  event_title text;
  song_title text;
  setlist_event_title text;
  announcement_title text;
  role_name text;
  request_kind text;
  operation_label text;
  metadata jsonb;
begin
  if TG_OP = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := to_jsonb(old);
  elsif TG_OP = 'UPDATE' then
    row_data := to_jsonb(new);
    old_data := to_jsonb(old);
    changed_fields := public.activity_changed_fields(old_data, row_data);

    if coalesce(array_length(changed_fields, 1), 0) = 0 then
      return null;
    end if;
  else
    row_data := to_jsonb(new);
  end if;

  entity_id := public.activity_try_uuid(row_data ->> 'id');
  org_id := public.activity_try_uuid(row_data ->> 'org_id');
  actor_id := (select auth.uid());

  if actor_id is null then
    actor_id := coalesce(
      public.activity_try_uuid(row_data ->> 'reviewed_by'),
      public.activity_try_uuid(row_data ->> 'approved_by'),
      public.activity_try_uuid(row_data ->> 'resolved_by'),
      public.activity_try_uuid(row_data ->> 'marked_by'),
      public.activity_try_uuid(row_data ->> 'override_by'),
      public.activity_try_uuid(row_data ->> 'pinned_by'),
      public.activity_try_uuid(row_data ->> 'sent_by'),
      public.activity_try_uuid(row_data ->> 'updated_by'),
      public.activity_try_uuid(row_data ->> 'submitted_by'),
      public.activity_try_uuid(row_data ->> 'uploaded_by'),
      public.activity_try_uuid(row_data ->> 'created_by'),
      public.activity_try_uuid(row_data ->> 'user_id')
    );
  end if;

  target_user_id := coalesce(
    public.activity_try_uuid(row_data ->> 'user_id'),
    public.activity_try_uuid(row_data ->> 'target_id'),
    public.activity_try_uuid(row_data ->> 'submitted_by')
  );

  metadata := jsonb_build_object(
    'operation', lower(TG_OP),
    'table', TG_TABLE_NAME,
    'changed_fields', to_jsonb(changed_fields)
  );

  if TG_OP = 'UPDATE' and old_data ? 'status' and row_data ? 'status' and old_data ->> 'status' is distinct from row_data ->> 'status' then
    metadata := metadata || jsonb_build_object('from_status', old_data ->> 'status', 'to_status', row_data ->> 'status');
  end if;

  if TG_OP = 'UPDATE' and old_data ? 'event_date' and row_data ? 'event_date' and old_data ->> 'event_date' is distinct from row_data ->> 'event_date' then
    metadata := metadata || jsonb_build_object('from_date', old_data ->> 'event_date', 'to_date', row_data ->> 'event_date');
  end if;

  operation_label := case TG_OP
    when 'INSERT' then 'created'
    when 'UPDATE' then 'updated'
    when 'DELETE' then 'deleted'
    else lower(TG_OP)
  end;

  case TG_TABLE_NAME
    when 'organizations' then
      org_id := entity_id;
      org_name := row_data ->> 'name';
      entity_label := coalesce(row_data ->> 'name', 'Church');
      action := 'organization.' || lower(operation_label);
      summary := 'Church ' || operation_label || ': ' || entity_label;

    when 'profiles' then
      org_id := public.activity_try_uuid(row_data ->> 'org_id');
      target_user_id := entity_id;
      entity_label := public.activity_display_name(row_data ->> 'first_name', row_data ->> 'last_name', row_data ->> 'nickname', row_data ->> 'email');
      if TG_OP = 'INSERT' then
        action := 'account.profile_created';
        summary := 'User profile created: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'account.profile_deleted';
        summary := 'User profile deleted: ' || entity_label;
      elsif 'is_onboarded' = any(changed_fields) and row_data ->> 'is_onboarded' = 'true' then
        action := 'account.onboarding_completed';
        summary := 'Onboarding completed: ' || entity_label;
      elsif 'ministry_status' = any(changed_fields) then
        action := 'member.ministry_status_changed';
        summary := 'Ministry status changed for ' || entity_label;
      elsif 'avatar_url' = any(changed_fields) then
        action := 'account.avatar_updated';
        summary := 'Avatar updated for ' || entity_label;
      elsif 'is_org_admin' = any(changed_fields) then
        action := 'member.org_admin_changed';
        summary := 'Church admin access changed for ' || entity_label;
      else
        action := 'account.profile_updated';
        summary := 'Profile updated: ' || entity_label;
      end if;

    when 'organization_invitations' then
      org_id := public.activity_try_uuid(row_data ->> 'org_id');
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'invited_by'));
      target_user_email := row_data ->> 'email';
      entity_label := coalesce(target_user_email, 'Invitation');
      metadata := metadata || jsonb_build_object('invite_email', target_user_email);
      if TG_OP = 'INSERT' then
        action := 'organization.invite_created';
        summary := 'Invite created for ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'organization.invite_deleted';
        summary := 'Invite deleted for ' || entity_label;
      elsif old_data ->> 'accepted_at' is null and row_data ->> 'accepted_at' is not null then
        action := 'organization.invite_accepted';
        summary := 'Invite accepted by ' || entity_label;
      else
        action := 'organization.invite_updated';
        summary := 'Invite updated for ' || entity_label;
      end if;

    when 'organization_payment_submissions' then
      org_id := public.activity_try_uuid(row_data ->> 'org_id');
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'reviewed_by'), public.activity_try_uuid(row_data ->> 'submitted_by'));
      target_user_id := public.activity_try_uuid(row_data ->> 'submitted_by');
      entity_label := coalesce(row_data ->> 'billing_reference', 'Payment submission');
      metadata := metadata || jsonb_build_object('plan_code', row_data ->> 'plan_code', 'amount', row_data ->> 'amount');
      if TG_OP = 'INSERT' then
        action := 'billing.payment_submitted';
        summary := 'Payment submitted: ' || entity_label;
      elsif TG_OP = 'UPDATE' and old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'billing.payment_' || coalesce(row_data ->> 'status', 'updated');
        summary := 'Payment ' || replace(coalesce(row_data ->> 'status', 'updated'), '_', ' ') || ': ' || entity_label;
      else
        action := 'billing.payment_updated';
        summary := 'Payment submission updated: ' || entity_label;
      end if;

    when 'user_roles' then
      org_id := public.activity_try_uuid(row_data ->> 'org_id');
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select r.name into role_name from public.roles r where r.id = public.activity_try_uuid(row_data ->> 'role_id');
      entity_label := coalesce(role_name, 'Role');
      metadata := metadata || jsonb_build_object('role_name', role_name);
      if TG_OP = 'INSERT' then
        action := 'member.role_added';
        summary := 'Role added: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'member.role_removed';
        summary := 'Role removed: ' || entity_label;
      else
        action := 'member.role_updated';
        summary := 'Role assignment updated: ' || entity_label;
      end if;

    when 'events' then
      entity_label := coalesce(row_data ->> 'title', 'Event');
      if TG_OP = 'INSERT' then
        action := 'event.created';
        summary := 'Event created: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'event.deleted';
        summary := 'Event deleted: ' || entity_label;
      elsif 'event_date' = any(changed_fields) then
        action := 'event.date_changed';
        summary := 'Event date changed: ' || entity_label;
      else
        action := 'event.updated';
        summary := 'Event updated: ' || entity_label;
      end if;

    when 'event_assignments' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select e.title, e.org_id into event_title, org_id from public.events e where e.id = public.activity_try_uuid(row_data ->> 'event_id');
      select r.name into role_name from public.roles r where r.id = public.activity_try_uuid(row_data ->> 'role_id');
      entity_label := coalesce(event_title, 'Event assignment');
      metadata := metadata || jsonb_build_object('event_title', event_title, 'role_name', role_name);
      if TG_OP = 'INSERT' then
        action := 'event.assignment_added';
        summary := 'Assignment added for ' || coalesce(event_title, 'event') || coalesce(' - ' || role_name, '');
      elsif TG_OP = 'DELETE' then
        action := 'event.assignment_removed';
        summary := 'Assignment removed from ' || coalesce(event_title, 'event') || coalesce(' - ' || role_name, '');
      elsif old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'event.assignment_' || coalesce(row_data ->> 'status', 'updated');
        summary := 'Assignment ' || replace(coalesce(row_data ->> 'status', 'updated'), '_', ' ') || ' for ' || coalesce(event_title, 'event');
      else
        action := 'event.assignment_updated';
        summary := 'Assignment updated for ' || coalesce(event_title, 'event');
      end if;

    when 'event_attendance' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'override_by'), public.activity_try_uuid(row_data ->> 'marked_by'), target_user_id);
      select e.title, e.org_id into event_title, org_id from public.events e where e.id = public.activity_try_uuid(row_data ->> 'event_id');
      entity_label := coalesce(event_title, 'Event attendance');
      metadata := metadata || jsonb_build_object('event_title', event_title);
      if 'override_by' = any(changed_fields) or 'override_at' = any(changed_fields) then
        action := 'attendance.overridden';
        summary := 'Attendance overridden for ' || coalesce(event_title, 'event');
      elsif TG_OP = 'INSERT' then
        action := 'attendance.marked';
        summary := 'Attendance marked ' || coalesce(row_data ->> 'status', 'updated') || ' for ' || coalesce(event_title, 'event');
      elsif old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'attendance.status_changed';
        summary := 'Attendance changed to ' || coalesce(row_data ->> 'status', 'updated') || ' for ' || coalesce(event_title, 'event');
      else
        action := 'attendance.updated';
        summary := 'Attendance updated for ' || coalesce(event_title, 'event');
      end if;

    when 'user_availability' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      request_kind := coalesce(row_data ->> 'request_type', 'leave');
      entity_label := initcap(request_kind) || ' request';
      metadata := metadata || jsonb_build_object('request_type', request_kind);
      if TG_OP = 'INSERT' then
        action := 'request.' || request_kind || '_submitted';
        summary := initcap(request_kind) || ' request submitted';
      elsif TG_OP = 'DELETE' then
        action := 'request.' || request_kind || '_deleted';
        summary := initcap(request_kind) || ' request deleted';
      elsif old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'request.' || request_kind || '_' || coalesce(row_data ->> 'status', 'updated');
        summary := initcap(request_kind) || ' request ' || replace(coalesce(row_data ->> 'status', 'updated'), '_', ' ');
      else
        action := 'request.' || request_kind || '_updated';
        summary := initcap(request_kind) || ' request updated';
      end if;

    when 'announcements' then
      entity_label := coalesce(row_data ->> 'title', 'Announcement');
      if TG_OP = 'INSERT' then
        action := 'announcement.created';
        summary := 'Announcement created: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'announcement.deleted';
        summary := 'Announcement deleted: ' || entity_label;
      else
        action := 'announcement.updated';
        summary := 'Announcement updated: ' || entity_label;
      end if;

    when 'announcement_comments' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select a.title, a.org_id into announcement_title, org_id from public.announcements a where a.id = public.activity_try_uuid(row_data ->> 'announcement_id');
      entity_label := coalesce(announcement_title, 'Announcement comment');
      metadata := metadata || jsonb_build_object('announcement_title', announcement_title);
      if TG_OP = 'INSERT' then
        action := 'announcement.comment_created';
        summary := 'Comment added on ' || coalesce(announcement_title, 'announcement');
      elsif TG_OP = 'DELETE' then
        action := 'announcement.comment_deleted';
        summary := 'Comment deleted on ' || coalesce(announcement_title, 'announcement');
      else
        action := 'announcement.comment_updated';
        summary := 'Comment edited on ' || coalesce(announcement_title, 'announcement');
      end if;

    when 'announcement_reactions' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select a.title, a.org_id into announcement_title, org_id from public.announcements a where a.id = public.activity_try_uuid(row_data ->> 'announcement_id');
      entity_label := coalesce(announcement_title, 'Announcement reaction');
      metadata := metadata || jsonb_build_object('announcement_title', announcement_title, 'emoji', row_data ->> 'emoji');
      if TG_OP = 'DELETE' then
        action := 'announcement.reaction_removed';
        summary := 'Reaction removed from ' || coalesce(announcement_title, 'announcement');
      else
        action := 'announcement.reaction_added';
        summary := 'Reaction added to ' || coalesce(announcement_title, 'announcement');
      end if;

    when 'announcement_pins' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'pinned_by'));
      select a.title, a.org_id into announcement_title, org_id from public.announcements a where a.id = public.activity_try_uuid(row_data ->> 'announcement_id');
      entity_label := coalesce(announcement_title, 'Announcement pin');
      if TG_OP = 'DELETE' then
        action := 'announcement.unpinned';
        summary := 'Announcement unpinned: ' || coalesce(announcement_title, 'announcement');
      else
        action := 'announcement.pinned';
        summary := 'Announcement pinned: ' || coalesce(announcement_title, 'announcement');
      end if;

    when 'videos' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'uploaded_by'));
      target_user_id := public.activity_try_uuid(row_data ->> 'uploaded_by');
      entity_label := coalesce(row_data ->> 'title', 'Video');
      if TG_OP = 'INSERT' then
        action := 'library.video_created';
        summary := 'Video added: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'library.video_deleted';
        summary := 'Video deleted: ' || entity_label;
      else
        action := 'library.video_updated';
        summary := 'Video updated: ' || entity_label;
      end if;

    when 'songs' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'created_by'));
      entity_label := coalesce(row_data ->> 'title', 'Song');
      metadata := metadata || jsonb_build_object('artist', row_data ->> 'artist');
      if TG_OP = 'INSERT' then
        action := 'library.song_created';
        summary := 'Song created: ' || entity_label;
      elsif TG_OP = 'DELETE' then
        action := 'library.song_deleted';
        summary := 'Song deleted: ' || entity_label;
      elsif 'lyrics' = any(changed_fields) then
        action := 'library.song_lyrics_updated';
        summary := 'Lyrics updated: ' || entity_label;
      elsif 'chordpro_text' = any(changed_fields) then
        action := 'library.song_chart_updated';
        summary := 'Chord chart updated: ' || entity_label;
      else
        action := 'library.song_updated';
        summary := 'Song updated: ' || entity_label;
      end if;

    when 'setlists' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'reviewed_by'), public.activity_try_uuid(row_data ->> 'approved_by'), public.activity_try_uuid(row_data ->> 'created_by'));
      select e.title, e.org_id into setlist_event_title, org_id from public.events e where e.id = public.activity_try_uuid(row_data ->> 'event_id');
      entity_label := coalesce(setlist_event_title, 'Setlist');
      metadata := metadata || jsonb_build_object('event_title', setlist_event_title);
      if TG_OP = 'INSERT' then
        action := 'setlist.created';
        summary := 'Setlist created for ' || coalesce(setlist_event_title, 'event');
      elsif TG_OP = 'DELETE' then
        action := 'setlist.deleted';
        summary := 'Setlist deleted for ' || coalesce(setlist_event_title, 'event');
      elsif old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'setlist.' || coalesce(row_data ->> 'status', 'updated');
        summary := 'Setlist marked ' || replace(coalesce(row_data ->> 'status', 'updated'), '_', ' ') || ' for ' || coalesce(setlist_event_title, 'event');
      elsif 'service_format' = any(changed_fields) then
        action := 'setlist.service_format_changed';
        summary := 'Setlist service format changed for ' || coalesce(setlist_event_title, 'event');
      else
        action := 'setlist.updated';
        summary := 'Setlist updated for ' || coalesce(setlist_event_title, 'event');
      end if;

    when 'setlist_songs' then
      select s.title into song_title from public.songs s where s.id = public.activity_try_uuid(row_data ->> 'song_id');
      select e.title, sl.org_id
      into setlist_event_title, org_id
      from public.setlists sl
      left join public.events e on e.id = sl.event_id
      where sl.id = public.activity_try_uuid(row_data ->> 'setlist_id');
      entity_label := coalesce(song_title, 'Setlist song');
      metadata := metadata || jsonb_build_object('song_title', song_title, 'event_title', setlist_event_title);
      if TG_OP = 'INSERT' then
        action := 'setlist.song_added';
        summary := 'Song added to setlist: ' || coalesce(song_title, 'song');
      elsif TG_OP = 'DELETE' then
        action := 'setlist.song_removed';
        summary := 'Song removed from setlist: ' || coalesce(song_title, 'song');
      elsif 'position' = any(changed_fields) then
        action := 'setlist.song_reordered';
        summary := 'Setlist song reordered: ' || coalesce(song_title, 'song');
      else
        action := 'setlist.song_updated';
        summary := 'Setlist song updated: ' || coalesce(song_title, 'song');
      end if;

    when 'setlist_submissions' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select e.title, sl.org_id
      into setlist_event_title, org_id
      from public.setlists sl
      left join public.events e on e.id = sl.event_id
      where sl.id = public.activity_try_uuid(row_data ->> 'setlist_id');
      entity_label := coalesce(setlist_event_title, 'Setlist submission');
      metadata := metadata || jsonb_build_object('verdict', row_data ->> 'verdict', 'rating', row_data ->> 'rating');
      if TG_OP = 'INSERT' then
        action := 'setlist.check_submitted';
        summary := 'Setlist check submitted for ' || coalesce(setlist_event_title, 'event');
      elsif TG_OP = 'DELETE' then
        action := 'setlist.check_deleted';
        summary := 'Setlist check deleted for ' || coalesce(setlist_event_title, 'event');
      else
        action := 'setlist.check_updated';
        summary := 'Setlist check updated for ' || coalesce(setlist_event_title, 'event');
      end if;

    when 'setlist_checker_results' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'decided_by'), public.activity_try_uuid(row_data ->> 'created_by'));
      target_user_id := public.activity_try_uuid(row_data ->> 'created_by');
      if public.activity_try_uuid(row_data ->> 'setlist_id') is not null then
        select e.title, sl.org_id
        into setlist_event_title, org_id
        from public.setlists sl
        left join public.events e on e.id = sl.event_id
        where sl.id = public.activity_try_uuid(row_data ->> 'setlist_id');
      end if;
      entity_label := coalesce(setlist_event_title, 'Setlist checker result');
      metadata := metadata || jsonb_build_object('score_overall', row_data ->> 'score_overall', 'language_mode', row_data ->> 'language_mode');
      if TG_OP = 'INSERT' then
        action := 'setlist.checker_run_saved';
        summary := 'Setlist checker run saved';
      elsif old_data ->> 'leader_decision' is distinct from row_data ->> 'leader_decision' and row_data ->> 'leader_decision' is not null then
        action := 'setlist.checker_decision_submitted';
        summary := 'Setlist checker decision submitted';
      else
        action := 'setlist.checker_result_updated';
        summary := 'Setlist checker result updated';
      end if;

    when 'setlist_checker_sessions' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'created_by'));
      target_user_id := public.activity_try_uuid(row_data ->> 'created_by');
      entity_label := coalesce(row_data ->> 'name', 'Setlist checker session');
      if TG_OP = 'INSERT' then
        action := 'setlist.checker_session_created';
        summary := 'Setlist checker session created';
      elsif TG_OP = 'DELETE' then
        action := 'setlist.checker_session_deleted';
        summary := 'Setlist checker session deleted';
      else
        action := 'setlist.checker_session_updated';
        summary := 'Setlist checker session updated';
      end if;

    when 'setlist_reminders' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'sent_by'));
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      select e.title, e.org_id into event_title, org_id from public.events e where e.id = public.activity_try_uuid(row_data ->> 'event_id');
      entity_label := coalesce(event_title, 'Setlist reminder');
      action := 'setlist.reminder_sent';
      summary := 'Setlist reminder sent for ' || coalesce(event_title, 'event');

    when 'song_section_notes' then
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'updated_by'));
      select s.title, s.org_id into song_title, org_id from public.songs s where s.id = public.activity_try_uuid(row_data ->> 'song_id');
      entity_label := coalesce(song_title, 'Song section note');
      metadata := metadata || jsonb_build_object('section_label', row_data ->> 'section_label');
      if TG_OP = 'INSERT' then
        action := 'library.song_section_note_created';
        summary := 'Song section note added: ' || coalesce(song_title, 'song');
      elsif TG_OP = 'DELETE' then
        action := 'library.song_section_note_deleted';
        summary := 'Song section note deleted: ' || coalesce(song_title, 'song');
      else
        action := 'library.song_section_note_updated';
        summary := 'Song section note updated: ' || coalesce(song_title, 'song');
      end if;

    when 'user_preferences' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      entity_label := 'User preference';
      action := 'account.preference_updated';
      summary := 'User preferences updated';

    when 'push_subscriptions' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      entity_label := 'Push notification setting';
      if TG_OP = 'DELETE' then
        action := 'account.push_disabled';
        summary := 'Push notifications disabled';
      elsif TG_OP = 'INSERT' then
        action := 'account.push_enabled';
        summary := 'Push notifications enabled';
      else
        return null;
      end if;

    when 'discipline_records' then
      target_user_id := public.activity_try_uuid(row_data ->> 'user_id');
      actor_id := coalesce(actor_id, public.activity_try_uuid(row_data ->> 'resolved_by'), public.activity_try_uuid(row_data ->> 'created_by'));
      entity_label := 'Accountability record';
      if TG_OP = 'INSERT' then
        action := 'accountability.record_created';
        summary := 'Accountability record created';
      elsif TG_OP = 'DELETE' then
        action := 'accountability.record_deleted';
        summary := 'Accountability record deleted';
      elsif old_data ->> 'status' is distinct from row_data ->> 'status' then
        action := 'accountability.status_changed';
        summary := 'Accountability status changed to ' || coalesce(row_data ->> 'status', 'updated');
      else
        action := 'accountability.record_updated';
        summary := 'Accountability record updated';
      end if;

    else
      entity_label := initcap(replace(entity_type, '_', ' '));
      action := category || '.' || lower(operation_label);
      summary := initcap(replace(entity_type, '_', ' ')) || ' ' || operation_label;
  end case;

  if org_id is null then
    select p.org_id into org_id
    from public.profiles p
    where p.id = coalesce(target_user_id, actor_id)
    limit 1;
  end if;

  if org_id is not null and org_name is null then
    select o.name into org_name
    from public.organizations o
    where o.id = org_id
    limit 1;
  end if;

  if actor_id is not null then
    select
      p.email,
      public.activity_display_name(p.first_name, p.last_name, p.nickname, p.email)
    into actor_email, actor_name
    from public.profiles p
    where p.id = actor_id
    limit 1;
  end if;

  if target_user_id is not null then
    select
      p.email,
      public.activity_display_name(p.first_name, p.last_name, p.nickname, p.email)
    into target_user_email, target_user_name
    from public.profiles p
    where p.id = target_user_id
    limit 1;
  end if;

  insert into public.activity_logs (
    org_id,
    org_name,
    actor_id,
    actor_name,
    actor_email,
    target_user_id,
    target_user_name,
    target_user_email,
    category,
    action,
    entity_type,
    entity_id,
    entity_label,
    summary,
    metadata
  )
  values (
    org_id,
    org_name,
    actor_id,
    coalesce(actor_name, case when actor_id is null then 'System' else null end),
    actor_email,
    target_user_id,
    target_user_name,
    target_user_email,
    category,
    action,
    entity_type,
    entity_id,
    entity_label,
    summary,
    metadata
  );

  return null;
end;
$$;

revoke all on function public.activity_try_uuid(text) from public, anon, authenticated;
revoke all on function public.activity_display_name(text, text, text, text) from public, anon, authenticated;
revoke all on function public.activity_changed_fields(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.log_activity() from public, anon, authenticated;

create or replace function public.create_activity_trigger_if_table_exists(
  p_table_name text,
  p_category text,
  p_entity_type text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  trigger_name text := format('trg_activity_%s', p_table_name);
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  execute format('drop trigger if exists %I on public.%I', trigger_name, p_table_name);
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_activity(%L, %L)',
    trigger_name,
    p_table_name,
    p_category,
    p_entity_type
  );
end;
$$;

select public.create_activity_trigger_if_table_exists('organizations', 'organization', 'organization');
select public.create_activity_trigger_if_table_exists('profiles', 'account', 'profile');
select public.create_activity_trigger_if_table_exists('organization_invitations', 'organization', 'invitation');
select public.create_activity_trigger_if_table_exists('organization_payment_submissions', 'billing', 'payment_submission');
select public.create_activity_trigger_if_table_exists('user_roles', 'member', 'role_assignment');
select public.create_activity_trigger_if_table_exists('events', 'event', 'event');
select public.create_activity_trigger_if_table_exists('event_assignments', 'event', 'event_assignment');
select public.create_activity_trigger_if_table_exists('event_attendance', 'attendance', 'event_attendance');
select public.create_activity_trigger_if_table_exists('user_availability', 'request', 'user_availability');
select public.create_activity_trigger_if_table_exists('announcements', 'announcement', 'announcement');
select public.create_activity_trigger_if_table_exists('announcement_comments', 'announcement', 'announcement_comment');
select public.create_activity_trigger_if_table_exists('announcement_reactions', 'announcement', 'announcement_reaction');
select public.create_activity_trigger_if_table_exists('announcement_pins', 'announcement', 'announcement_pin');
select public.create_activity_trigger_if_table_exists('videos', 'library', 'video');
select public.create_activity_trigger_if_table_exists('songs', 'library', 'song');
select public.create_activity_trigger_if_table_exists('setlists', 'setlist', 'setlist');
select public.create_activity_trigger_if_table_exists('setlist_songs', 'setlist', 'setlist_song');
select public.create_activity_trigger_if_table_exists('setlist_submissions', 'setlist', 'setlist_submission');
select public.create_activity_trigger_if_table_exists('setlist_checker_results', 'setlist', 'setlist_checker_result');
select public.create_activity_trigger_if_table_exists('setlist_checker_sessions', 'setlist', 'setlist_checker_session');
select public.create_activity_trigger_if_table_exists('setlist_reminders', 'setlist', 'setlist_reminder');
select public.create_activity_trigger_if_table_exists('song_section_notes', 'library', 'song_section_note');
select public.create_activity_trigger_if_table_exists('user_preferences', 'account', 'user_preference');
select public.create_activity_trigger_if_table_exists('push_subscriptions', 'account', 'push_subscription');
select public.create_activity_trigger_if_table_exists('discipline_records', 'accountability', 'discipline_record');

drop function public.create_activity_trigger_if_table_exists(text, text, text);

notify pgrst, 'reload schema';
