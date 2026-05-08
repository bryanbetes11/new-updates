/*
  # Remove Chat Message Notification Triggers

  Chat notifications have been removed from the website UI, so we no longer
  need the database triggers that create notifications for chat messages.

  1. Changes
    - Drop `trg_message_created` trigger on `messages` table
    - Drop `on_event_message_insert_notify` trigger on `event_messages` table
    - Drop the now-unused `on_message_created()` function
    - Drop the now-unused `notify_event_discussion_message()` function

  2. Important Notes
    - No data is deleted; only trigger/function objects are removed
    - Existing notifications already in the `notifications` table are untouched
*/

DROP TRIGGER IF EXISTS trg_message_created ON messages;
DROP TRIGGER IF EXISTS on_event_message_insert_notify ON event_messages;

DROP FUNCTION IF EXISTS on_message_created();
DROP FUNCTION IF EXISTS notify_event_discussion_message();
