import { useState } from 'react';
import {
  ClipboardCheck, Clock, AlertTriangle, CheckCircle2, XCircle,
  Bell, ChevronLeft, ChevronRight, Calendar, TrendingUp, ShieldAlert,
  UserCheck, BookOpen,
} from 'lucide-react';
import { Modal } from './Modal';

interface AttendanceGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 'overview',
    icon: BookOpen,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40',
    accentColor: 'sky',
    title: 'How Attendance Works',
    subtitle: 'A quick guide to staying on track',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Attendance is tracked for every event you are assigned to. When an event happens, you are expected to submit your attendance on the same day.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Present', desc: 'You attended and checked in', color: 'bg-green-50 dark:bg-green-950/40 ring-green-200 dark:ring-green-800', text: 'text-green-700 dark:text-green-400', icon: CheckCircle2 },
            { label: 'Late', desc: 'You attended but checked in after the grace period', color: 'bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
            { label: 'Excused', desc: 'Your absence was officially excused by leadership', color: 'bg-sky-50 dark:bg-sky-950/40 ring-sky-200 dark:ring-sky-800', text: 'text-sky-700 dark:text-sky-400', icon: UserCheck },
            { label: 'Absent', desc: 'No attendance was submitted and no excuse was given', color: 'bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-800', text: 'text-red-700 dark:text-red-400', icon: XCircle },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`p-3 rounded-xl ring-1 ${s.color} flex flex-col gap-1.5`}>
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${s.text}`} />
                  <span className={`text-xs font-bold ${s.text}`}>{s.label}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    id: 'timeline',
    icon: Calendar,
    iconColor: 'text-brand-600 dark:text-brand-400',
    iconBg: 'bg-brand-50 dark:bg-brand-950/40',
    accentColor: 'brand',
    title: 'Submission Timeline',
    subtitle: 'What happens on event day and after',
    content: (
      <div className="space-y-2.5">
        {[
          {
            step: '1',
            time: 'Event Day',
            title: 'Submit your attendance',
            desc: 'Mark yourself present or late from the Events page. You have until midnight of the event day.',
            color: 'bg-brand-600',
            border: 'border-brand-200 dark:border-brand-800',
            bg: 'bg-brand-50/60 dark:bg-brand-950/30',
          },
          {
            step: '2',
            time: 'Day After (morning)',
            title: 'Reminder notification sent',
            desc: 'If you have not submitted attendance yet, you will receive a push notification reminding you to do so.',
            color: 'bg-amber-500',
            border: 'border-amber-200 dark:border-amber-800',
            bg: 'bg-amber-50/60 dark:bg-amber-950/30',
          },
          {
            step: '3',
            time: '2 Days After',
            title: 'Auto-marked absent',
            desc: 'If no attendance is submitted, the system automatically records you as Absent. This cannot be undone without a leader.',
            color: 'bg-red-500',
            border: 'border-red-200 dark:border-red-800',
            bg: 'bg-red-50/60 dark:bg-red-950/30',
          },
        ].map(item => (
          <div key={item.step} className={`flex gap-3 p-3 rounded-xl border ${item.border} ${item.bg}`}>
            <div className={`h-6 w-6 rounded-full ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
              <span className="text-[10px] font-black text-white">{item.step}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold text-gray-900 dark:text-white">{item.title}</p>
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{item.time}</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'late',
    icon: Clock,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    accentColor: 'amber',
    title: 'Late vs. Present',
    subtitle: 'When does "on time" become "late"?',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Attendance opens <span className="font-bold text-gray-900 dark:text-white">30 minutes before</span> each event. Checking in during this window marks you as <span className="font-bold text-green-600 dark:text-green-400">Present</span>.
        </p>
        <div className="rounded-xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.07]">
          <div className="bg-gray-50 dark:bg-white/[0.03] px-3 py-2 border-b border-black/[0.04] dark:border-white/[0.05]">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em]">Check-in Timeline</p>
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {[
              { when: '30 min before event', status: 'Present', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
              { when: 'Event start time', status: 'Present', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
              { when: 'After event starts', status: 'Late', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
              { when: 'Midnight — no submission', status: 'Auto-Absent', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
            ].map(row => (
              <div key={row.when} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-gray-600 dark:text-gray-400">{row.when}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${row.bg} ${row.color}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
          If you know you will be late, still check in — a Late record is better than an Absent.
        </p>
      </div>
    ),
  },
  {
    id: 'offenses',
    icon: AlertTriangle,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    accentColor: 'rose',
    title: 'Offense Levels',
    subtitle: 'How absences and lates accumulate per quarter',
    content: (
      <div className="space-y-3">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Offenses are counted <span className="font-bold text-gray-700 dark:text-gray-300">per quarter</span> (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec). Either threshold — absences OR lates — can trigger an offense level.
        </p>
        <div className="space-y-2">
          {[
            { level: 0, label: 'Good Standing', absent: '0', late: '0–2', color: 'bg-green-50 dark:bg-green-950/30 ring-green-200 dark:ring-green-800', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', action: 'No action required' },
            { level: 1, label: '1st Offense', absent: '1', late: '3–5', color: 'bg-amber-50 dark:bg-amber-950/30 ring-amber-200 dark:ring-amber-800', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', action: 'Verbal warning from coordinator' },
            { level: 2, label: '2nd Offense', absent: '2', late: '6–8', color: 'bg-orange-50 dark:bg-orange-950/30 ring-orange-200 dark:ring-orange-800', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', action: 'Verbal warning from Production Director' },
            { level: 3, label: '3rd Offense', absent: '3', late: '9–11', color: 'bg-red-50 dark:bg-red-950/30 ring-red-200 dark:ring-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', action: 'Closed-door counselling with Pastors' },
            { level: 4, label: '4th Offense', absent: '4+', late: '12+', color: 'bg-rose-100 dark:bg-rose-950/40 ring-rose-300 dark:ring-rose-700', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-600', action: 'Suspension' },
          ].map(o => (
            <div key={o.level} className={`flex items-start gap-3 p-2.5 rounded-xl ring-1 ${o.color}`}>
              <div className={`h-2 w-2 rounded-full ${o.dot} mt-1.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold ${o.text}`}>{o.label}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{o.absent} absent · {o.late} late</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{o.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'rate',
    icon: TrendingUp,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    accentColor: 'emerald',
    title: 'Attendance Rate',
    subtitle: 'How your percentage is calculated',
    content: (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] ring-1 ring-black/[0.05] dark:ring-white/[0.07]">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.06em] mb-2">Formula</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white text-center py-2">
            (Present + Late) ÷ Events Assigned × 100
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            Late counts toward your rate — being late still helps your percentage.
          </p>
        </div>
        <div className="space-y-2">
          {[
            { range: '80% and above', label: 'Good', color: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', width: 'w-full', bg: 'bg-green-50 dark:bg-green-950/30 ring-green-200 dark:ring-green-800' },
            { range: '60% – 79%', label: 'Needs Improvement', color: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', width: 'w-4/5', bg: 'bg-amber-50 dark:bg-amber-950/30 ring-amber-200 dark:ring-amber-800' },
            { range: 'Below 60%', label: 'Critical', color: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', width: 'w-3/5', bg: 'bg-red-50 dark:bg-red-950/30 ring-red-200 dark:ring-red-800' },
          ].map(r => (
            <div key={r.range} className={`p-3 rounded-xl ring-1 ${r.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-600 dark:text-gray-400">{r.range}</span>
                <span className={`text-[11px] font-bold ${r.color}`}>{r.label}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                <div className={`h-full rounded-full ${r.bar} ${r.width}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'where',
    icon: ClipboardCheck,
    iconColor: 'text-brand-600 dark:text-brand-400',
    iconBg: 'bg-brand-50 dark:bg-brand-950/40',
    accentColor: 'brand',
    title: 'Where to See Your Attendance',
    subtitle: 'Find your records in the app',
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          {[
            {
              icon: Calendar,
              title: 'Events Page',
              desc: 'Tap any event you are assigned to and use the "Mark Attendance" button to submit your attendance while the window is open.',
              color: 'text-brand-600 dark:text-brand-400',
              bg: 'bg-brand-50 dark:bg-brand-950/40',
            },
            {
              icon: Bell,
              title: 'Notifications',
              desc: 'You will receive a reminder notification if you have not submitted attendance by the morning after the event.',
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-950/40',
            },
            {
              icon: ShieldAlert,
              title: 'Discipline Page (Leaders)',
              desc: 'Leaders can view the full attendance monitoring dashboard, quarterly summaries, offense levels, and discipline records for all members.',
              color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-950/40',
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-3 p-3 rounded-xl ring-1 ring-black/[0.06] dark:ring-white/[0.07] bg-white dark:bg-white/[0.03]">
                <div className={`h-9 w-9 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center px-2">
          If you believe your attendance was marked incorrectly, reach out to a leader to have it reviewed.
        </p>
      </div>
    ),
  },
];

export function AttendanceGuideModal({ open, onClose }: AttendanceGuideModalProps) {
  const [index, setIndex] = useState(0);

  const slide = slides[index];
  const Icon = slide.icon;
  const isFirst = index === 0;
  const isLast = index === slides.length - 1;

  const handleClose = () => {
    setIndex(0);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="" size="lg">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`h-11 w-11 rounded-2xl ${slide.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${slide.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {slide.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{slide.subtitle}</p>
          </div>
          <div className="text-xs font-bold text-gray-300 dark:text-gray-600 shrink-0 pt-1">
            {index + 1}/{slides.length}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 justify-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-200 ${
                i === index
                  ? 'w-5 h-1.5 bg-brand-600 dark:bg-brand-400'
                  : 'w-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div key={index} className="animate-fade-in">
          {slide.content}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => setIndex(i => i - 1)}
            disabled={isFirst}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isFirst
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.07] hover:bg-gray-200 dark:hover:bg-white/[0.11] active:scale-[0.97]'
            }`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <button
            onClick={isLast ? handleClose : () => setIndex(i => i + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-all active:scale-[0.97] shadow-sm"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </Modal>
  );
}
