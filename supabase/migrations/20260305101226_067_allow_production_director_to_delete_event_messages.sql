/*
  # Allow Production Director to Delete Event Messages

  1. Changes
    - Add RLS policy allowing Production Director role to delete any event message
    - This allows Production Directors to moderate event discussions and remove unintentional or inappropriate messages

  2. Security
    - Only users with the Production Director role can delete any message
    - Regular users can still only delete their own messages (existing policy)
*/

CREATE POLICY "Production Directors can delete any event message"
  ON event_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      JOIN roles ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = auth.uid()
      AND roles.name = 'Production Director'
    )
  );
