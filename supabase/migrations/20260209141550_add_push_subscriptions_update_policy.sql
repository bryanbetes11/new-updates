/*
  # Add UPDATE Policy for Push Subscriptions

  1. Security Changes
    - Add UPDATE policy for `push_subscriptions` table
    - Allows users to update their own push subscription data
    - This is needed for upsert operations when re-subscribing

  ## Notes
  - The upsert operation in the Profile page requires both INSERT and UPDATE permissions
  - Without the UPDATE policy, upserts will fail on conflict
*/

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
