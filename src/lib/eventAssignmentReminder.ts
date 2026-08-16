export type AssignmentResponse = {
  user_id: string;
  status: string;
};

export function getPendingAssignmentUserCount(assignments: AssignmentResponse[]) {
  return new Set(
    assignments
      .filter(assignment => assignment.status === 'pending')
      .map(assignment => assignment.user_id)
  ).size;
}
