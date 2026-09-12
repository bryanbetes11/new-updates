import { Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTime12Hour } from '../lib/timeFormat';
import type { Event } from '../types';

export function EventRescheduleNotice({ event }: { event: Event }) {
  if (!event.rescheduled_from_date) return null;
  const schedule = (date: string, start?: string | null, end?: string | null) => (
    <>
      <p className="font-semibold">{format(parseISO(date), 'EEE, MMM d, yyyy')}</p>
      {start && <p className="mt-1 text-sm">{formatTime12Hour(start)}{end ? ` – ${formatTime12Hour(end)}` : ''}</p>}
    </>
  );
  return (
    <section aria-label="Event rescheduled" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Calendar className="h-4 w-4" /> Event rescheduled</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-black/10 p-3 text-white/60">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-white/40">Previous schedule</p>
          {schedule(event.rescheduled_from_date, event.rescheduled_from_start_time, event.rescheduled_from_end_time)}
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-white">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-200">New schedule</p>
          {schedule(event.event_date, event.start_time, event.end_time)}
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-amber-100/75">Assigned members have been asked to confirm their availability for the new schedule.</p>
    </section>
  );
}
