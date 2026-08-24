import { format, parseISO, subDays } from 'date-fns';
import type { ServiceFormat } from '../types';

export type SetlistSubmissionMode = 'advisory' | 'block_rejected';

export interface EventTemplatePolicy {
  start_time: string;
  end_time: string;
  /** Leave blank to create events without an automatic setlist deadline. */
  setlist_due_days_before: number | null;
  service_format: ServiceFormat;
}

export type EventTemplatePolicies = Record<string, EventTemplatePolicy>;

export const DEFAULT_EVENT_TEMPLATE_POLICIES: EventTemplatePolicies = {
  'Sunday Service': { start_time: '07:30', end_time: '11:30', setlist_due_days_before: 21, service_format: 'sunday_full' },
  'LGTF (Midweek)': { start_time: '19:30', end_time: '21:00', setlist_due_days_before: 3, service_format: 'sunday_short' },
  'Prayer Meeting': { start_time: '18:30', end_time: '19:30', setlist_due_days_before: 6, service_format: 'sunday_short' },
  'Online Devotion': { start_time: '21:00', end_time: '22:00', setlist_due_days_before: null, service_format: 'opening_closing_only' },
  Equipping: { start_time: '19:30', end_time: '21:00', setlist_due_days_before: null, service_format: 'custom' },
  'Youth Recharge': { start_time: '16:00', end_time: '18:00', setlist_due_days_before: 7, service_format: 'custom' },
  Rehearsals: { start_time: '', end_time: '', setlist_due_days_before: null, service_format: 'custom' },
  'Revamp Session': { start_time: '', end_time: '', setlist_due_days_before: null, service_format: 'custom' },
  Custom: { start_time: '', end_time: '', setlist_due_days_before: null, service_format: 'custom' },
};

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isServiceFormat(value: unknown): value is ServiceFormat {
  return value === 'sunday_full' || value === 'sunday_short' || value === 'opening_closing_only' || value === 'custom';
}

export function normalizeEventTemplatePolicies(value: unknown): EventTemplatePolicies {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_EVENT_TEMPLATE_POLICIES;
  const incoming = value as Record<string, Partial<EventTemplatePolicy>>;
  const templates: EventTemplatePolicies = Object.fromEntries(Object.entries(DEFAULT_EVENT_TEMPLATE_POLICIES).map(([eventType, defaults]) => {
    const candidate = incoming[eventType];
    const due = typeof candidate?.setlist_due_days_before === 'number'
      && Number.isFinite(candidate.setlist_due_days_before)
      && candidate.setlist_due_days_before >= 0
      && candidate.setlist_due_days_before <= 90
      ? Math.round(candidate.setlist_due_days_before)
      : candidate?.setlist_due_days_before === null ? null : defaults.setlist_due_days_before;
    return [eventType, {
      start_time: isTime(candidate?.start_time) ? candidate.start_time : defaults.start_time,
      end_time: isTime(candidate?.end_time) ? candidate.end_time : defaults.end_time,
      setlist_due_days_before: due,
      service_format: isServiceFormat(candidate?.service_format) ? candidate.service_format : defaults.service_format,
    }];
  }));
  Object.entries(incoming).forEach(([eventType, candidate]) => {
    const name = eventType.trim();
    if (templates[name] || !name || name.length > 60) return;
    templates[name] = {
      start_time: isTime(candidate?.start_time) ? candidate.start_time : '',
      end_time: isTime(candidate?.end_time) ? candidate.end_time : '',
      setlist_due_days_before: typeof candidate?.setlist_due_days_before === 'number' && candidate.setlist_due_days_before >= 0 && candidate.setlist_due_days_before <= 90 ? Math.round(candidate.setlist_due_days_before) : null,
      service_format: isServiceFormat(candidate?.service_format) ? candidate.service_format : 'custom',
    };
  });
  return templates;
}

export function eventTemplateFor(eventType: string, policies?: EventTemplatePolicies | null): EventTemplatePolicy {
  const templates = normalizeEventTemplatePolicies(policies);
  return templates[eventType] || { start_time: '', end_time: '', setlist_due_days_before: null, service_format: 'custom' };
}

export function calculatePolicyProposalDueDate(eventDate: string, eventType: string, policies?: EventTemplatePolicies | null): string | null {
  if (!eventDate) return null;
  const daysBefore = eventTemplateFor(eventType, policies).setlist_due_days_before;
  if (daysBefore === null) return null;
  return `${format(subDays(parseISO(eventDate), daysBefore), 'yyyy-MM-dd')}T15:59:00Z`;
}
