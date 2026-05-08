/*
  # Allow leadership roles to update events

  ## Problem
  The existing events UPDATE policy only allows the event creator to update.
  This blocks Admin Coordinators, Production Directors, Music Directors,
  Stage Directors, and Setlist Coordinators from saving event changes,
  even though the frontend correctly shows edit controls for these roles.

  ## Changes
  - Add a new UPDATE policy on the `events` table allowing users whose
    user_roles contain any of the defined leadership role names to update
    any event.
  - The existing creator-only policy is kept — both policies are evaluated
    with OR semantics (if any USING clause passes, the operation is allowed).

  ## Leadership roles granted UPDATE:
    Admin, Admin Coordinator, Music Director, Stage Director,
    Production Director, Setlist Coordinator

  ## Security
  - Only authenticated users with an explicit leadership role assignment
    can use this policy.
  - Regular members and Song Leaders are not affected.
*/

CREATE POLICY "Leadership can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN (
          'Admin',
          'Admin Coordinator',
          'Music Director',
          'Stage Director',
          'Production Director',
          'Setlist Coordinator'
        )
    )
  );
