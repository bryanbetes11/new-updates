import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/components/Modal.tsx'), 'utf8');

assert.match(
  source,
  /const shouldRender = open \|\| visible;/,
  'an opening modal must render from the open prop without waiting for mirrored state',
);

assert.match(
  source,
  /if \(!shouldRender\) return null;/,
  'the portal render guard must use the immediate open-or-visible state',
);

assert.doesNotMatch(
  source,
  /if \(!visible\) return null;/,
  'the modal must not wait for an effect to copy open into visible before mounting',
);

assert.match(
  source,
  /animationDuration: quickOpen && !closing \? '140ms' : undefined/,
  'quick-opening dialogs must keep a short entrance animation instead of feeling delayed',
);
