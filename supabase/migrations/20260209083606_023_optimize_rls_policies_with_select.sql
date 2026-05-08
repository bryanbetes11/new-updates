/*
  # Optimize RLS Policies for Performance

  1. Changes
    - Wrap all auth.uid() and auth.jwt() calls in SELECT statements
    - Prevents re-evaluation of auth functions for each row
    - Dramatically improves query performance at scale
  
  2. Tables Updated
    - profiles
    - roles
    - user_roles
    - events
    - event_assignments
    - songs
    - setlists
    - setlist_songs
    - announcements
    - announcement_comments
    - announcement_views
    - videos
    - notifications
    - push_subscriptions
    - user_availability
    - user_preferences
    - event_messages
    - conversations
    - conversation_members
    - messages
    - message_reads
    - message_reactions
*/

-- Drop and recreate all RLS policies with optimized auth function calls

-- PROFILES
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND role_id IN (SELECT id FROM roles WHERE name = 'Admin')
    )
  );

-- ROLES
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;

CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- USER_ROLES
DROP POLICY IF EXISTS "Authenticated users can view user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own roles" ON user_roles;

CREATE POLICY "Authenticated users can view user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can insert their own roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- EVENTS
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Event creator can update events" ON events;
DROP POLICY IF EXISTS "Event creator can delete events" ON events;

CREATE POLICY "Authenticated users can view events"
  ON events FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Event creator can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Event creator can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- EVENT_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users can view assignments" ON event_assignments;
DROP POLICY IF EXISTS "Authenticated users can create assignments" ON event_assignments;
DROP POLICY IF EXISTS "Assigned user can update their assignment" ON event_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON event_assignments;

CREATE POLICY "Authenticated users can view assignments"
  ON event_assignments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create assignments"
  ON event_assignments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Assigned user can update their assignment"
  ON event_assignments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Authenticated users can delete assignments"
  ON event_assignments FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- SONGS
DROP POLICY IF EXISTS "Authenticated users can view songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can create songs" ON songs;
DROP POLICY IF EXISTS "Song creator can update songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can delete songs" ON songs;

CREATE POLICY "Authenticated users can view songs"
  ON songs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Song creator can update songs"
  ON songs FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Authenticated users can delete songs"
  ON songs FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- SETLISTS
DROP POLICY IF EXISTS "Authenticated users can view setlists" ON setlists;
DROP POLICY IF EXISTS "Authenticated users can create setlists" ON setlists;
DROP POLICY IF EXISTS "Setlist creator can update setlists" ON setlists;
DROP POLICY IF EXISTS "Authenticated users can delete setlists" ON setlists;

CREATE POLICY "Authenticated users can view setlists"
  ON setlists FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create setlists"
  ON setlists FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Setlist creator can update setlists"
  ON setlists FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Authenticated users can delete setlists"
  ON setlists FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- SETLIST_SONGS
DROP POLICY IF EXISTS "Authenticated users can view setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Authenticated users can manage setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Authenticated users can update setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Authenticated users can delete setlist songs" ON setlist_songs;

CREATE POLICY "Authenticated users can view setlist songs"
  ON setlist_songs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage setlist songs"
  ON setlist_songs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update setlist songs"
  ON setlist_songs FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete setlist songs"
  ON setlist_songs FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "Authenticated users can view announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can create announcements" ON announcements;
DROP POLICY IF EXISTS "Creator can update announcements" ON announcements;
DROP POLICY IF EXISTS "Creator can delete announcements" ON announcements;

CREATE POLICY "Authenticated users can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Creator can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Creator can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ANNOUNCEMENT_COMMENTS
DROP POLICY IF EXISTS "Authenticated users can view comments" ON announcement_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON announcement_comments;
DROP POLICY IF EXISTS "Comment author can delete" ON announcement_comments;

CREATE POLICY "Authenticated users can view comments"
  ON announcement_comments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can create comments"
  ON announcement_comments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Comment author can delete"
  ON announcement_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ANNOUNCEMENT_VIEWS
