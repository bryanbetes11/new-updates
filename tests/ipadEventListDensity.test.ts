import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const events = readFileSync(resolve(process.cwd(), 'src/pages/Events.tsx'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

assert.match(
  events,
  /artworkClassName="event-list-artwork h-12 w-12"/,
  'desktop event rows should expose a dedicated artwork hook for iPad density',
);
assert.match(
  styles,
  /:root\[data-ipad-layout="true"\] \.event-list-artwork \{[\s\S]*?width: 3rem !important;[\s\S]*?height: 3rem !important;/,
  'iPad landscape should keep compact event-list artwork at 48px',
);
