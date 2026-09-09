import {
  canAssignMemberToEventRole,
  isNonServingEventAssignmentRole,
  isParticipantRole,
} from '../src/lib/eventAssignmentRoles';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(isParticipantRole('Participant'), true, 'recognizes the Participant event role');
expectEqual(isParticipantRole('Song Leader'), false, 'does not confuse a ministry role with Participant');
expectEqual(
  canAssignMemberToEventRole('Participant', false),
  true,
  'allows an active assignment-enabled member to be selected as Participant without a user role',
);
expectEqual(
  canAssignMemberToEventRole('Keys', false),
  false,
  'keeps normal ministry-role assignments restricted to members with that role',
);
expectEqual(isNonServingEventAssignmentRole('Participant'), true, 'does not treat Participant as a service-mode role');
expectEqual(isNonServingEventAssignmentRole('Song Leader'), false, 'keeps serving roles eligible for service mode');
