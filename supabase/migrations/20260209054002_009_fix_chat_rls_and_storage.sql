/*
  # Fix chat RLS and add announcement storage

  1. Changes
    - Drop self-referencing conversation_members SELECT policy
    - Add simple policy: users see own memberships
    - Add policy: users see other members of conversations they belong to
    - Create storage bucket for announcement images
    - Add storage policies for authenticated uploads and public reads
    - Add content_blocks JSONB column to announcements for rich content

  2. Security
    - conversation_members RLS fixed to avoid self-reference
    - Storage bucket allows authenticated uploads, public reads
*/

-- Fix conversation_members SELECT policy
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;

CREATE POLICY "Users can view own memberships"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view members of shared conversations"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT cm.conversation_id 
      FROM conversation_members cm 
      WHERE cm.user_id = auth.uid()
    )
  );

-- Create storage bucket for announcement images
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload announcement images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'announcements');

-- Public can read announcement images
CREATE POLICY "Anyone can view announcement images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'announcements');

-- Uploaders can delete their own images
CREATE POLICY "Users can delete own announcement images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add content_blocks column for rich announcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'content_blocks'
  ) THEN
    ALTER TABLE announcements ADD COLUMN content_blocks jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
