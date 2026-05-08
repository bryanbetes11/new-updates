/*
  # Rename Admin to Admin Coordinator and reorder roles

  1. Changes
    - Rename "Admin" role to "Admin Coordinator"
    - Add new "Setlist Coordinator" leadership role
    - Reorder roles: Production Director, Music Director, Admin Coordinator, Stage Director, Setlist Coordinator, then others

  2. New Role Order
    1. Production Director
    2. Music Director
    3. Admin Coordinator (renamed from Admin)
    4. Stage Director
    5. Setlist Coordinator (new)
    6. Song Leader
    7. Band Member
    8. Keys
    9. Guitar
    10. Bass
    11. Drums
    12. Backup Vocals
    13. Visuals
    14. Lights
    15. Audio
*/

-- Rename Admin to Admin Coordinator
UPDATE roles 
SET name = 'Admin Coordinator' 
WHERE name = 'Admin';

-- Add Setlist Coordinator role if it doesn't exist
INSERT INTO roles (id, name, sort_order, is_leadership)
VALUES (gen_random_uuid(), 'Setlist Coordinator', 5, true)
ON CONFLICT DO NOTHING;

-- Reorder roles
UPDATE roles SET sort_order = 1 WHERE name = 'Production Director';
UPDATE roles SET sort_order = 2 WHERE name = 'Music Director';
UPDATE roles SET sort_order = 3 WHERE name = 'Admin Coordinator';
UPDATE roles SET sort_order = 4 WHERE name = 'Stage Director';
UPDATE roles SET sort_order = 5 WHERE name = 'Setlist Coordinator';
UPDATE roles SET sort_order = 6 WHERE name = 'Song Leader';
UPDATE roles SET sort_order = 7 WHERE name = 'Band Member';
UPDATE roles SET sort_order = 8 WHERE name = 'Keys';
UPDATE roles SET sort_order = 9 WHERE name = 'Guitar';
UPDATE roles SET sort_order = 10 WHERE name = 'Bass';
UPDATE roles SET sort_order = 11 WHERE name = 'Drums';
UPDATE roles SET sort_order = 12 WHERE name = 'Backup Vocals';
UPDATE roles SET sort_order = 13 WHERE name = 'Visuals';
UPDATE roles SET sort_order = 14 WHERE name = 'Lights';
UPDATE roles SET sort_order = 15 WHERE name = 'Audio';