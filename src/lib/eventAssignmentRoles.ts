export const PARTICIPANT_ROLE_NAME = 'Participant';

export function isParticipantRole(roleName: string | null | undefined) {
  return roleName === PARTICIPANT_ROLE_NAME || roleName === 'All Members';
}

export function canAssignMemberToEventRole(
  roleName: string | null | undefined,
  memberHasRole: boolean,
) {
  return isParticipantRole(roleName) || memberHasRole;
}

export function isNonServingEventAssignmentRole(roleName: string | null | undefined) {
  return roleName === 'All Members' || isParticipantRole(roleName);
}