DROP POLICY IF EXISTS "Authenticated users can view announcement views" ON announcement_views;
DROP POLICY IF EXISTS "Users can mark own views" ON announcement_views;
DROP POLICY IF EXISTS "Users can update own views" ON announcement_views;

CREATE POLICY "Authenticated users can view announcement views"
  ON announcement_views FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can mark own views"
  ON announcement_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own views"
  ON announcement_views FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- VIDEOS
DROP POLICY IF EXISTS "Authenticated users can view videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON videos;
DROP POLICY IF EXISTS "Uploader can update videos" ON videos;
DROP POLICY IF EXISTS "Uploader can delete videos" ON videos;

CREATE POLICY "Authenticated users can view videos"
  ON videos FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can upload videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Uploader can update videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (uploaded_by = (select auth.uid()));

CREATE POLICY "Uploader can delete videos"
  ON videos FOR DELETE
  TO authenticated
  USING (uploaded_by = (select auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- PUSH_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON push_subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- USER_AVAILABILITY
DROP POLICY IF EXISTS "Authenticated users can view availability" ON user_availability;
DROP POLICY IF EXISTS "Users can manage own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can update own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can delete own availability" ON user_availability;
DROP POLICY IF EXISTS "Leaders can approve leave requests" ON user_availability;

CREATE POLICY "Authenticated users can view availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can manage own availability"
  ON user_availability FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own availability"
  ON user_availability FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Leaders can approve leave requests"
  ON user_availability FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Worship Leader', 'Assistant Worship Leader', 'Admin')
      )
    )
  );

-- USER_PREFERENCES
DROP POLICY IF EXISTS "Authenticated users can view preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

CREATE POLICY "Authenticated users can view preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- EVENT_MESSAGES
DROP POLICY IF EXISTS "Authenticated users can read event messages" ON event_messages;
DROP POLICY IF EXISTS "Users can insert their own event messages" ON event_messages;
DROP POLICY IF EXISTS "Users can delete their own event messages" ON event_messages;

CREATE POLICY "Authenticated users can read event messages"
  ON event_messages FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can insert their own event messages"
  ON event_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own event messages"
  ON event_messages FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CONVERSATIONS
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Creator can update conversation" ON conversations;
DROP POLICY IF EXISTS "Creator can delete conversation" ON conversations;
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Creator can update conversation"
  ON conversations FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Creator can delete conversation"
  ON conversations FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversations.id
      AND user_id = (select auth.uid())
    )
  );

-- CONVERSATION_MEMBERS
DROP POLICY IF EXISTS "Authenticated users can add members to their conversations" ON conversation_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON conversation_members;
DROP POLICY IF EXISTS "Creator can remove members" ON conversation_members;
DROP POLICY IF EXISTS "Users can view members of joined conversations" ON conversation_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON conversation_members;

CREATE POLICY "Authenticated users can add members to their conversations"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
      AND created_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their own membership"
  ON conversation_members FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Creator can remove members"
  ON conversation_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
      AND created_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can view members of joined conversations"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can view own memberships"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- MESSAGES
DROP POLICY IF EXISTS "Members can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Members can send messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Sender can delete own messages" ON messages;

CREATE POLICY "Members can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id
      AND user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can send messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id
      AND user_id = (select auth.uid())
    )
  );

CREATE POLICY "Sender can delete own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (sender_id = (select auth.uid()));

-- MESSAGE_READS
DROP POLICY IF EXISTS "Conversation members can view message reads" ON message_reads;
DROP POLICY IF EXISTS "Users can mark messages as read" ON message_reads;

CREATE POLICY "Conversation members can view message reads"
  ON message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reads.message_id
      AND cm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- MESSAGE_REACTIONS
DROP POLICY IF EXISTS "Conversation members can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;

CREATE POLICY "Conversation members can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
