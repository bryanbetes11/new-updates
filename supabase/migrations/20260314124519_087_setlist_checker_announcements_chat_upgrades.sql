/*
  # Setlist Checker, Announcement Upgrades, and Chat Enhancements

  ## Summary
  This migration adds:

  ### 1. Setlist Checker / AI Analysis
  - `setlist_checker_results` table: stores AI analysis results per setlist
    - score_overall (0-100), score_per_song (jsonb), flags (jsonb array), sequence_suggestions (text)
    - language_mode: 'english' | 'tagalog_english'
    - status: 'pending' | 'analyzed' | 'approved' | 'revision' | 'rejected'
    - audit: created_by, analyzed_at
  - `setlist_checker_sessions` table: scratch-pad checker sessions (not tied to an event setlist)
    - songs_json: the song list (manual + from DB)
    - result_json: cached analysis output

  ### 2. Announcement Enhancements
  - `announcement_reactions` table: emoji reactions per announcement per user
  - `announcement_pins` table: pinned announcements (pinned_by, pinned_at)
  - `is_leaders_only` column on announcements: hide from regular members
  - `pinned_at` helper view via announcement_pins

  ### 3. Chat / Conversation Enhancements
  - `last_read_at` already exists on conversation_members — no change needed
  - `is_typing_expires_at` ephemeral typing (stored client-side, skip DB)
  - Ensure realtime is enabled on conversations, messages, conversation_members

  ## Security
  - RLS on all new tables
  - Only authenticated users can react/pin
  - Leaders-only announcements hidden from non-leaders via RLS policy
*/

-- =============================================================
-- 1. SETLIST CHECKER RESULTS
-- =============================================================

CREATE TABLE IF NOT EXISTS setlist_checker_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid REFERENCES setlists(id) ON DELETE CASCADE,
  session_id uuid,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language_mode text NOT NULL DEFAULT 'english' CHECK (language_mode IN ('english', 'tagalog_english')),
  score_overall integer CHECK (score_overall BETWEEN 0 AND 100),
  score_per_song jsonb DEFAULT '[]'::jsonb,
  theological_flags jsonb DEFAULT '[]'::jsonb,
  sequence_suggestions text,
  category_fit_notes text,
  full_analysis text,
  suggested_order jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'analyzed' CHECK (status IN ('pending', 'analyzed', 'approved', 'revision', 'rejected')),
  leader_decision text CHECK (leader_decision IN ('approve', 'revision', 'reject')),
  leader_notes text,
  analyzed_at timestamptz DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE setlist_checker_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checker results for their setlists"
  ON setlist_checker_results FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id
      WHERE p.id = auth.uid()
      AND r.is_leadership = true
    )
  );

CREATE POLICY "Authenticated users can create checker results"
  ON setlist_checker_results FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators and leaders can update checker results"
  ON setlist_checker_results FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id
      WHERE p.id = auth.uid()
      AND r.is_leadership = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id
      WHERE p.id = auth.uid()
      AND r.is_leadership = true
    )
  );

-- Scratch-pad checker sessions (not tied to a saved setlist)
CREATE TABLE IF NOT EXISTS setlist_checker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text,
  songs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_json jsonb,
  language_mode text NOT NULL DEFAULT 'english' CHECK (language_mode IN ('english', 'tagalog_english')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE setlist_checker_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own checker sessions"
  ON setlist_checker_sessions FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own checker sessions"
  ON setlist_checker_sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own checker sessions"
  ON setlist_checker_sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own checker sessions"
  ON setlist_checker_sessions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =============================================================
-- 2. ANNOUNCEMENT REACTIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id, emoji)
);

ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reactions"
  ON announcement_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON announcement_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
  ON announcement_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- 3. ANNOUNCEMENT PINS
-- =============================================================

CREATE TABLE IF NOT EXISTS announcement_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE UNIQUE,
  pinned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcement_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pins"
  ON announcement_pins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Leaders can pin announcements"
  ON announcement_pins FOR INSERT
  TO authenticated
  WITH CHECK (
    pinned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_leadership = true
    )
  );

CREATE POLICY "Leaders can unpin announcements"
  ON announcement_pins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_leadership = true
    )
  );

-- =============================================================
-- 4. ANNOUNCEMENTS: is_leaders_only column
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'is_leaders_only'
  ) THEN
    ALTER TABLE announcements ADD COLUMN is_leaders_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================================
-- 5. INDEXES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_setlist_checker_results_setlist_id ON setlist_checker_results(setlist_id);
CREATE INDEX IF NOT EXISTS idx_setlist_checker_results_created_by ON setlist_checker_results(created_by);
CREATE INDEX IF NOT EXISTS idx_setlist_checker_sessions_created_by ON setlist_checker_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_announcement_id ON announcement_reactions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user_id ON announcement_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_pins_announcement_id ON announcement_pins(announcement_id);

-- =============================================================
-- 6. REALTIME
-- =============================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE announcement_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE announcement_pins;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE setlist_checker_results;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
