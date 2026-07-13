import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Music, BookOpen, Shield, Target, Sparkles, Star, AlignLeft, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SetlistCheckReport } from '../../types';

interface SongInput {
  title: string;
  artist: string;
  slot: 'Opening' | 'Praise' | 'Worship' | 'Closing' | 'Offering' | 'Special' | 'Others';
  lyrics?: string;
}

interface CheckingAnimationProps {
  songs: SongInput[];
  theme: string;
  language: 'english' | 'taglish';
  onComplete: (report: SetlistCheckReport) => void;
}

const STEPS = [
  { icon: Music,     label: 'Looking at your songs',          duration: 1200 },
  { icon: AlignLeft, label: 'Reading through the lyrics',     duration: 3500 },
  { icon: BookOpen,  label: 'Checking if the gospel is clear',duration: 1800 },
  { icon: Target,    label: 'Reviewing the worship flow',     duration: 1800 },
  { icon: Shield,    label: 'Checking for any red flags',     duration: 1800 },
  { icon: Zap,       label: 'Putting each song to the test',  duration: 1600 },
  { icon: Star,      label: 'Coming up with a score',         duration: 1500 },
  { icon: Sparkles,  label: 'Preparing your report',          duration: 800  },
];

export function CheckingAnimation({ songs, theme, language, onComplete }: CheckingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<SetlistCheckReport | null>(null);
  const animDoneRef = useRef(false);
  const apiDoneRef = useRef(false);

  useEffect(() => {
    let stepIndex = 0;
    let cancelled = false;

    function advanceStep() {
      if (cancelled) return;
      if (stepIndex < STEPS.length) {
        setCurrentStep(stepIndex);
        const duration = STEPS[stepIndex].duration;
        stepIndex++;
        setTimeout(() => {
          if (cancelled) return;
          setCompletedSteps(prev => [...prev, stepIndex - 1]);
          if (stepIndex < STEPS.length) {
            advanceStep();
          } else {
            animDoneRef.current = true;
            if (apiDoneRef.current && reportRef.current) {
              onComplete(reportRef.current);
            }
          }
        }, duration);
      }
    }

    advanceStep();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.functions.invoke('check-setlist', {
      body: { theme, songs, language },
    }).then(({ data, error: fnErr }) => {
      if (fnErr || !data?.report) {
        setError(fnErr?.message || 'Analysis failed. Please try again.');
        return;
      }
      reportRef.current = data.report as SetlistCheckReport;
      apiDoneRef.current = true;
      if (animDoneRef.current) onComplete(data.report as SetlistCheckReport);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Analysis failed</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-xs">
          Try again
        </button>
      </div>
    );
  }

  const progress = completedSteps.length / STEPS.length;

  return (
    <div className="px-5 py-7 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
          <Sparkles className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Checking Setlist</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{songs.length} song{songs.length !== 1 ? 's' : ''} · MCJC Theological Framework</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(index);
          const isActive = currentStep === index && !isCompleted;
          const isPending = index > currentStep;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
              className="relative overflow-hidden flex items-center gap-3 rounded-2xl px-4 py-2.5"
            >
              {/* Active card background */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key="bg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 rounded-2xl border border-brand-200 dark:border-brand-700/40 bg-gradient-to-r from-brand-50 to-white dark:from-brand-950/40 dark:to-gray-900"
                  />
                )}
              </AnimatePresence>

              {/* Shimmer — only while active */}
              {isActive && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  animate={{ x: ['-100%', '150%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)' }}
                />
              )}

              {/* Icon */}
              <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                isCompleted ? 'bg-brand-100 dark:bg-brand-900/30' : isActive ? 'bg-brand-100 dark:bg-brand-900/50' : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div key="loader" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
                      <Loader2 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="icon">
                      <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Label */}
              <motion.p
                className={`relative z-10 text-sm flex-1 transition-colors duration-300 ${
                  isCompleted ? 'text-brand-600 dark:text-brand-400 font-medium'
                  : isActive   ? 'text-brand-700 dark:text-brand-300 font-semibold'
                  :              'text-gray-400 dark:text-gray-500'
                }`}
                animate={isActive ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                transition={isActive ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
              >
                {step.label}
              </motion.p>

              {/* Done badge */}
              <AnimatePresence>
                {isCompleted && (
                  <motion.span
                    key="done"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 text-[10px] font-semibold text-brand-500/60 dark:text-brand-400/50 shrink-0"
                  >
                    Done
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #4ade80, #16a34a)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
          {completedSteps.length === STEPS.length ? 'Almost done…' : `Step ${Math.min(currentStep + 1, STEPS.length)} of ${STEPS.length}`}
        </p>
      </div>

    </div>
  );
}
