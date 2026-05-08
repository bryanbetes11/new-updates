import { useState, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isToday, addMonths, subMonths, parseISO, differenceInDays
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
  onCreateEvent?: () => void;
  onEventDateChange?: (eventId: string, newDate: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarGrid({ events, calendarEntries, songLeaderMap, setlistStatusMap, setlistInfoMap, onEventClick, onCreateEvent, onEventDateChange }: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.event_date === dateStr);
  };

  const getEntriesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return calendarEntries.filter(e => e.date === dateStr);
  };

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
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map(day => (
          <div key={day} className="px-2 py-2.5 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/[0.06]">
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
              className={`min-h-[100px] border-b border-r border-gray-100 dark:border-white/[0.06] p-1.5 transition-colors ${
                !inMonth ? 'bg-gray-50/50 dark:bg-[#18171a]' : 'bg-white dark:bg-[#1c1b1e]'
              } ${idx % 7 === 0 ? 'border-l-0' : ''} ${
                onCreateEvent && inMonth ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222124]' : ''
              } ${isDragOver ? 'ring-2 ring-inset ring-brand-400 bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
              onClick={() => {
                if (onCreateEvent && inMonth && dayEvents.length === 0) onCreateEvent();
              }}
              onDragOver={onEventDateChange ? (e) => handleDragOver(e, dateStr) : undefined}
              onDragLeave={onEventDateChange ? handleDragLeave : undefined}
              onDrop={onEventDateChange ? (e) => handleDrop(e, dateStr) : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                  today
                    ? 'bg-brand-600 text-white'
                    : inMonth
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>

              <div className="space-y-0.5">
                {dayEvents.map(event => {
                  const songLeader = songLeaderMap[event.id];
                  const setlistInfo = setlistInfoMap?.[event.id] || (setlistStatusMap?.[event.id] ? { status: setlistStatusMap[event.id], created_at: '', submitted_at: null } : undefined);
                  const hasApprovedSetlist = setlistInfo?.status === 'approved';

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
                      className={`group w-full text-left px-1.5 py-0.5 rounded-md text-[11px] font-medium truncate transition-colors bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                    >
                      {canDrag && <GripVertical className="inline h-3 w-3 mr-0.5 opacity-0 group-hover:opacity-50 -ml-0.5 align-text-bottom" />}
                      {songLeader || event.title}
                      {(hasApprovedSetlist || showDueIndicator) && (
                        <span
                          className={`inline-block ml-1 h-1.5 w-1.5 rounded-full ${
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
                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[10px] truncate ${
                      entry.type === 'birthday'
                        ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
                        : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {entry.type === 'birthday' ? <Cake className="h-2.5 w-2.5 shrink-0" /> : <CalendarOff className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{entry.name.split(' ')[0]}</span>
                  </div>
                ))}
                {dayEntries.length > 2 && (
                  <span className="text-[10px] text-gray-400 px-1">+{dayEntries.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
