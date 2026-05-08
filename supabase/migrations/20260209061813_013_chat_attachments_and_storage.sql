/*
  # Chat Attachments and Storage

  1. Changes to Messages
    - Add `file_url` text column for file/photo attachments
    - Add `file_type` text column for classifying attachment type (image, file)

  2. Changes to Event Messages
    - Add `file_url` text column for file/photo attachments
    - Add `file_type` text column for classifying attachment type

  3. Storage
    - Create `chat-attachments` bucket for chat file uploads
    - Add INSERT policy for authenticated users
    - Add SELECT policy for public access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN file_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_messages' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE event_messages ADD COLUMN file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_messages' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE event_messages ADD COLUMN file_type text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated users can upload chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat attachments"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chat-attachments');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Anyone can view chat attachments'
  ) THEN
    CREATE POLICY "Anyone can view chat attachments"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'chat-attachments');
  END IF;
END $$;
