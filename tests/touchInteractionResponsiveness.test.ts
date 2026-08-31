import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const globalStyles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const eventDetail = readFileSync(new URL('../src/pages/EventDetail.tsx', import.meta.url), 'utf8');

assert.match(
  globalStyles,
  /:is\(button, a\[href\], \[role="button"\], \[role="tab"\][^}]+touch-action: manipulation;/s,
  'shared interactive controls should resolve taps without a browser gesture delay',
);

assert.match(
  eventDetail,
  /title="Preview Live Mode"[\s\S]*?mobileView="dialog"[\s\S]*?instantOpen/,
  'the Live Mode audience picker should be an immediately mounted mobile dialog',
);

assert.match(
  eventDetail,
  /className="grid grid-cols-2 gap-2\.5 sm:gap-3"/,
  'Stage and Tech choices should stay side by side on phone layouts',
);
