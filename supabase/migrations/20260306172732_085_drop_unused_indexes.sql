/*
  # Drop Unused Indexes

  This migration removes indexes that have not been used according to database statistics.
  Unused indexes consume storage and slow down write operations without providing benefit.

  ## Dropped Indexes
  1. events table: idx_events_created_by, idx_events_song_leader
  2. event_assignments table: idx_assignments_user, idx_event_assignments_role_id
  3. message_reads table: idx_message_reads_message, idx_message_reads_user
  4. event_messages table: idx_event_messages_event_id, idx_event_messages_created_at, idx_event_messages_user_id
  5. announcement_comments table: idx_announcement_comments_user_id, idx_comments_announcement
  6. announcement_views table: idx_announcement_views_user_id
  7. announcements table: idx_announcements_created_by
  8. conversations table: idx_conversations_created_by
  9. messages table: idx_messages_sender_id, idx_messages_reply_to_id, idx_messages_reply_to, idx_messages_is_pinned, idx_messages_deleted_by, idx_messages_pinned_by
  10. setlist_songs table: idx_setlist_songs_song_id
  11. setlists table: idx_setlists_approved_by, idx_setlists_created_by
  12. songs table: idx_songs_created_by
  13. user_availability table: idx_user_availability_approved_by
  14. user_preferences table: idx_user_preferences_role_id
  15. videos table: idx_videos_uploaded_by
  16. attendance_offense_notifications table: idx_attendance_offense_notifications_user_quarter
  17. event_attendance table: idx_event_attendance_user_id, idx_event_attendance_status, idx_event_attendance_checked_in_at

  ## Important Notes
  - These indexes showed no usage in pg_stat_user_indexes
  - Dropping unused indexes improves write performance and reduces storage
  - If needed, these indexes can be recreated later
*/

DROP INDEX IF EXISTS public.idx_events_created_by;
DROP INDEX IF EXISTS public.idx_events_song_leader;
DROP INDEX IF EXISTS public.idx_assignments_user;
DROP INDEX IF EXISTS public.idx_event_assignments_role_id;
DROP INDEX IF EXISTS public.idx_message_reads_message;
DROP INDEX IF EXISTS public.idx_message_reads_user;
DROP INDEX IF EXISTS public.idx_event_messages_event_id;
DROP INDEX IF EXISTS public.idx_event_messages_created_at;
DROP INDEX IF EXISTS public.idx_event_messages_user_id;
DROP INDEX IF EXISTS public.idx_announcement_comments_user_id;
DROP INDEX IF EXISTS public.idx_comments_announcement;
DROP INDEX IF EXISTS public.idx_announcement_views_user_id;
DROP INDEX IF EXISTS public.idx_announcements_created_by;
DROP INDEX IF EXISTS public.idx_conversations_created_by;
DROP INDEX IF EXISTS public.idx_messages_sender_id;
DROP INDEX IF EXISTS public.idx_messages_reply_to_id;
DROP INDEX IF EXISTS public.idx_messages_reply_to;
DROP INDEX IF EXISTS public.idx_messages_is_pinned;
DROP INDEX IF EXISTS public.idx_messages_deleted_by;
DROP INDEX IF EXISTS public.idx_messages_pinned_by;
DROP INDEX IF EXISTS public.idx_setlist_songs_song_id;
DROP INDEX IF EXISTS public.idx_setlists_approved_by;
DROP INDEX IF EXISTS public.idx_setlists_created_by;
DROP INDEX IF EXISTS public.idx_songs_created_by;
DROP INDEX IF EXISTS public.idx_user_availability_approved_by;
DROP INDEX IF EXISTS public.idx_user_preferences_role_id;
DROP INDEX IF EXISTS public.idx_videos_uploaded_by;
DROP INDEX IF EXISTS public.idx_attendance_offense_notifications_user_quarter;
DROP INDEX IF EXISTS public.idx_event_attendance_user_id;
DROP INDEX IF EXISTS public.idx_event_attendance_status;
DROP INDEX IF EXISTS public.idx_event_attendance_checked_in_at;
