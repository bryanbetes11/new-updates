import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function DatePicker({ value, onChange, placeholder = 'Select date', required }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const [yearRangeStart, setYearRangeStart] = useState(Math.floor((parsed?.getFullYear() ?? today.getFullYear()) / 12) * 12);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = 380;
    const top = spaceBelow < panelHeight ? rect.top - panelHeight - 6 : rect.bottom + 6;
    setPos({ top, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
        setPickerMode('days');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDate = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(dateStr);
    setOpen(false);
    setPickerMode('days');
  };

  const selectToday = () => {
    const d = new Date();
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(false);
    setPickerMode('days');
  };

  const selectMonth = (month: number) => {
    setViewMonth(month);
    setPickerMode('days');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setYearRangeStart(Math.floor(year / 12) * 12);
    setPickerMode('months');
  };

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  const isSelected = (day: number) =>
    parsed && viewYear === parsed.getFullYear() && viewMonth === parsed.getMonth() && day === parsed.getDate();

  const displayValue = parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open && parsed) {
            setViewYear(parsed.getFullYear());
            setViewMonth(parsed.getMonth());
            setYearRangeStart(Math.floor(parsed.getFullYear() / 12) * 12);
          }
          setOpen(!open);
          setPickerMode('days');
        }}
        className="input-field flex items-center gap-2 text-left"
      >
        <span className={`flex-1 truncate ${!displayValue ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          {displayValue || placeholder}
        </span>
        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {required && !value && (
        <input type="text" required value="" className="sr-only" tabIndex={-1} onChange={() => {}} />
      )}

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed w-72 rounded-xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 p-4 animate-scale-in"
          style={{ top: pos.top, left: pos.left, zIndex: 99999 }}
        >
          {pickerMode === 'days' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYearRangeStart(Math.floor(viewYear / 12) * 12);
                    setPickerMode('months');
                  }}
                  className="text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
                >
                  {MONTHS[viewMonth]} {viewYear}
                </button>
                <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const sel = isSelected(day);
                  const tod = isToday(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDate(day)}
                      className={`h-8 w-full rounded-lg text-sm transition-all duration-150 ${
                        sel
                          ? 'bg-brand-600 text-white font-semibold'
                          : tod
                            ? 'ring-1 ring-brand-500 text-brand-600 dark:text-brand-400 font-medium hover:bg-brand-50 dark:hover:bg-brand-900/30'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {pickerMode === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewYear(viewYear - 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode('years')}
                  className="text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
                >
                  {viewYear}
                </button>
                <button type="button" onClick={() => setViewYear(viewYear + 1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                      i === viewMonth && viewYear === (parsed?.getFullYear() ?? -1)
                        ? 'bg-brand-600 text-white'
                        : i === today.getMonth() && viewYear === today.getFullYear()
                          ? 'ring-1 ring-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {pickerMode === 'years' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setYearRangeStart(yearRangeStart - 12)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {yearRangeStart} - {yearRangeStart + 11}
                </span>
                <button type="button" onClick={() => setYearRangeStart(yearRangeStart + 12)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const year = yearRangeStart + i;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => selectYear(year)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                        year === viewYear
                          ? 'bg-brand-600 text-white'
                          : year === today.getFullYear()
                            ? 'ring-1 ring-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setPickerMode('days'); }}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
