/*
  # Add Production Director Role

  1. Changes
    - Adds 'Production Director' as a leadership role
    - Sets sort_order to 4 (after Stage Director)
    - Marks as leadership role

  2. Notes
    - Uses ON CONFLICT to avoid duplicates
*/

INSERT INTO roles (name, is_leadership, sort_order)
VALUES ('Production Director', true, 4)
ON CONFLICT (name) DO NOTHING;