import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const events = readFileSync(resolve(process.cwd(), 'src/pages/Events.tsx'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

assert.match(
  events,
  /artworkClassName="event-list-artwork h-24 w-24"/,
  'desktop event rows should expose a dedicated artwork hook for iPad density',
);
assert.match(
  styles,
  /:root\[data-ipad-layout="true"\] \.event-list-artwork \{[\s\S]*?width: 5rem !important;[\s\S]*?height: 5rem !important;/,
  'iPad landscape should reduce event-list artwork from 96px to 80px',
);
