import { differenceInCalendarDays, parseISO } from 'date-fns';

export function churchToday(now = new Date(), timeZone = 'Asia/Manila') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function relativeEventDay(eventDate: string, today = churchToday()) {
  const days = differenceInCalendarDays(parseISO(eventDate), parseISO(today));
  if (!Number.isFinite(days)) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export interface LeaveDates { status: string; request_type?: string | null; leave_type?: string | null; unavailable_date?: string | null; start_date?: string | null; end_date?: string | null }
export function nextApprovedLeave<T extends LeaveDates>(leaves: T[], today = churchToday()): T | undefined {
  return leaves.filter(leave => leave.status === 'approved' && (!leave.request_type || leave.request_type === 'leave') &&
    (leave.leave_type === 'range' ? (leave.end_date || leave.start_date || '') : (leave.unavailable_date || '')) >= today)
    .sort((a, b) => String(a.start_date || a.unavailable_date).localeCompare(String(b.start_date || b.unavailable_date)))[0];
}
