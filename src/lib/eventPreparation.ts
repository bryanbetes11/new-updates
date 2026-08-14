import type { Event } from '../types';

export type EventPreparationInput = {
  assignmentCount: number;
  teamAssignmentCount?: number;
  pendingAssignmentCount: number;
  declinedAssignmentCount: number;
  setlistStatuses: string[];
};

export type EventPreparationSignal = {
  key: 'team' | 'responses' | 'setlist';
  label: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
};

export type EventPreparationSummary = {
  label: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'danger';
};

export type EventPreparationHighlight = {
  label: string;
  detail: string;
  tone: 'warning' | 'danger';
};

const SETLIST_EVENT_TYPES = new Set([
  'Sunday Service',
  'Prayer Meeting',
  'LGTF (Midweek)',
  'Youth Recharge',
]);

export function eventRequiresSetlist(event: Pick<Event, 'event_type'>) {
  return SETLIST_EVENT_TYPES.has(event.event_type);
}

export function getEventPreparationSignals(
  event: Pick<Event, 'event_type'>,
  input: EventPreparationInput,
): EventPreparationSignal[] {
  const signals: EventPreparationSignal[] = [];
  const teamAssignmentCount = input.teamAssignmentCount ?? input.assignmentCount;

  signals.push(teamAssignmentCount === 0
    ? {
        key: 'team',
        label: 'No team assigned',
        detail: 'No serving assignments have been added',
        tone: 'danger',
      }
    : {
        key: 'team',
        label: `${teamAssignmentCount} assigned`,
        detail: `${teamAssignmentCount} team assignment${teamAssignmentCount === 1 ? '' : 's'} added`,
        tone: 'neutral',
      });

  if (input.declinedAssignmentCount > 0) {
    signals.push({
      key: 'responses',
      label: `${input.declinedAssignmentCount} need${input.declinedAssignmentCount === 1 ? 's' : ''} coverage`,
      detail: `${input.declinedAssignmentCount} declined assignment${input.declinedAssignmentCount === 1 ? '' : 's'}`,
      tone: 'danger',
    });
  } else if (input.pendingAssignmentCount > 0) {
    signals.push({
      key: 'responses',
      label: `${input.pendingAssignmentCount} response${input.pendingAssignmentCount === 1 ? '' : 's'} pending`,
      detail: `${input.pendingAssignmentCount} assignment${input.pendingAssignmentCount === 1 ? '' : 's'} still awaiting confirmation`,
      tone: 'warning',
    });
  }

  if (eventRequiresSetlist(event)) {
    if (input.setlistStatuses.includes('approved')) {
      signals.push({
        key: 'setlist',
        label: 'Setlist approved',
        detail: 'The event has an approved setlist',
        tone: 'success',
      });
    } else if (input.setlistStatuses.includes('pending_review')) {
      signals.push({
        key: 'setlist',
        label: 'Setlist in review',
        detail: 'Leadership review is pending',
        tone: 'warning',
      });
    } else if (input.setlistStatuses.includes('draft')) {
      signals.push({
        key: 'setlist',
        label: 'Setlist draft',
        detail: 'A draft exists but has not been submitted',
        tone: 'warning',
      });
    } else {
      signals.push({
        key: 'setlist',
        label: 'No setlist',
        detail: 'No setlist has been created for this event',
        tone: 'danger',
      });
    }
  }

  return signals;
}

export function getEventPreparationSummary(
  event: Pick<Event, 'event_type'>,
  input: EventPreparationInput,
): EventPreparationSummary {
  const signals = getEventPreparationSignals(event, input);
  const unresolved = signals.filter(signal => signal.tone === 'danger' || signal.tone === 'warning');
  const orderedUnresolved = [...unresolved].sort((left, right) => {
    const priority = (signal: EventPreparationSignal) => {
      if (signal.label === 'No team assigned') return 0;
      if (signal.key === 'responses' && signal.tone === 'danger') return 1;
      if (signal.label === 'No setlist') return 2;
      if (signal.key === 'responses') return 3;
      return 4;
    };

    return priority(left) - priority(right);
  });

  const visibleSignals = orderedUnresolved.length > 0
    ? orderedUnresolved.slice(0, 2)
    : signals.filter(signal => signal.key === 'team' || signal.key === 'setlist').slice(0, 2);

  return {
    label: visibleSignals.map(signal => signal.label).join(' · '),
    detail: signals.map(signal => signal.detail).join('. '),
    tone: orderedUnresolved.some(signal => signal.tone === 'danger')
      ? 'danger'
      : orderedUnresolved.length > 0
        ? 'warning'
        : 'neutral',
  };
}

export function getEventPreparationHighlight(
  event: Pick<Event, 'event_type'>,
  input: EventPreparationInput,
): EventPreparationHighlight | null {
  const signals = getEventPreparationSignals(event, input);
  const unresolved = signals.filter(signal => signal.tone === 'danger' || signal.tone === 'warning');
  const primary = [...unresolved].sort((left, right) => {
    const priority = (signal: EventPreparationSignal) => {
      if (signal.label === 'No team assigned') return 0;
      if (signal.key === 'responses' && signal.tone === 'danger') return 1;
      if (signal.label === 'No setlist') return 2;
      if (signal.key === 'setlist') return 3;
      return 4;
    };

    return priority(left) - priority(right);
  })[0];

  if (!primary) return null;

  return {
    label: primary.label,
    detail: signals.map(signal => signal.detail).join('. '),
    tone: primary.tone === 'danger' ? 'danger' : 'warning',
  };
}
