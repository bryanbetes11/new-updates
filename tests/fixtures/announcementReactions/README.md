# Announcement reaction verification

Run `npm run test:announcement-reactions` for isolated PostgreSQL tests of the real notification producer, RLS, recipients, templates, and notification delivery configuration. No production database or push service is used.

For browser verification, run `node node_modules/vite/bin/vite.js --config tests/fixtures/announcementReactions/vite.config.mjs` and open `http://127.0.0.1:5179/announcements/fixture-announcement`. The fixture renders the production announcement page and reaction component with an isolated database adapter.

From a fresh fixture load, execute `check.js` with `agent-browser eval --stdin`. It checks add/remove, counts, keyboard/outside dismissal, duplicate-click protection, failed saves/reads and retries, stale-read protection, and mobile bounds. Inspect at 430x932 and desktop sizes. The fixture has no real users and cannot send notifications.

Production migration `20260912183404_announcement_reaction_notifications.sql` was applied to the connected database. Notifications are generated only for new reactions, never backfilled. The normal notification settings/preferences and push pipeline remain in control of delivery. Browser tests do not prove delivery to a physical device.
