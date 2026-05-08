-- ============================================================================
-- Add org_id columns to tenant-owned tables
-- ----------------------------------------------------------------------------
-- This is intentionally additive only:
--   * every org_id stays nullable in this phase
--   * RLS is unchanged in this phase
--   * NOT NULL constraints are added only after backfill + verification
-- ============================================================================

alter table public.user_roles
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists user_roles_org_id_idx on public.user_roles (org_id);

alter table public.events
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists events_org_id_idx on public.events (org_id);

alter table public.event_assignments
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists event_assignments_org_id_idx on public.event_assignments (org_id);

alter table public.songs
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists songs_org_id_idx on public.songs (org_id);

alter table public.setlists
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists setlists_org_id_idx on public.setlists (org_id);

alter table public.setlist_songs
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists setlist_songs_org_id_idx on public.setlist_songs (org_id);

alter table public.announcements
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists announcements_org_id_idx on public.announcements (org_id);

alter table public.announcement_comments
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists announcement_comments_org_id_idx on public.announcement_comments (org_id);

alter table public.announcement_views
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists announcement_views_org_id_idx on public.announcement_views (org_id);

alter table public.videos
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists videos_org_id_idx on public.videos (org_id);

alter table public.notifications
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists notifications_org_id_idx on public.notifications (org_id);

alter table public.push_subscriptions
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists push_subscriptions_org_id_idx on public.push_subscriptions (org_id);

alter table public.user_availability
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists user_availability_org_id_idx on public.user_availability (org_id);

alter table public.user_preferences
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists user_preferences_org_id_idx on public.user_preferences (org_id);

alter table public.conversations
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists conversations_org_id_idx on public.conversations (org_id);

alter table public.conversation_members
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists conversation_members_org_id_idx on public.conversation_members (org_id);

alter table public.messages
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists messages_org_id_idx on public.messages (org_id);

alter table public.event_messages
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists event_messages_org_id_idx on public.event_messages (org_id);

alter table public.message_reactions
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists message_reactions_org_id_idx on public.message_reactions (org_id);

alter table public.event_attendance
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists event_attendance_org_id_idx on public.event_attendance (org_id);

alter table public.attendance_offense_notifications
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists attendance_offense_notifications_org_id_idx on public.attendance_offense_notifications (org_id);

alter table public.discipline_records
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists discipline_records_org_id_idx on public.discipline_records (org_id);

alter table public.setlist_checker_results
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists setlist_checker_results_org_id_idx on public.setlist_checker_results (org_id);

alter table public.setlist_checker_sessions
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists setlist_checker_sessions_org_id_idx on public.setlist_checker_sessions (org_id);

alter table public.announcement_reactions
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists announcement_reactions_org_id_idx on public.announcement_reactions (org_id);

alter table public.announcement_pins
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists announcement_pins_org_id_idx on public.announcement_pins (org_id);

alter table public.setlist_reminders
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists setlist_reminders_org_id_idx on public.setlist_reminders (org_id);
