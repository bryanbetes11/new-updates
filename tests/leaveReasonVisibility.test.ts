import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const eventsSource = fs.readFileSync(path.resolve('src/pages/Events.tsx'), 'utf8');
const calendarSource = fs.readFileSync(path.resolve('src/components/CalendarGrid.tsx'), 'utf8');
const dashboardSource = fs.readFileSync(path.resolve('src/pages/Dashboard.tsx'), 'utf8');

assert.match(
  eventsSource,
  /select\('user_id, request_type, leave_type, unavailable_date, start_date, end_date, status, reason, profiles!user_availability_user_id_fkey/,
  'Events must load the approved leave reason alongside the member identity',
);
assert.match(
  eventsSource,
  /reason: availability\.reason \|\| undefined/,
  'Events must carry each leave reason into the event availability entries',
);
assert.ok(
  eventsSource.includes('View reason{dayEntries.length === 1 ? \'\' : \'s\'}'),
  'Event cards must provide a compact path to each unavailable member reason',
);
assert.ok(
  eventsSource.includes('role="button" tabIndex={0}') && eventsSource.includes('event.key === \'Enter\' || event.key === \' \'') ,
  'The compact reason control must remain keyboard accessible without nesting a button inside the event button',
);
assert.ok(
  eventsSource.includes('w-fit max-w-full') && eventsSource.includes('py-0.5') && eventsSource.includes('touch-manipulation') && eventsSource.includes('rounded-full border border-amber-400/25'),
  'The compact reason control must remain touch-friendly, compact, and visibly button-like',
);
assert.match(
  eventsSource,
  /title=\{`Unavailable for \$\{format\(parseISO\(event\.event_date\), 'MMM d'\)\}`\} size="sm" mobileView="dialog"/,
  'Leave reasons must use a floating dialog presentation on mobile',
);
assert.match(
  calendarSource,
  /entry\.reason \? ` — \$\{entry\.reason\}` : ''/,
  'Calendar cells must show why an unavailable member is out',
);
assert.match(
  dashboardSource,
  /member\.reason \? ` · \$\{member\.reason\}` : ''/,
  'Home Team Availability rows must show the leave reason',
);
