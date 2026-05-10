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
  { icon: Music,     label: 'Reading setlist songs...',          duration: 700  },
  { icon: AlignLeft, label: 'Fetching song lyrics...',           duration: 1800 },
  { icon: BookOpen,  label: 'Checking gospel-centeredness...',   duration: 900  },
  { icon: Target,    label: 'Analysing slot fit & flow...',      duration: 900  },
  { icon: Shield,    label: 'Scanning for theological flags...', duration: 900  },
  { icon: Zap,       label: 'Running five-question test...',     duration: 800  },
  { icon: Star,      label: 'Scoring & computing verdict...',    duration: 700  },
  { icon: Sparkles,  label: 'Building action plan...',           duration: 500  },
];

const MIN_ANIMATION_MS = STEPS.reduce((s, step) => s + step.duration, 0); // ~7200ms

export function CheckingAnimation({ songs, theme, language, onComplete }: CheckingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<SetlistCheckReport | null>(null);
  const animDoneRef = useRef(false);
  const apiDoneRef = useRef(false);

  // Advance animation steps
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

  // Call edge function
  useEffect(() => {
    const startTime = Date.now();

    supabase.functions.invoke('check-setlist', {
      body: { theme, songs, language },
    }).then(({ data, error: fnErr }) => {
      if (fnErr || !data?.report) {
        setError(fnErr?.message || 'Analysis failed. Please try again.');
        return;
      }

      reportRef.current = data.report as SetlistCheckReport;
      apiDoneRef.current = true;

      const elapsed = Date.now() - startTime;
      const remaining = MIN_ANIMATION_MS - elapsed;

      if (remaining <= 0 && animDoneRef.current) {
        onComplete(data.report as SetlistCheckReport);
      }
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
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary text-xs"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-8">
      {/* Title */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Checking Setlist</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{songs.length} song{songs.length !== 1 ? 's' : ''} · MCJC Theological Framework</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(index);
          const isActive = currentStep === index && !isCompleted;
          const isPending = index > currentStep;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                isCompleted
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : isActive
                  ? 'bg-brand-100 dark:bg-brand-900/30'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div key="loading" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Loader2 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="icon">
                      <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className={`text-sm transition-colors duration-300 ${
                isCompleted
                  ? 'text-green-700 dark:text-green-400 line-through decoration-green-400/50'
                  : isActive
                  ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                {step.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-6 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-brand-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completedSteps.length / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2">
        {completedSteps.length === STEPS.length ? 'Almost done...' : `Step ${Math.min(currentStep + 1, STEPS.length)} of ${STEPS.length}`}
      </p>
    </div>
  );
}
