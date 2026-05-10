import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bell, UserX, Circle, ArrowLeft, ArrowRight, Timer, PanelBottom, Music2 } from 'lucide-react';
import { Modal } from './Modal';
import { APP_UPDATE_PUBLISHED_AT, APP_UPDATE_VERSION } from '../lib/appUpdate';

interface ReleaseNotesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RELEASE_NOTES_VERSION = APP_UPDATE_VERSION;
export const RELEASE_NOTES_PUBLISHED_AT = APP_UPDATE_PUBLISHED_AT;

const features = [
  {
    icon: Music2,
    title: 'Welcome to ServeSync',
    description: 'MCJC Worship is now ServeSync. Same ministry workspace, cleaner name, and more tools for serving together.',
    highlight: (
      <div
        className="rounded-2xl p-5 overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.06))',
          border: '1px solid rgba(16,185,129,0.24)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-[22%] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)',
              boxShadow: '0 8px 18px rgba(0,0,0,0.24)',
            }}
          >
            <Music2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Formerly MCJC Worship</p>
            <p className="mt-1 text-[20px] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.04em' }}>ServeSync</p>
          </div>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-gray-600 dark:text-white/60">
          Welcome back. Your events, assignments, attendance, setlists, and updates are still here, now under the ServeSync name.
        </p>
      </div>
    ),
  },
  {
    icon: PanelBottom,
    title: 'Mobile Navigation Styles',
    description: 'Choose the mobile nav style that feels right for your device.',
    highlight: (
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(16,185,129,0.03))',
          border: '1px solid rgba(14,165,233,0.22)',
        }}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-300/80 dark:border-sky-400/30 bg-sky-50 dark:bg-sky-500/[0.12] px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Find it on mobile</p>
            <p className="mt-1 text-[12px] font-bold text-gray-900 dark:text-white">
              More <span className="text-sky-600 dark:text-sky-300">→</span> Mobile Navigation <span className="text-sky-600 dark:text-sky-300">→</span> Floating or Docked
            </p>
          </div>

          <div className="rounded-2xl bg-white/75 dark:bg-white/[0.06] border border-sky-200/70 dark:border-sky-400/20 p-3">
            <div className="mx-auto flex h-10 max-w-[220px] items-center justify-around rounded-full bg-white/90 dark:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.10] shadow-sm">
              {[0, 1, 2, 3, 4].map((item) => (
                <span
                  key={item}
                  className={`h-3 w-3 rounded-full ${item === 0 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/35'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Floating</p>
          </div>

          <div className="rounded-2xl bg-white/75 dark:bg-white/[0.06] border border-emerald-200/70 dark:border-emerald-400/20 p-3">
            <div className="mx-auto flex h-10 max-w-[240px] items-center justify-around rounded-xl bg-gray-100 dark:bg-white/[0.10] border-t border-black/[0.06] dark:border-white/[0.10]">
              {[0, 1, 2, 3, 4].map((item) => (
                <span
                  key={item}
                  className={`h-3 w-3 rounded-full ${item === 0 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/35'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Docked</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Timer,
    title: 'Live Attendance Countdown',
    description: 'A beautiful animated countdown shows exactly when attendance opens. Watch hours, minutes, and seconds tick in real time.',
    highlight: (
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))',
          border: '1px solid rgba(16,185,129,0.22)',
        }}
      >
        <div className="flex items-center justify-center gap-3">
          {[
            { v: '02', label: 'Hours' },
            { v: '45', label: 'Minutes' },
            { v: '30', label: 'Seconds' },
          ].map((cell, i, arr) => (
            <div key={cell.label} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(145deg, #16a34a, #15803d)',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                  }}
                >
                  <span className="text-[16px] font-black text-white tabular-nums" style={{ letterSpacing: '-0.04em' }}>{cell.v}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/50 mt-2">{cell.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex flex-col gap-1 -mt-5">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-center text-gray-500 dark:text-white/45 mt-4 font-mono">
          Attendance opens 30 minutes before each event
        </p>
      </div>
    ),
  },
  {
    icon: Bell,
    title: 'Smart Due Date Reminders',
    description: 'Timely notifications for event proposals — on the due date, three days before, and as the deadline approaches.',
    highlight: (
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))',
          border: '1px solid rgba(245,158,11,0.22)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-500/[0.12] border border-amber-200 dark:border-amber-500/25">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>Proposal Deadline Approaching</p>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mt-0.5">Sunday Service proposal due in 3 days</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-white/40 mt-3 font-mono pl-12">
          On-time · 3 days before · As deadline approaches
        </p>
      </div>
    ),
  },
  {
    icon: UserX,
    title: 'Unavailable Members Tracking',
    description: 'See who is unavailable in both list and calendar views, plus a dashboard tile showing all unavailable members at a glance.',
    highlight: (
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.02))',
          border: '1px solid rgba(244,63,94,0.22)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">Unavailable Members</span>
        </div>
        <div className="flex items-center gap-3 pl-1">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/[0.08] border border-gray-300 dark:border-white/10" />
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.01em' }}>John Doe</p>
            <p className="text-[11px] text-gray-500 dark:text-white/50 font-mono">March 10</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Circle,
    title: 'Status Indicator Colors',
    description: 'Color-coded dots help you understand assignment and setlist status at a glance.',
    highlight: (
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: 'rgba(0,0,0,0.02)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {[
          { color: '#10b981', label: 'Approved', desc: 'Setlist is approved and ready' },
          { color: '#f59e0b', label: 'Almost due', desc: 'Setlist is approaching the deadline' },
          { color: '#f43f5e', label: 'Overdue', desc: 'Setlist is past its deadline' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: s.color, boxShadow: `0 0 8px ${s.color}80` }}
            />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.01em' }}>{s.label}</p>
              <p className="text-[11px] text-gray-500 dark:text-white/45 leading-tight">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

export function ReleaseNotesModal({ open, onClose }: ReleaseNotesModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const handleNext = () => {
    if (currentIndex < features.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentFeature = features[currentIndex];
  const isLast = currentIndex === features.length - 1;

  return (
    <Modal open={open} onClose={onClose} title="" size="lg" hideHeader>
      <div className="relative">
        {/* Header — editorial like the dashboard hero */}
        <div className="flex items-center gap-3 mb-7">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.6)' }}
            />
            <div
              className="relative h-9 w-9 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #16a34a, #15803d)',
                boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
              }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400/80 mb-0.5">
              What's new
            </p>
            <h2 className="text-[20px] sm:text-[22px] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Latest improvements.
            </h2>
          </div>
        </div>

        {/* Feature panel */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: direction * 24, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -direction * 24, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl p-5 sm:p-6 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-2">
                    {String(currentIndex + 1).padStart(2, '0')} · Feature
                  </p>
                  <h3 className="text-[18px] sm:text-[20px] font-bold text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
                    {currentFeature.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 dark:text-white/55 mt-2 leading-relaxed">
                    {currentFeature.description}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-500/[0.1] border border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                  <currentFeature.icon className="h-[18px] w-[18px]" />
                </div>
              </div>

              <div className="mt-2">{currentFeature.highlight}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer — dot pagination + nav */}
        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="group inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12px] font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-white/70 border border-gray-200 dark:border-white/[0.07] hover:bg-gray-200 dark:hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                aria-label={`Go to slide ${i + 1}`}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === currentIndex ? 18 : 6,
                  height: 6,
                  background: i === currentIndex ? '#16a34a' : 'rgba(0,0,0,0.12)',
                  boxShadow: i === currentIndex ? '0 0 8px rgba(22,163,74,0.4)' : 'none',
                }}
              />
            ))}
          </div>

          <button
            onClick={isLast ? onClose : handleNext}
            className="group inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white transition-all duration-200 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
            }}
          >
            {isLast ? 'Mark as read' : 'Next'}
            {!isLast && <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </div>
    </Modal>
  );
}
