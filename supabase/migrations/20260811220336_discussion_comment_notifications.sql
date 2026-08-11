-- Notify the people responsible for a setlist revision discussion, and keep
-- the full active team aware of new video-library discussion.

create or replace function public.notify_setlist_revision_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_event_title text;
  v_author_name text;
  v_recipient record;
  v_is_reply boolean := new.reply_to is not null;
begin
  select s.event_id, e.title
  into v_event_id, v_event_title
  from public.setlists s
  join public.events e on e.id = s.event_id
  where s.id = new.setlist_id
    and s.org_id = new.org_id;

  if v_event_id is null then
    return new;
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'A team member')
  into v_author_name
  from public.profiles p
  where p.id = new.user_id
    and p.org_id = new.org_id;

  insert into public.notification_rules (
    org_id, type, label, category, description, target_roles,
    enabled, required, in_app_enabled, push_enabled, priority, reminder_offsets
  ) values (
    new.org_id, 'setlist_revision_comment', 'Revision discussion activity',
    'setlists', 'The assigned Song Leader and Setlist Coordinators are told about revision comments and replies.',
    array['Song Leader', 'Setlist Coordinator'], true, false, true, true, 'high', '{}'::integer[]
  ) on conflict (org_id, type) do nothing;

  for v_recipient in
    select recipient.user_id
    from (
      select ea.user_id
      from public.event_assignments ea
      join public.roles r on r.id = ea.role_id
      where ea.event_id = v_event_id
        and ea.org_id = new.org_id
        and r.name = 'Song Leader'
        and ea.status <> 'declined'
      union
      select ur.user_id
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.org_id = new.org_id
        and r.name = 'Setlist Coordinator'
    ) recipient
    where recipient.user_id <> new.user_id
  loop
    perform public.create_notification(
      v_recipient.user_id,
      'setlist_revision_comment',
      case when v_is_reply then 'New Revision Reply' else 'New Revision Comment' end,
      coalesce(v_author_name, 'A team member')
        || case when v_is_reply then ' replied in' else ' commented in' end
        || ' the revision discussion for "' || coalesce(v_event_title, 'an event') || '".',
      jsonb_build_object(
        'comment_id', new.id,
        'reply_to', new.reply_to,
        'setlist_id', new.setlist_id,
        'event_id', v_event_id,
        'url', '/events/' || v_event_id::text || '?revision=true'
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists setlist_revision_comment_notify on public.setlist_revision_comments;
create trigger setlist_revision_comment_notify
after insert on public.setlist_revision_comments
for each row execute function public.notify_setlist_revision_comment();

create or replace function public.notify_video_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_video_title text;
  v_author_name text;
  v_recipient record;
begin
  select v.title
  into v_video_title
  from public.videos v
  where v.id = new.video_id
    and v.org_id = new.org_id;

  if v_video_title is null then
    return new;
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'A team member')
  into v_author_name
  from public.profiles p
  where p.id = new.user_id
    and p.org_id = new.org_id;

  insert into public.notification_rules (
    org_id, type, label, category, description, target_roles,
    enabled, required, in_app_enabled, push_enabled, priority, reminder_offsets
  ) values (
    new.org_id, 'video_comment', 'Video discussion comment',
    'communication', 'Active members are told when a new comment is added to a library video.',
    array['Members'], true, false, true, true, 'normal', '{}'::integer[]
  ) on conflict (org_id, type) do nothing;

  for v_recipient in
    select p.id as user_id
    from public.profiles p
    where p.org_id = new.org_id
      and p.id <> new.user_id
      and p.is_onboarded = true
      and p.ministry_status = 'active'
  loop
    perform public.create_notification(
      v_recipient.user_id,
      'video_comment',
      'New Video Comment',
      coalesce(v_author_name, 'A team member') || ' commented on "' || v_video_title || '".',
      jsonb_build_object(
        'comment_id', new.id,
        'video_id', new.video_id,
        'url', '/library?tab=videos&video=' || new.video_id::text
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists video_comment_notify on public.video_comments;
create trigger video_comment_notify
after insert on public.video_comments
for each row execute function public.notify_video_comment();

revoke all on function public.notify_setlist_revision_comment() from public, anon, authenticated;
revoke all on function public.notify_video_comment() from public, anon, authenticated;
