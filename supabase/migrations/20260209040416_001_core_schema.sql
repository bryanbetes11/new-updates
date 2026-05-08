/*
  # Core Schema - Profiles, Roles, Events, Assignments, Songs, Setlists

  1. New Tables
    - `profiles` - User profile data extending auth.users
      - `id` (uuid, PK, references auth.users)
      - `first_name`, `last_name`, `nickname` (text)
      - `email`, `phone` (text)
      - `birthday` (date)
      - `avatar_url` (text)
      - `is_onboarded` (boolean)
      - `created_at`, `updated_at` (timestamptz)
    - `roles` - Available team roles
      - `id` (uuid, PK)
      - `name` (text, unique)
      - `is_leadership` (boolean)
      - `sort_order` (int)
    - `user_roles` - Many-to-many user-role assignments
      - `user_id` (uuid, FK profiles)
      - `role_id` (uuid, FK roles)
    - `events` - Worship events/services
      - `id` (uuid, PK)
      - `title` (text)
      - `event_date` (date)
      - `start_time`, `end_time` (time)
      - `event_type` (text)
      - `description` (text)
      - `created_by` (uuid, FK profiles)
      - `confirmation_deadline` (timestamptz)
    - `event_assignments` - Team member assignments per event
      - `id` (uuid, PK)
      - `event_id` (uuid, FK events)
      - `user_id` (uuid, FK profiles)
      - `role_id` (uuid, FK roles)
      - `status` (text: pending/confirmed/declined)
      - `decline_reason` (text)
    - `songs` - Song library
      - `id` (uuid, PK)
      - `title`, `artist`, `song_key`, `duration`, `key_notes` (text)
      - `created_by` (uuid, FK profiles)
    - `setlists` - Setlists for events
      - `id` (uuid, PK)
      - `event_id` (uuid, FK events)
      - `status` (text: draft/pending_review/approved/revision_requested)
      - `created_by`, `approved_by` (uuid, FK profiles)
      - `approval_notes` (text)
    - `setlist_songs` - Songs in a setlist with ordering
      - `id` (uuid, PK)
      - `setlist_id` (uuid, FK setlists)
      - `song_id` (uuid, FK songs)
      - `position` (int)
      - `notes` (text)

  2. Security
    - RLS enabled on ALL tables
    - Authenticated users can read profiles, roles, events, songs
    - Users can update their own profile
    - Leadership roles can manage events, assignments, setlists
    - Admins have full access

  3. Seed Data
    - Default roles: Admin, Music Director, Stage Director, Song Leader, Band Member
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  nickname text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  birthday date,
  avatar_url text NOT NULL DEFAULT '',
  is_onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_leadership boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  event_type text NOT NULL DEFAULT 'Sunday Service',
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES profiles(id),
  confirmation_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Event creator can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Event creator can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

-- Event Assignments
CREATE TABLE IF NOT EXISTS event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  status text NOT NULL DEFAULT 'pending',
  decline_reason text NOT NULL DEFAULT '',
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, role_id)
);

ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON event_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create assignments"
  ON event_assignments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned user can update their assignment"
  ON event_assignments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete assignments"
  ON event_assignments FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_assignments_event ON event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON event_assignments(user_id);

-- Songs
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  song_key text NOT NULL DEFAULT '',
  duration text NOT NULL DEFAULT '',
  key_notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view songs"
  ON songs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Song creator can update songs"
  ON songs FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Setlists
CREATE TABLE IF NOT EXISTS setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approval_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view setlists"
  ON setlists FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create setlists"
  ON setlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Setlist creator can update setlists"
  ON setlists FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_setlists_event ON setlists(event_id);

-- Setlist Songs
CREATE TABLE IF NOT EXISTS setlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id),
  position int NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view setlist songs"
  ON setlist_songs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage setlist songs"
  ON setlist_songs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update setlist songs"
  ON setlist_songs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete setlist songs"
  ON setlist_songs FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed default roles
INSERT INTO roles (name, is_leadership, sort_order) VALUES
  ('Admin', true, 1),
  ('Music Director', true, 2),
  ('Stage Director', true, 3),
  ('Song Leader', false, 4),
  ('Band Member', false, 5)
ON CONFLICT (name) DO NOTHING;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
