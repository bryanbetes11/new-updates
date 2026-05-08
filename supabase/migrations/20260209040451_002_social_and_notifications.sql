/*
  # Social Features - Announcements, Videos, Notifications, Availability

  1. New Tables
    - `announcements` - Team announcements
      - `id` (uuid, PK)
      - `title`, `content` (text)
      - `priority` (text: normal/high/urgent)
      - `media_url` (text)
      - `created_by` (uuid, FK profiles)
    - `announcement_comments` - Comments on announcements
      - `id` (uuid, PK)
      - `announcement_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `content` (text)
    - `announcement_views` - Track who viewed announcements
      - `announcement_id` + `user_id` (composite PK)
    - `videos` - Video library
      - `id` (uuid, PK)
      - `title`, `description`, `video_url`, `thumbnail_url` (text)
      - `category` (text)
      - `uploaded_by` (uuid, FK)
    - `notifications` - In-app notifications
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `type` (text)
      - `title`, `body` (text)
      - `data` (jsonb)
      - `is_read` (boolean)
    - `push_subscriptions` - Web push subscription data
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `endpoint`, `p256dh`, `auth_key` (text)
    - `user_availability` - Unavailable dates
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `unavailable_date` (date)
      - `reason` (text)
    - `user_preferences` - Role preferences and skills
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `role_id` (uuid, FK)
      - `skill_level` (int 1-5)
      - `preference_level` (int 1-5)

  2. Security
    - RLS enabled on ALL tables
    - Proper policies for each table
*/

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  media_url text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Announcement Comments
CREATE TABLE IF NOT EXISTS announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comments"
  ON announcement_comments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create comments"
  ON announcement_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comment author can delete"
  ON announcement_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comments_announcement ON announcement_comments(announcement_id);

-- Announcement Views
CREATE TABLE IF NOT EXISTS announcement_views (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view announcement views"
  ON announcement_views FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can mark own views"
  ON announcement_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_url text NOT NULL,
  thumbnail_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view videos"
  ON videos FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can update videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can delete videos"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Availability
CREATE TABLE IF NOT EXISTS user_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unavailable_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unavailable_date)
);

ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage own availability"
  ON user_availability FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own availability"
  ON user_availability FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Preferences (skill levels and role preferences)
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  skill_level int NOT NULL DEFAULT 1,
  preference_level int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
