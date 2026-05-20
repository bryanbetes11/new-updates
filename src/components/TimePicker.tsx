import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function to12(h24: number) {
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return { h, period };
}

function to24(h12: number, period: string) {
  if (period === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const FLOATING_LAYER_Z_INDEX = 2147483647;

export function TimePicker({ value, onChange, placeholder = 'Select time', required }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const parsed = value ? { h24: parseInt(value.split(':')[0]), m: parseInt(value.split(':')[1]) } : null;
  const display12 = parsed ? to12(parsed.h24) : null;

  const [selHour, setSelHour] = useState(display12?.h ?? 12);
  const [selMinute, setSelMinute] = useState(parsed?.m ?? 0);
  const [selPeriod, setSelPeriod] = useState<string>(display12?.period ?? 'AM');

  useEffect(() => {
    if (parsed) {
      const d = to12(parsed.h24);
      setSelHour(d.h);
      setSelMinute(parsed.m);
      setSelPeriod(d.period);
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = 320;
    const top = spaceBelow < panelHeight ? rect.top - panelHeight - 6 : rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - 240);
    setPos({ top, left });
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
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const commitValue = (h: number, m: number, p: string) => {
    const h24 = to24(h, p);
    onChange(`${pad(h24)}:${pad(m)}`);
  };

  const handleHourClick = (h: number) => {
    setSelHour(h);
    commitValue(h, selMinute, selPeriod);
  };

  const handleMinuteClick = (m: number) => {
    setSelMinute(m);
    commitValue(selHour, m, selPeriod);
  };

  const handlePeriodClick = (p: string) => {
    setSelPeriod(p);
    commitValue(selHour, selMinute, p);
  };

  const displayValue = parsed
    ? `${display12!.h}:${pad(parsed.m)} ${display12!.period}`
    : '';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="input-field flex items-center gap-2 text-left"
      >
        <span className={`flex-1 truncate ${!displayValue ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          {displayValue || placeholder}
        </span>
        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {required && !value && (
        <input type="text" required value="" className="sr-only" tabIndex={-1} onChange={() => {}} />
      )}

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed w-56 rounded-xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 p-3 animate-scale-in"
          style={{ top: pos.top, left: pos.left, zIndex: FLOATING_LAYER_Z_INDEX }}
        >
          <div className="flex items-center justify-center gap-1 mb-3">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
              <span className="px-2.5 py-1.5 rounded-md bg-brand-600 text-white text-sm font-semibold min-w-[36px] text-center">
                {pad(selHour)}
              </span>
              <span className="text-gray-400 font-bold">:</span>
              <span className="px-2.5 py-1.5 rounded-md bg-brand-600 text-white text-sm font-semibold min-w-[36px] text-center">
                {pad(selMinute)}
              </span>
              <span className="px-2.5 py-1.5 rounded-md bg-brand-600 text-white text-sm font-semibold">
                {selPeriod}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <div className="col-span-1">
              <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 text-center mb-1 uppercase tracking-wider">Hr</div>
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
                {HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourClick(h)}
                    className={`w-full py-1.5 rounded-lg text-sm text-center transition-colors ${
                      selHour === h
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-1">
              <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 text-center mb-1 uppercase tracking-wider">Min</div>
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteClick(m)}
                    className={`w-full py-1.5 rounded-lg text-sm text-center transition-colors ${
                      selMinute === m
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-1">
              <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 text-center mb-1 uppercase tracking-wider">&nbsp;</div>
              <div className="space-y-0.5">
                {['AM', 'PM'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodClick(p)}
                    className={`w-full py-1.5 rounded-lg text-sm text-center transition-colors ${
                      selPeriod === p
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
