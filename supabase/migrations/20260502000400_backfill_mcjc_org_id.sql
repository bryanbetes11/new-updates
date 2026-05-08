-- ============================================================================
-- Backfill org_id for the seeded MCJC tenant
-- ----------------------------------------------------------------------------
-- This migration assumes:
--   * organizations contains slug = 'mcjc-church'
--   * all current live data belongs to MCJC
-- ============================================================================

do $$
declare
  v_org_id uuid;
begin
  select id
  into v_org_id
  from public.organizations
  where slug = 'mcjc-church'
  limit 1;

  if v_org_id is null then
    raise exception 'MCJC organization with slug % not found', 'mcjc-church';
  end if;

  -- Root membership table first.
  update public.profiles
  set org_id = v_org_id
  where org_id is null;

  -- Direct user-owned tables.
  update public.user_roles ur
  set org_id = p.org_id
  from public.profiles p
  where ur.user_id = p.id
    and ur.org_id is distinct from p.org_id;

  update public.songs s
  set org_id = p.org_id
  from public.profiles p
  where s.created_by = p.id
    and s.org_id is distinct from p.org_id;

  update public.announcements a
  set org_id = p.org_id
  from public.profiles p
  where a.created_by = p.id
    and a.org_id is distinct from p.org_id;

  update public.videos v
  set org_id = p.org_id
  from public.profiles p
  where v.uploaded_by = p.id
    and v.org_id is distinct from p.org_id;

  update public.notifications n
  set org_id = p.org_id
  from public.profiles p
  where n.user_id = p.id
    and n.org_id is distinct from p.org_id;

  update public.push_subscriptions ps
  set org_id = p.org_id
  from public.profiles p
  where ps.user_id = p.id
    and ps.org_id is distinct from p.org_id;

  update public.user_availability ua
  set org_id = p.org_id
  from public.profiles p
  where ua.user_id = p.id
    and ua.org_id is distinct from p.org_id;

  update public.user_preferences up
  set org_id = p.org_id
  from public.profiles p
  where up.user_id = p.id
    and up.org_id is distinct from p.org_id;

  update public.attendance_offense_notifications aon
  set org_id = p.org_id
  from public.profiles p
  where aon.user_id = p.id
    and aon.org_id is distinct from p.org_id;

  update public.discipline_records dr
  set org_id = p.org_id
  from public.profiles p
  where dr.user_id = p.id
    and dr.org_id is distinct from p.org_id;

  update public.setlist_checker_sessions scs
  set org_id = p.org_id
  from public.profiles p
  where scs.created_by = p.id
    and scs.org_id is distinct from p.org_id;

  -- Event tree.
  update public.events e
  set org_id = p.org_id
  from public.profiles p
  where e.created_by = p.id
    and e.org_id is distinct from p.org_id;

  update public.event_assignments ea
  set org_id = e.org_id
  from public.events e
  where ea.event_id = e.id
    and ea.org_id is distinct from e.org_id;

  update public.event_messages em
  set org_id = e.org_id
  from public.events e
  where em.event_id = e.id
    and em.org_id is distinct from e.org_id;

  update public.event_attendance att
  set org_id = e.org_id
  from public.events e
  where att.event_id = e.id
    and att.org_id is distinct from e.org_id;

  update public.setlist_reminders sr
  set org_id = e.org_id
  from public.events e
  where sr.event_id = e.id
    and sr.org_id is distinct from e.org_id;

  -- Setlist tree.
  update public.setlists sl
  set org_id = e.org_id
  from public.events e
  where sl.event_id = e.id
    and sl.org_id is distinct from e.org_id;

  update public.setlist_songs ss
  set org_id = sl.org_id
  from public.setlists sl
  where ss.setlist_id = sl.id
    and ss.org_id is distinct from sl.org_id;

  update public.setlist_checker_results scr
  set org_id = sl.org_id
  from public.setlists sl
  where scr.setlist_id = sl.id
    and scr.org_id is distinct from sl.org_id;

  update public.setlist_checker_results scr
  set org_id = p.org_id
  from public.profiles p
  where scr.org_id is null
    and scr.created_by = p.id;

  -- Announcement tree.
  update public.announcement_comments ac
  set org_id = a.org_id
  from public.announcements a
  where ac.announcement_id = a.id
    and ac.org_id is distinct from a.org_id;

  update public.announcement_views av
  set org_id = a.org_id
  from public.announcements a
  where av.announcement_id = a.id
    and av.org_id is distinct from a.org_id;

  update public.announcement_reactions ar
  set org_id = a.org_id
  from public.announcements a
  where ar.announcement_id = a.id
    and ar.org_id is distinct from a.org_id;

  update public.announcement_pins ap
  set org_id = a.org_id
  from public.announcements a
  where ap.announcement_id = a.id
    and ap.org_id is distinct from a.org_id;

  -- Messaging tree.
  update public.conversations c
  set org_id = e.org_id
  from public.events e
  where c.event_id = e.id
    and c.org_id is distinct from e.org_id;

  update public.conversations c
  set org_id = p.org_id
  from public.profiles p
  where c.org_id is null
    and c.created_by = p.id;

  update public.conversation_members cm
  set org_id = c.org_id
  from public.conversations c
  where cm.conversation_id = c.id
    and cm.org_id is distinct from c.org_id;

  update public.messages m
  set org_id = c.org_id
  from public.conversations c
  where m.conversation_id = c.id
    and m.org_id is distinct from c.org_id;

  update public.message_reactions mr
  set org_id = m.org_id
  from public.messages m
  where mr.message_id = m.id
    and mr.org_id is distinct from m.org_id;
end $$;
