import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/components/LeaveRequestModal.tsx'), 'utf8');

assert.ok(
  source.includes(".in('status', ['pending', 'approved'])"),
  'Expected the overlap query to include pending and approved team leave',
);
assert.ok(
  source.includes(".neq('user_id', userId)"),
  'Expected the overlap query to exclude the current user',
);
assert.ok(
  source.includes('start_date.lte.${selectedEndDate},end_date.gte.${selectedStartDate}'),
  'Expected inclusive overlap filtering for ranged leave',
);

const selectCall = source.match(/\.select\('([^']*profiles!user_availability_user_id_fkey[^']*)'\)/)?.[1] || '';
assert.ok(selectCall, 'Expected a selective team leave query with profile names');
for (const privateField of ['reason', 'approval_notes', 'review_note']) {
  if (selectCall.split(',').includes(privateField)) {
    throw new Error(`Overlap query must not request private field: ${privateField}`);
  }
}

assert.ok(
  source.includes('Team leave could not be checked. You can still submit your request.'),
  'Expected a non-blocking overlap-check error state',
);
assert.ok(!source.includes('|| teamLeaveError'), 'Team leave lookup errors must not disable leave submission');
