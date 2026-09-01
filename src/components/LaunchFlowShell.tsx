import type { ReactNode } from 'react';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface LaunchFlowStep {
  label: string;
  detail: string;
}

interface LaunchFlowShellProps {
  eyebrow: string;
  title: string;
  description: string;
  steps: LaunchFlowStep[];
  currentStep: number;
  children: ReactNode;
  backTo?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function LaunchFlowShell({
  eyebrow,
  title,
  description,
  steps,
  currentStep,
  children,
  backTo,
  onBack,
  backLabel = 'Back',
}: LaunchFlowShellProps) {
  const backClass = 'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-white/52 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(30,215,96,0.12),transparent_32%),radial-gradient(circle_at_88%_78%,rgba(30,215,96,0.055),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-12 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
        <header className="flex min-h-14 items-center justify-between">
          {backTo ? (
            <Link to={backTo} className={backClass}>
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Link>
          ) : onBack ? (
            <button type="button" onClick={onBack} className={backClass}>
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </button>
          ) : <span />}
          <Link to="/" className="inline-flex items-center gap-2.5 rounded-full px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/72">ServeSync</span>
          </Link>
        </header>

        <div className="grid flex-1 items-start gap-10 pb-8 pt-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] lg:gap-16 lg:pt-20">
          <section className="lg:sticky lg:top-16">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#1ed760]">{eyebrow}</p>
            <h1 className="mt-4 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-5 max-w-lg text-sm font-medium leading-6 text-white/48 sm:text-base">{description}</p>

            <ol aria-label="Setup progress" className="mt-8 grid grid-cols-3 gap-1 lg:mt-12 lg:grid-cols-1">
              {steps.map((step, index) => {
                const complete = index < currentStep;
                const active = index === currentStep;
                return (
                  <li key={step.label} className={`group relative flex min-h-14 min-w-0 flex-col items-start gap-2 border-t-2 px-2 py-2 transition-colors sm:flex-row sm:items-center sm:gap-3 sm:px-3 lg:border-l-2 lg:border-t-0 ${active ? 'border-[#1ed760] bg-white/[0.045]' : complete ? 'border-[#1ed760]/35' : 'border-white/[0.08]'}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? 'bg-[#1ed760] text-black' : complete ? 'bg-[#1ed760]/12 text-[#63ee91]' : 'bg-white/[0.055] text-white/25'}`}>
                      {complete ? <Check className="h-3.5 w-3.5" /> : <Circle className={`h-2.5 w-2.5 ${active ? 'fill-current' : ''}`} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[12px] font-black ${active ? 'text-white' : 'text-white/52'}`}>{step.label}</span>
                      <span className="mt-0.5 hidden truncate text-[11px] text-white/30 lg:block">{step.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <motion.section
            aria-label={`${eyebrow} workflow`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 border-t border-white/[0.08] pt-8 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-1"
          >
            {children}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
