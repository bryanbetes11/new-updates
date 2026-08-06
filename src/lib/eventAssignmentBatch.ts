export type EventAssignmentDraft = {
  user_id: string;
  role_id: string;
};

export type EventAssignmentBatch = {
  assignments: EventAssignmentDraft[];
  duplicateCount: number;
  incompleteCount: number;
};

export function getEventAssignmentKey(assignment: EventAssignmentDraft) {
  return `${assignment.user_id}:${assignment.role_id}`;
}

export function prepareEventAssignmentBatch(
  drafts: EventAssignmentDraft[],
  existingAssignments: EventAssignmentDraft[],
): EventAssignmentBatch {
  const seen = new Set(existingAssignments.map(getEventAssignmentKey));
  const assignments: EventAssignmentDraft[] = [];
  let duplicateCount = 0;
  let incompleteCount = 0;

  for (const draft of drafts) {
    if (!draft.user_id || !draft.role_id) {
      incompleteCount += 1;
      continue;
    }

    const key = getEventAssignmentKey(draft);
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(key);
    assignments.push({ user_id: draft.user_id, role_id: draft.role_id });
  }

  return { assignments, duplicateCount, incompleteCount };
}
