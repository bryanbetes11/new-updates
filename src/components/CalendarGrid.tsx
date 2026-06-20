import { useState, useCallback, useEffect } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isToday, addMonths, subMonths, parseISO, differenceInDays, startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Cake, CalendarOff, GripVertical } from 'lucide-react';
import type { Event } from '../types';

interface CalendarEntry {
  type: 'birthday' | 'leave';
  date: string;
  name: string;
  status?: string;
}

interface SetlistInfo {
  status: string;
  created_at: string;
  submitted_at: string | null;
}

interface CalendarGridProps {
  events: Event[];
  calendarEntries: CalendarEntry[];
  songLeaderMap: Record<string, string>;
  setlistStatusMap?: Record<string, string>;
  setlistInfoMap?: Record<string, SetlistInfo>;
  onEventClick: (eventId: string) => void;
  onCreateEvent?: (date?: string) => void;
  onEventDateChange?: (eventId: string, newDate: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_MONTH_STORAGE_KEY = 'eventsCalendarMonth';

function getInitialCalendarMonth() {
  const storedMonth = localStorage.getItem(CALENDAR_MONTH_STORAGE_KEY);
  if (storedMonth && /^\d{4}-\d{2}$/.test(storedMonth)) {
    const parsedMonth = parseISO(`${storedMonth}-01`);
    if (!Number.isNaN(parsedMonth.getTime())) return parsedMonth;
  }
  return new Date();
}

export function CalendarGrid({ events, calendarEntries, songLeaderMap, setlistStatusMap, setlistInfoMap, onEventClick, onCreateEvent, onEventDateChange }: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(getInitialCalendarMonth);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const calendarToday = startOfDay(new Date());

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.event_date === dateStr);
  };

  const getEntriesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return calendarEntries.filter(e => e.date === dateStr);
  };

  useEffect(() => {
    localStorage.setItem(CALENDAR_MONTH_STORAGE_KEY, format(currentMonth, 'yyyy-MM'));
  }, [currentMonth]);

  const handleDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const eventId = e.dataTransfer.getData('text/plain');
    if (eventId && onEventDateChange) {
      const ev = events.find(ev => ev.id === eventId);
      if (ev && ev.event_date !== dateStr) {
        onEventDateChange(eventId, dateStr);
      }
    }
  }, [events, onEventDateChange]);

  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-white/[0.08] bg-[#121212] shadow-[0_24px_72px_-60px_rgba(0,0,0,0.95)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="rounded-full p-2 text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#22c55e]">Calendar view</p>
          <h2 className="mt-1 text-[20px] font-black leading-none text-white" style={{ letterSpacing: '-0.025em' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          {onEventDateChange && (
            <p className="mt-1 text-[11px] font-semibold text-white/40">Drag an event to reschedule it</p>
          )}
        </div>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="rounded-full p-2 text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map(day => (
          <div key={day} className="border-b border-white/[0.08] px-2 py-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/36">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const dayEntries = getEntriesForDay(day);
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const isDragOver = dragOverDate === dateStr;

          return (
            <div
              key={idx}
              className={`min-h-[128px] border-b border-r border-white/[0.06] p-2 transition-colors ${
                !inMonth ? 'bg-black/20' : 'bg-[#161616]'
              } ${idx % 7 === 0 ? 'border-l-0' : ''} ${
                onCreateEvent && inMonth ? 'cursor-pointer hover:bg-[#1f1f1f]' : ''
              } ${isDragOver ? 'bg-[#12331f] ring-2 ring-inset ring-[#22c55e]' : ''}`}
              onClick={() => {
                if (onCreateEvent && inMonth) onCreateEvent(dateStr);
              }}
              onDragOver={onEventDateChange ? (e) => handleDragOver(e, dateStr) : undefined}
              onDragLeave={onEventDateChange ? handleDragLeave : undefined}
              onDrop={onEventDateChange ? (e) => handleDrop(e, dateStr) : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                  today
                    ? 'bg-[#22c55e] text-black'
                    : inMonth
                      ? 'text-white'
                      : 'text-white/22'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>

              <div className="space-y-0.5">
                {dayEvents.map(event => {
                  const songLeader = songLeaderMap[event.id];
                  const setlistInfo = setlistInfoMap?.[event.id] || (setlistStatusMap?.[event.id] ? { status: setlistStatusMap[event.id], created_at: '', submitted_at: null } : undefined);
                  const hasApprovedSetlist = setlistInfo?.status === 'approved';
                  const isPastEvent = parseISO(event.event_date) < calendarToday;

                  const now = new Date();
                  const proposalDueDate = event.proposal_due_date ? parseISO(event.proposal_due_date) : null;
                  const daysUntilDue = proposalDueDate ? differenceInDays(proposalDueDate, now) : null;
                  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

                  const setlistSubmittedAt = setlistInfo?.submitted_at ? parseISO(setlistInfo.submitted_at) : (setlistInfo?.created_at ? parseISO(setlistInfo.created_at) : null);
                  const wasSubmittedLate = hasApprovedSetlist && proposalDueDate && setlistSubmittedAt && setlistSubmittedAt > proposalDueDate;

                  const showDueIndicator = (!hasApprovedSetlist && (isDueSoon || isOverdue)) || wasSubmittedLate;

                  const canDrag = !!onEventDateChange;
                  return (
                    <button
                      key={event.id}
                      draggable={canDrag}
                      onDragStart={canDrag ? (e) => handleDragStart(e, event.id) : undefined}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event.id); }}
                      className={`group w-full rounded-md px-1.5 py-1 text-left text-[11px] font-bold transition-colors ${
                        isPastEvent
                          ? 'bg-white/[0.035] text-white/30 hover:bg-white/[0.055] hover:text-white/42'
                          : 'bg-white/[0.08] text-white/82 hover:bg-white/[0.13]'
                      } ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      title={isPastEvent ? `${songLeader || event.title} (past event)` : songLeader || event.title}
                    >
                      {canDrag && <GripVertical className={`inline h-3 w-3 mr-0.5 opacity-0 group-hover:opacity-50 -ml-0.5 align-text-bottom ${isPastEvent ? 'text-white/30' : ''}`} />}
                      {songLeader || event.title}
                      {(hasApprovedSetlist || showDueIndicator) && (
                        <span
                          className={`inline-block ml-1 h-1.5 w-1.5 rounded-full ${
                            isPastEvent ? 'bg-white/24' :
                            hasApprovedSetlist && !wasSubmittedLate ? 'bg-green-500' :
                            wasSubmittedLate ? 'bg-green-500' :
                            isOverdue ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          title={
                            hasApprovedSetlist && !wasSubmittedLate ? 'Setlist approved' :
                            wasSubmittedLate ? 'Setlist approved (submitted late)' :
                            isOverdue ? 'Proposal overdue' : 'Proposal due soon'
                          }
                        />
                      )}
                    </button>
                  );
                })}
                {dayEntries.slice(0, 2).map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-0.5 truncate rounded-md px-1 py-0.5 text-[10px] font-semibold ${
                      entry.type === 'birthday'
                        ? 'bg-pink-500/16 text-pink-200'
                        : 'bg-orange-500/16 text-orange-200'
                    }`}
                  >
                    {entry.type === 'birthday' ? <Cake className="h-2.5 w-2.5 shrink-0" /> : <CalendarOff className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{entry.name.split(' ')[0]}</span>
                  </div>
                ))}
                {dayEntries.length > 2 && (
                  <span className="px-1 text-[10px] font-semibold text-white/36">+{dayEntries.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
