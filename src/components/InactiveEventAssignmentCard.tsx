import { AlertCircle, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Event } from '../types';
import { formatTime12Hour } from '../lib/timeFormat';
import { EventDateChip } from './EventDateChip';
import { EventTypeLabel } from './EventTypeLabel';

export function InactiveEventAssignmentCard({ event, members, declinedCount = 0, onClick, variant = 'list' }: {
  event: Event;
  members: { id: string; name: string }[];
  declinedCount?: number;
  onClick: (id: string) => void;
  variant?: 'list' | 'featured' | 'directory';
}) {
  const directory = variant === 'directory';
  const names = members.map(member => member.name).join(', ');
  return <div className="relative h-full">
    <button type="button" onClick={() => onClick(event.id)}
      aria-label={`Update inactive assignment for ${event.title} on ${event.event_date}: ${names}`}
      className={`inactive-event-assignment touch-action-pan-y group w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${variant === 'list' ? 'relative flex min-h-[5.5rem] items-center gap-3 rounded-md bg-amber-50/75 px-0 py-3 text-gray-900 hover:bg-amber-100/75 focus-visible:ring-inset dark:bg-amber-500/[0.055] dark:text-white dark:hover:bg-amber-500/[0.085]' : directory ? 'flex items-center gap-3 px-0 py-3 text-amber-950 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/15' : 'flex h-full flex-col items-stretch gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 hover:bg-amber-100 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15'}`}>
      {directory ? <>
        <div className="desktop-event-directory-identity flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-200/60 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><AlertCircle className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-bold">{event.title}</p><span className="mt-0.5 block text-xs text-amber-800/75 dark:text-amber-200/60">{event.event_type}</span></div>
        </div>
        <div className="desktop-event-directory-schedule min-w-0 text-xs">
          <span className="block font-semibold">{format(parseISO(event.event_date), 'EEEE')}</span>
          <span className="mt-1 block text-amber-800/75 dark:text-amber-200/60">{formatTime12Hour(event.start_time || '')}{event.end_time && ` – ${formatTime12Hour(event.end_time)}`}</span>
        </div>
        <div className="desktop-event-directory-availability min-w-0 text-xs"><span className="block font-bold">{members.length === 1 ? 'Inactive member' : `${members.length} inactive members`}</span><span className="mt-1 block break-words text-amber-800/75 dark:text-amber-200/60">{names}</span>{declinedCount > 0 && <span className="mt-1 block font-semibold text-red-700 dark:text-red-300">{declinedCount} Declined</span>}</div>
        <div className="desktop-event-directory-status min-w-0 text-xs"><span className="mb-1 block font-semibold">Needs replacement</span><span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-2 py-1.5 font-bold">Update assignment<ArrowRight className="h-3 w-3 shrink-0" /></span></div>
        <time dateTime={event.event_date} className="desktop-event-directory-date shrink-0 text-xs font-semibold">{format(parseISO(event.event_date), 'MMM dd, yyyy')}</time>
      </> : variant === 'list' ? <>
        <span aria-hidden="true" className="absolute inset-y-3 -left-2 w-0.5 rounded-full bg-amber-500/80 dark:bg-amber-400/65" />
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[0.35rem] border border-amber-300/70 bg-amber-100 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-300"><AlertCircle className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="break-words text-[14px] font-black leading-snug" style={{ letterSpacing: '-0.015em' }}>{names}</p>
            <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Inactive</span>
          </div>
          <div className="mt-1"><EventTypeLabel type={event.event_type} /></div>
          {declinedCount > 0 && <span className="mt-1 block text-[10px] font-bold text-red-700 dark:text-red-300">{declinedCount} declined</span>}
          <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2 py-0.5 text-[10px] font-bold leading-4 text-amber-800 dark:text-amber-200">Update assignment<ArrowRight className="h-3 w-3 shrink-0" /></span>
        </div>
        <EventDateChip date={event.event_date} compact tone="warning" />
      </> : <>
      <div className="flex w-full min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-200/60 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><AlertCircle className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">Needs replacement</p>
          <p className="mt-1 break-words text-sm font-semibold leading-snug">{names}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800/75 dark:text-amber-200/60">{members.length === 1 ? 'Inactive member' : `${members.length} inactive members`} · {event.event_type}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-amber-500/15 pt-2.5">
      <time dateTime={event.event_date} className="shrink-0 text-xs font-semibold">{format(parseISO(event.event_date), 'MMM dd, yyyy')}</time>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 px-2.5 py-2 text-xs font-bold">Update assignment<ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
      </>}
    </button>
  </div>;
}
