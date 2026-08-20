export type EventAssignmentGateRow = {
  user_id: string;
  status: string;
  roles?: { name?: string | null } | null;
};

export function getUserEventAssignments<T extends EventAssignmentGateRow>(
  assignments: T[],
  userId?: string | null,
) {
  if (!userId) return [];
  return assignments.filter(assignment => assignment.user_id === userId);
}

export function getPendingUserEventAssignments<T extends EventAssignmentGateRow>(
  assignments: T[],
  userId?: string | null,
) {
  return getUserEventAssignments(assignments, userId)
    .filter(assignment => assignment.status === 'pending');
}

export function shouldBlockEventDetails<T extends EventAssignmentGateRow>(
  assignments: T[],
  userId: string | null | undefined,
  hasEventManagementAccess: boolean,
) {
  const userAssignments = getUserEventAssignments(assignments, userId);
  if (hasEventManagementAccess) return false;
  if (userAssignments.some(assignment => assignment.roles?.name === 'Song Leader')) return false;
  return userAssignments.some(assignment => assignment.status === 'pending');
}
