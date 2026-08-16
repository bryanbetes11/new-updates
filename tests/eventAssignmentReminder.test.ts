import { getPendingAssignmentUserCount } from '../src/lib/eventAssignmentReminder';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(getPendingAssignmentUserCount([
  { user_id: 'member-1', status: 'pending' },
  { user_id: 'member-1', status: 'pending' },
  { user_id: 'member-2', status: 'pending' },
]), 2, 'counts a pending member once when they have multiple roles');

expectEqual(getPendingAssignmentUserCount([
  { user_id: 'member-1', status: 'confirmed' },
  { user_id: 'member-2', status: 'declined' },
  { user_id: 'member-3', status: 'pending' },
]), 1, 'excludes confirmed and declined assignments');

expectEqual(getPendingAssignmentUserCount([]), 0, 'handles an event with no assignments');
