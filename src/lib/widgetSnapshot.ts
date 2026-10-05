import { compareEventSchedule } from './eventChronology';
import { formatTime12Hour } from './timeFormat';

export interface WidgetEvent {
  id: string; org_id?: string; title: string; event_date: string; start_time: string;
  lifecycle_override?: string | null;
}
export interface WidgetAssignment {
  id: string; user_id: string; status: string;
  events: WidgetEvent | null; roles: { name: string } | null;
}
export interface WidgetCard {
  id: string; title: string; subtitle: string; detail: string; route: string;
  date?: string; items?: string[];
}
export interface WidgetSnapshot {
  scope: string; updatedAt: number; churchName: string;
  assignments: WidgetCard[]; pending: WidgetCard[]; pendingCount: number;
  setlists: WidgetCard[]; announcements: WidgetCard[]; unavailable: string[];
}

export function widgetToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function widgetText(value: unknown, limit = 160): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

export function widgetEventLabel(event: WidgetEvent) {
  // Date-only values must not shift with the phone's timezone.
  const date = new Date(`${event.event_date}T12:00:00+08:00`);
  const label = Number.isNaN(date.getTime()) ? event.event_date : new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
  }).format(date);
  return `${label}${event.start_time ? ` · ${formatTime12Hour(event.start_time)}` : ''}`;
}

export function assignmentCards(rows: WidgetAssignment[], userId: string, orgId: string, today: string, pending = false): WidgetCard[] {
  return rows.filter(row => row.user_id === userId && row.events?.org_id === orgId &&
    (pending ? row.status === 'pending' : row.status !== 'declined' && row.events.event_date >= today && row.events.lifecycle_override !== 'completed'))
    .sort((a, b) => compareEventSchedule(a.events!, b.events!))
    .slice(0, 40).map(row => ({
      id: row.id, title: widgetText(row.events!.title), subtitle: widgetEventLabel(row.events!),
      detail: `${widgetText(row.roles?.name || 'Team member', 60)} · ${row.status === 'confirmed' ? 'Confirmed' : 'Awaiting response'}`,
      route: pending ? '/my-assignments?status=pending' : `/events/${row.events!.id}`,
      date: row.events!.event_date,
    }));
}

export function validWidgetRoute(route: unknown): route is string {
  return typeof route === 'string' && (/^\/(dashboard|events|my-assignments|library|announcements|messages)$/.test(route) ||
    route === '/my-assignments?status=pending' || /^\/(events|announcements)\/[a-zA-Z0-9-]+$/.test(route));
}
