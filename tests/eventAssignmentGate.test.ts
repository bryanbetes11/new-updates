import {
  getPendingUserEventAssignments,
  shouldBlockEventDetails,
} from '../src/lib/eventAssignmentGate';

type Assignment = {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'declined';
  roles: { name: string };
};

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const assignments: Assignment[] = [
  { id: 'song-leader', user_id: 'leader', status: 'confirmed', roles: { name: 'Song Leader' } },
  { id: 'guitar', user_id: 'leader', status: 'pending', roles: { name: 'Guitar' } },
  { id: 'drums', user_id: 'member', status: 'pending', roles: { name: 'Drums' } },
  { id: 'lights', user_id: 'member', status: 'pending', roles: { name: 'Lights' } },
  { id: 'keys', user_id: 'confirmed-member', status: 'confirmed', roles: { name: 'Keys' } },
  { id: 'audio', user_id: 'declined-member', status: 'declined', roles: { name: 'Audio' } },
];

expectEqual(
  getPendingUserEventAssignments(assignments, 'leader').map(assignment => assignment.id).join(','),
  'guitar',
  'returns a pending secondary role when the Song Leader role is already confirmed',
);

expectEqual(
  getPendingUserEventAssignments(assignments, 'member').length,
  2,
  'returns every pending role for the current member',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'member', false),
  true,
  'blocks a scheduled member with any pending role',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'leader', false),
  false,
  'does not block an event-assigned Song Leader who has another pending role',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'confirmed-member', false),
  false,
  'does not block a member whose assignment is confirmed',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'declined-member', false),
  false,
  'does not block a member whose assignment is declined',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'unscheduled-member', false),
  false,
  'does not block an unscheduled member',
);

expectEqual(
  shouldBlockEventDetails(assignments, 'member', true),
  false,
  'does not block a member with event-management access',
);
