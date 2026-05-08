/*
  # Add Missing Indexes on Foreign Keys

  1. Performance Improvements
    - Add indexes on all foreign key columns that don't have covering indexes
    - Improves query performance for joins and foreign key lookups
  
  2. Tables Updated
    - announcement_comments: user_id
    - announcement_views: user_id
    - announcements: created_by
    - conversations: created_by
    - event_assignments: role_id
    - event_messages: user_id
    - message_reactions: user_id
    - messages: sender_id
    - setlist_songs: setlist_id, song_id
    - setlists: approved_by, created_by
    - songs: created_by
    - user_availability: approved_by
    - user_preferences: role_id
    - user_roles: role_id
    - videos: uploaded_by
*/

-- Add indexes on foreign key columns
CREATE INDEX IF NOT EXISTS idx_announcement_comments_user_id ON announcement_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_event_assignments_role_id ON event_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_user_id ON event_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_song_id ON setlist_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_setlists_approved_by ON setlists(approved_by);
CREATE INDEX IF NOT EXISTS idx_setlists_created_by ON setlists(created_by);
CREATE INDEX IF NOT EXISTS idx_songs_created_by ON songs(created_by);
CREATE INDEX IF NOT EXISTS idx_user_availability_approved_by ON user_availability(approved_by);
CREATE INDEX IF NOT EXISTS idx_user_preferences_role_id ON user_preferences(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_by ON videos(uploaded_by);
