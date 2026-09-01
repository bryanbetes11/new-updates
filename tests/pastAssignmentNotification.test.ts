import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260901000000_suppress_past_assignment_response_notifications.sql'),
  'utf8',
);

assert.match(
  migration,
  /v_main_event\.event_date\s*<\s*\(now\(\) at time zone 'Asia\/Manila'\)::date[\s\S]*?return new;/i,
  'past assignment responses must exit before generating a notification',
);

assert.match(
  migration,
  /if lower\(coalesce\(v_event\.event_type,[\s\S]*?v_event\.linked_event_id[\s\S]*?v_main_event := v_event;/i,
  'linked rehearsal responses must determine notification age from the main event',
);
