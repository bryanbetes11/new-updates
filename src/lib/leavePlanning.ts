import { addDays, format, isValid, parseISO, subDays } from 'date-fns';

/** Planning context only: this never extends the member's requested leave. */
export function getFollowingSunday(endDate: string | null) {
  if (!endDate) return null;
  const end = parseISO(endDate);
  return isValid(end) && end.getDay() === 6 ? format(addDays(end, 1), 'yyyy-MM-dd') : null;
}

export function getLeavePlanningEvents<T extends { event_date: string }>(events: T[], start: string | null, end: string | null) {
  if (!start || !end || end < start) return [];
  const followingSunday = getFollowingSunday(end);
  return events.filter(event => (event.event_date >= start && event.event_date <= end) || event.event_date === followingSunday);
}

export function getLeaveHistoryFilters(now = new Date()) {
  const today = format(now, 'yyyy-MM-dd');
  const cutoff = format(subDays(now, 90), 'yyyy-MM-dd');
  return {
    recent: `and(leave_type.eq.single,unavailable_date.gte.${cutoff},unavailable_date.lt.${today}),and(leave_type.eq.range,end_date.gte.${cutoff},end_date.lt.${today})`,
    upcoming: `and(leave_type.eq.single,unavailable_date.gte.${today}),and(leave_type.eq.range,end_date.gte.${today})`,
  };
}

export function summarizeTeamLeave(leaves: { user_id: string; status: string }[]) {
  const approved = new Set(leaves.filter(leave => leave.status === 'approved').map(leave => leave.user_id));
  const pending = new Set(leaves.filter(leave => leave.status === 'pending' && !approved.has(leave.user_id)).map(leave => leave.user_id));
  return { approved: approved.size, pending: pending.size, total: approved.size + pending.size };
}
