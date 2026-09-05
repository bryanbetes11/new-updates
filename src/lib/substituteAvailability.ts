import type { LeaveDates } from './workflowDates';

export interface ConflictEvent { id: string; event_date: string; start_time?: string | null; end_time?: string | null; title?: string }
export function leaveCoversDate(leave: LeaveDates, date: string) {
  if (leave.status !== 'approved' || (leave.request_type && leave.request_type !== 'leave')) return false;
  const start = leave.leave_type === 'single' ? leave.unavailable_date : leave.start_date;
  const end = leave.leave_type === 'single' ? leave.unavailable_date : leave.end_date || start;
  return Boolean(start && end && start <= date && end >= date);
}
export function eventsOverlap(a: ConflictEvent, b: ConflictEvent) {
  if (a.id === b.id || a.event_date !== b.event_date) return false;
  // Missing schedule bounds cannot establish availability; show a warning.
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return true;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}
