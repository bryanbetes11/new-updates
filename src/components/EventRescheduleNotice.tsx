import { CalendarClock, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTime12Hour } from '../lib/timeFormat';
import type { Event } from '../types';

export function EventRescheduleNotice({ event }: { event: Event }) {
  if (!event.rescheduled_from_date) return null;
  const timeRange = (start?: string | null, end?: string | null) => start
    ? `${formatTime12Hour(start)}${end ? ` – ${formatTime12Hour(end)}` : ''}`
    : 'Time to be confirmed';
  return (
    <div className="pb-5 sm:pb-6">
    <section aria-label="Event rescheduled" className="relative overflow-hidden rounded-3xl border border-sky-200 bg-[#eef4f7] dark:border-sky-300/20 dark:bg-gradient-to-br dark:from-[#10232c] dark:via-[#0c171d] dark:to-[#0b1116]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-sky-200 dark:bg-gradient-to-r dark:from-transparent dark:via-sky-200/40 dark:to-transparent" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-300/15 dark:bg-sky-300/10 dark:text-sky-200"><CalendarClock className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Event Rescheduled</h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-sky-100/55">Please review the updated schedule.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white/75 p-3 dark:border-white/[0.06] dark:bg-white/[0.025] sm:p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-white/45 sm:text-[10px]">Previous Schedule</p>
            <time dateTime={event.rescheduled_from_date} className="mt-2 block">
              <span className="block text-sm font-semibold tracking-tight text-slate-600 line-through decoration-slate-400 dark:text-white/55 dark:decoration-white/25 sm:text-xl">{format(parseISO(event.rescheduled_from_date), 'EEE, MMM d')}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-white/40">{format(parseISO(event.rescheduled_from_date), 'yyyy')}</span>
            </time>
            <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-white/50 sm:text-sm">{timeRange(event.rescheduled_from_start_time, event.rescheduled_from_end_time)}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-200 bg-sky-100/80 p-3 dark:border-sky-300/25 dark:bg-sky-300/[0.08] sm:p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300 sm:text-[10px]">New Schedule</p>
            <time dateTime={event.event_date} className="mt-2 block">
              <span className="block text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">{format(parseISO(event.event_date), 'EEE, MMM d')}</span>
              <span className="mt-0.5 block text-[11px] text-sky-700 dark:text-sky-100/65">{format(parseISO(event.event_date), 'yyyy')}</span>
            </time>
            <p className="mt-2 text-[11px] font-medium leading-5 text-slate-700 dark:text-sky-100/90 sm:text-sm">{timeRange(event.start_time, event.end_time)}</p>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 border-t border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-200/10 dark:bg-sky-200/[0.035] sm:px-5">
        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300/65" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-sky-100/65">Assigned members have been asked to confirm their availability for the new schedule.</p>
      </div>
    </section>
    </div>
  );
}
