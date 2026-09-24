import { hasEventScheduleEnded, isEventCompleted } from './eventLifecycle';
import type { Event } from '../types';

export type SetlistReminderEvent = Pick<Event, 'event_date' | 'start_time' | 'end_time' | 'lifecycle_override' | 'proposal_due_date' | 'setlist_required'>;
export const SETLIST_REMINDER_COOLDOWN_MS = 10 * 60 * 1000;

type ProposalState = string | null | { status: string; submitted_at?: string | null };

export function getSetlistReminderState(event: SetlistReminderEvent, statuses: ProposalState[], now = new Date()): 'overdue' | 'due_soon' | null {
  if (event.setlist_required === false || isEventCompleted(event) || hasEventScheduleEnded(event, now)) return null;
  if (statuses.some(proposal => {
    const status = typeof proposal === 'object' ? proposal?.status : proposal;
    const submitted = typeof proposal === 'object' && proposal?.submitted_at;
    return Boolean(submitted) || ['approved', 'pending_review', 'revision_requested', 'rejected'].includes(status || '');
  })) return null;
  const due = new Date(event.proposal_due_date || '').getTime();
  if (!Number.isFinite(due) || due - now.getTime() > 3 * 86400000) return null;
  return due < now.getTime() ? 'overdue' : 'due_soon';
}

export function setlistReminderWaitMinutes(lastSent: string | null, now = Date.now()) {
  const sent = new Date(lastSent || '').getTime();
  return Number.isFinite(sent) ? Math.max(0, Math.ceil((sent + SETLIST_REMINDER_COOLDOWN_MS - now) / 60000)) : 0;
}
