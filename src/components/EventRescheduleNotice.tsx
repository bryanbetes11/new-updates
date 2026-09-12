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
    <section aria-label="Event rescheduled" className="relative overflow-hidden rounded-3xl border border-sky-300/20 bg-gradient-to-br from-[#10232c] via-[#0c171d] to-[#0b1116]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/40 to-transparent" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-300/10 text-sky-200"><CalendarClock className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-sm font-bold text-white">Event rescheduled</h2>
            <p className="mt-0.5 text-xs text-sky-100/55">Please review the updated schedule.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 sm:p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/45 sm:text-[10px]">Previous schedule</p>
            <time dateTime={event.rescheduled_from_date} className="mt-2 block">
              <span className="block text-sm font-semibold tracking-tight text-white/55 line-through decoration-white/25 sm:text-xl">{format(parseISO(event.rescheduled_from_date), 'EEE, MMM d')}</span>
              <span className="mt-0.5 block text-[11px] text-white/40">{format(parseISO(event.rescheduled_from_date), 'yyyy')}</span>
            </time>
            <p className="mt-2 text-[11px] leading-5 text-white/50 sm:text-sm">{timeRange(event.rescheduled_from_start_time, event.rescheduled_from_end_time)}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-300/25 bg-sky-300/[0.08] p-3 sm:p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-sky-300 sm:text-[10px]">New schedule</p>
            <time dateTime={event.event_date} className="mt-2 block">
              <span className="block text-sm font-bold tracking-tight text-white sm:text-xl">{format(parseISO(event.event_date), 'EEE, MMM d')}</span>
              <span className="mt-0.5 block text-[11px] text-sky-100/65">{format(parseISO(event.event_date), 'yyyy')}</span>
            </time>
            <p className="mt-2 text-[11px] font-medium leading-5 text-sky-100/90 sm:text-sm">{timeRange(event.start_time, event.end_time)}</p>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 border-t border-sky-200/10 bg-sky-200/[0.035] px-4 py-3 sm:px-5">
        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/65" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-sky-100/65">Assigned members have been asked to confirm their availability for the new schedule.</p>
      </div>
    </section>
    </div>
  );
}
