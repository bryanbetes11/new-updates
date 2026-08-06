import { prepareEventAssignmentBatch } from '../src/lib/eventAssignmentBatch';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const validBatch = prepareEventAssignmentBatch([
  { user_id: 'member-1', role_id: 'role-1' },
  { user_id: 'member-2', role_id: 'role-2' },
], []);
expectEqual(validBatch.assignments.length, 2, 'keeps every unique complete assignment');
expectEqual(validBatch.duplicateCount, 0, 'reports no duplicates for a valid batch');
expectEqual(validBatch.incompleteCount, 0, 'reports no incomplete rows for a valid batch');

const guardedBatch = prepareEventAssignmentBatch([
  { user_id: 'member-1', role_id: 'role-1' },
  { user_id: 'member-1', role_id: 'role-1' },
  { user_id: '', role_id: 'role-2' },
  { user_id: 'member-3', role_id: 'role-3' },
], [{ user_id: 'member-1', role_id: 'role-1' }]);
expectEqual(guardedBatch.assignments.length, 1, 'keeps the remaining unique assignment');
expectEqual(guardedBatch.assignments[0]?.user_id, 'member-3', 'preserves the correct unique member');
expectEqual(guardedBatch.duplicateCount, 2, 'counts existing and in-batch duplicates');
expectEqual(guardedBatch.incompleteCount, 1, 'counts incomplete rows');

const multiRoleBatch = prepareEventAssignmentBatch([
  { user_id: 'member-1', role_id: 'role-1' },
  { user_id: 'member-1', role_id: 'role-2' },
], []);
expectEqual(multiRoleBatch.assignments.length, 2, 'allows one member to hold multiple roles');
