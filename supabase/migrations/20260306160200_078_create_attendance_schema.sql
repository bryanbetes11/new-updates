/*
  # Create Attendance Tracking Schema

  1. New Tables
    - `event_attendance`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `user_id` (uuid, references profiles)
      - `status` (text: 'present', 'late', 'absent')
      - `checked_in_at` (timestamptz, when attendance was marked)
      - `is_assigned` (boolean, true if user has event_assignment)
      - `notes` (text, optional remarks)
      - `created_at`, `updated_at` (timestamps)

    - `attendance_offense_notifications`
      - Tracks which offense levels have been notified to prevent duplicates
      - `id`, `user_id`, `quarter_year`, `quarter_number`, `offense_level`, `notified_at`

  2. Security
    - Enable RLS on both tables
    - Users can insert/update their own attendance
    - Leadership can view all attendance records
    - Only service role can auto-mark absences

  3. Indexes
    - Index on event_id, user_id, status for query performance
*/

-- Create event_attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent')),
  checked_in_at timestamptz,
  is_assigned boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user_id ON event_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_status ON event_attendance(status);
CREATE INDEX IF NOT EXISTS idx_event_attendance_checked_in_at ON event_attendance(checked_in_at);

-- Create attendance_offense_notifications table to track notified offenses
CREATE TABLE IF NOT EXISTS attendance_offense_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quarter_year integer NOT NULL,
  quarter_number integer NOT NULL CHECK (quarter_number BETWEEN 1 AND 4),
  offense_level integer NOT NULL CHECK (offense_level BETWEEN 1 AND 4),
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quarter_year, quarter_number, offense_level)
);

CREATE INDEX IF NOT EXISTS idx_attendance_offense_notifications_user_quarter 
  ON attendance_offense_notifications(user_id, quarter_year, quarter_number);

-- Enable RLS
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_offense_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendance

-- Users can view their own attendance
CREATE POLICY "Users can view own attendance"
  ON event_attendance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Leadership can view all attendance
CREATE POLICY "Leadership can view all attendance"
  ON event_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_leadership = true
    )
  );

-- Users can insert their own attendance
CREATE POLICY "Users can insert own attendance"
  ON event_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own attendance
CREATE POLICY "Users can update own attendance"
  ON event_attendance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for attendance_offense_notifications

-- Leadership can view offense notifications
CREATE POLICY "Leadership can view offense notifications"
  ON attendance_offense_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_leadership = true
    )
  );

-- Leadership can insert offense notifications (for the trigger)
CREATE POLICY "Leadership can insert offense notifications"
  ON attendance_offense_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.is_leadership = true
    )
  );

-- Add foreign key hint for PostgREST to enable joins
COMMENT ON CONSTRAINT event_attendance_user_id_fkey ON event_attendance IS 
  E'@foreignKey (user_id) REFERENCES profiles (id)|@fieldName profile|@foreignFieldName attendances';

COMMENT ON CONSTRAINT event_attendance_event_id_fkey ON event_attendance IS 
  E'@foreignKey (event_id) REFERENCES events (id)|@fieldName event|@foreignFieldName attendances';
