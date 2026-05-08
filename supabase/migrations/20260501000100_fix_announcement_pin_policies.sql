/*
  # Fix announcement pin policies

  The announcement pin UI writes to `announcement_pins`. The app treats
  AuthContext leadership roles as pin-capable, so keep the database policy in
  sync with those role names and make upsert/update-safe access explicit.
*/

UPDATE roles
SET is_leadership = true
WHERE name IN (
  'Admin',
  'Admin Coordinator',
  'Music Director',
  'Stage Director',
  'Production Director',
  'Setlist Coordinator'
);

DROP POLICY IF EXISTS "Leaders can pin announcements" ON announcement_pins;
DROP POLICY IF EXISTS "Leaders can update announcement pins" ON announcement_pins;
DROP POLICY IF EXISTS "Leaders can unpin announcements" ON announcement_pins;

CREATE POLICY "Leaders can pin announcements"
  ON announcement_pins FOR INSERT
  TO authenticated
  WITH CHECK (
    pinned_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND (
        r.is_leadership = true
        OR r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
      )
    )
  );

CREATE POLICY "Leaders can update announcement pins"
  ON announcement_pins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND (
        r.is_leadership = true
        OR r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
      )
    )
  )
  WITH CHECK (
    pinned_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND (
        r.is_leadership = true
        OR r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
      )
    )
  );

CREATE POLICY "Leaders can unpin announcements"
  ON announcement_pins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
      AND (
        r.is_leadership = true
        OR r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
      )
    )
  );
