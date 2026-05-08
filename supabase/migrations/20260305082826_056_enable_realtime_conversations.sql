/*
  # Enable Real-time for Conversations Table

  1. Changes
    - Enable real-time replication for the conversations table
    - This allows clients to subscribe to INSERT, UPDATE, and DELETE events on conversations

  2. Purpose
    - Ensures chat conversations list updates in real-time across all connected clients
    - No need to refresh the page to see new conversations or updates
*/

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
