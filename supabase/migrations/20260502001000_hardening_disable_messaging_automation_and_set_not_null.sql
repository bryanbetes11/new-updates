-- ============================================================================
-- Hardening phase 1
-- ----------------------------------------------------------------------------
-- Purpose:
--   * backfill remaining null org_id values on active notification rows
--   * disable unused messaging automation now that messaging is removed
--   * tighten active tenant-scoped tables so org_id cannot be null
--
-- Notes:
--   * profiles.org_id remains nullable for future onboarding/invite flows
--   * messaging tables are intentionally excluded because Batch 4 is skipped
-- ============================================================================

-- ---- cleanup lingering active-data null org rows ----------------------------

update public.notifications n
set org_id = p.org_id
from public.profiles p
where n.user_id = p.id
  and n.org_id is null
  and p.org_id is not null;

-- ---- disable unused messaging automation -----------------------------------

drop trigger if exists on_assignment_add_to_event_chat on public.event_assignments;
drop function if exists public.add_assigned_user_to_event_chat();

drop trigger if exists on_new_message_update_conversation on public.messages;
drop function if exists public.update_conversation_timestamp();

drop function if exists public.create_event_conversation();
drop function if exists public.create_conversation_with_members(text, text, uuid, uuid[]);

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup-inactive-event-discussions';
  end if;
exception
  when undefined_table then
    null;
end;
$$;

drop function if exists public.cleanup_inactive_event_discussions();

-- ---- tighten active tenant tables ------------------------------------------

alter table public.user_roles
  alter column org_id set not null;

alter table public.events
  alter column org_id set not null;

alter table public.event_assignments
  alter column org_id set not null;

alter table public.songs
  alter column org_id set not null;

alter table public.setlists
  alter column org_id set not null;

alter table public.setlist_songs
  alter column org_id set not null;

alter table public.announcements
  alter column org_id set not null;

alter table public.announcement_comments
  alter column org_id set not null;

alter table public.announcement_views
  alter column org_id set not null;

alter table public.announcement_reactions
  alter column org_id set not null;

alter table public.announcement_pins
  alter column org_id set not null;

alter table public.videos
  alter column org_id set not null;

alter table public.notifications
  alter column org_id set not null;

alter table public.push_subscriptions
  alter column org_id set not null;

alter table public.user_availability
  alter column org_id set not null;

alter table public.user_preferences
  alter column org_id set not null;

alter table public.event_attendance
  alter column org_id set not null;

alter table public.attendance_offense_notifications
  alter column org_id set not null;

alter table public.discipline_records
  alter column org_id set not null;

alter table public.setlist_checker_results
  alter column org_id set not null;

alter table public.setlist_checker_sessions
  alter column org_id set not null;

alter table public.setlist_reminders
  alter column org_id set not null;
