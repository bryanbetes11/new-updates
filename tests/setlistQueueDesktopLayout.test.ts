import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/leadership/SetlistDeadlines.tsx', import.meta.url), 'utf8');
const desktopStyles = readFileSync(new URL('../src/desktop-workspace.css', import.meta.url), 'utf8');

assert.match(
  page,
  /desktop-deadline-mobile-card[\s\S]*?lg:hidden/,
  'the existing setlist deadline card should remain the mobile presentation',
);

assert.match(
  page,
  /desktop-deadline-table-head hidden lg:grid[\s\S]*?Event \/ date[\s\S]*?Song leader[\s\S]*?Status \/ age[\s\S]*?Deadline[\s\S]*?Reminders \/ actions/,
  'desktop setlist deadlines should expose aligned, descriptive queue columns',
);

assert.match(
  page,
  /desktop-deadline-table-row hidden[\s\S]*?lg:grid/,
  'the table-like queue rows should only render visually at desktop widths',
);

assert.match(
  page,
  /desktop-deadline-table-row[\s\S]*?handleSendReminder\(event\)[\s\S]*?recentlySent[\s\S]*?!event\.song_leader/,
  'desktop rows must retain reminder cooldown and missing-leader safeguards',
);

assert.match(
  page,
  /desktop-deadline-entry[\s\S]*?EditDueDatePopover[\s\S]*?handleSaveDueDate/,
  'the shared deadline editor must remain available to both responsive presentations',
);

assert.match(
  desktopStyles,
  /desktop-deadline-table-main[\s\S]*?grid-template-columns:[^;]+;/,
  'desktop queue data should use a stable aligned column grid',
);
