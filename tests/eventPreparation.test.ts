import { getEventPreparationHighlight, getEventPreparationSignals, getEventPreparationSummary } from '../src/lib/eventPreparation';

function expectLabels(actual: string[], expected: string[], message: string) {
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`${message}: expected ${expected.join(', ')}, received ${actual.join(', ')}`);
  }
}

const sundayService = { event_type: 'Sunday Service' };
const equipping = { event_type: 'Equipping' };

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 0, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: [] }).map(signal => signal.label),
  ['No team assigned', 'No setlist'],
  'missing team and setlist are both visible',
);

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 3, pendingAssignmentCount: 1, declinedAssignmentCount: 0, setlistStatuses: [] }).map(signal => signal.label),
  ['3 assigned', '1 response pending', 'No setlist'],
  'pending responses do not hide a missing setlist',
);

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 3, pendingAssignmentCount: 0, declinedAssignmentCount: 1, setlistStatuses: ['approved'] }).map(signal => signal.label),
  ['3 assigned', '1 needs coverage', 'Setlist approved'],
  'coverage and setlist states remain independent',
);

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 1, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['approved'] }).map(signal => signal.label),
  ['1 assigned', 'Setlist approved'],
  'one assignment is reported factually instead of declaring the event ready',
);

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 4, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['draft'] }).map(signal => signal.label),
  ['4 assigned', 'Setlist draft'],
  'draft setlists are distinguished from submitted setlists',
);

expectLabels(
  getEventPreparationSignals(sundayService, { assignmentCount: 4, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['pending_review'] }).map(signal => signal.label),
  ['4 assigned', 'Setlist in review'],
  'setlist review is shown independently',
);

expectLabels(
  getEventPreparationSignals(equipping, { assignmentCount: 2, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: [] }).map(signal => signal.label),
  ['2 assigned'],
  'events that do not use setlists only show assignment facts',
);

function expectSummary(
  input: Parameters<typeof getEventPreparationSummary>[1],
  expected: string,
  message: string,
) {
  const actual = getEventPreparationSummary(sundayService, input).label;
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

expectSummary(
  { assignmentCount: 10, pendingAssignmentCount: 7, declinedAssignmentCount: 0, setlistStatuses: ['approved'] },
  '7 responses pending',
  'resolved facts stay out of an attention summary',
);

expectSummary(
  { assignmentCount: 1, pendingAssignmentCount: 1, declinedAssignmentCount: 0, setlistStatuses: ['draft'] },
  '1 response pending · Setlist draft',
  'a compact summary can show two unresolved facts without badges',
);

expectSummary(
  { assignmentCount: 1, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['approved'] },
  '1 assigned · Setlist approved',
  'settled events use factual preparation metadata rather than a ready verdict',
);

expectSummary(
  { assignmentCount: 0, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: [] },
  'No team assigned · No setlist',
  'the two most important blockers remain visible',
);

function expectHighlight(
  input: Parameters<typeof getEventPreparationHighlight>[1],
  expected: string | null,
  message: string,
) {
  const actual = getEventPreparationHighlight(sundayService, input)?.label ?? null;
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

expectHighlight(
  { assignmentCount: 10, pendingAssignmentCount: 7, declinedAssignmentCount: 0, setlistStatuses: ['approved'] },
  '7 responses pending',
  'an unresolved response count becomes the artwork highlight',
);

expectHighlight(
  { assignmentCount: 1, pendingAssignmentCount: 1, declinedAssignmentCount: 0, setlistStatuses: ['draft'] },
  'Setlist draft',
  'the artwork shows only the highest-priority unresolved item',
);

expectHighlight(
  { assignmentCount: 1, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['approved'] },
  null,
  'events without unresolved work stay visually clean',
);

expectHighlight(
  { assignmentCount: 1, teamAssignmentCount: 0, pendingAssignmentCount: 0, declinedAssignmentCount: 0, setlistStatuses: ['approved'] },
  'No team assigned',
  'a confirmed song leader does not count as an assigned serving team',
);
