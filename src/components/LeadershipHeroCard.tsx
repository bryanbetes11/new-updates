import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

type LeadershipHeroTone = 'emerald' | 'amber' | 'red' | 'sky';

const toneStyles: Record<LeadershipHeroTone, {
  border: string;
  background: string;
  eyebrow: string;
  glow: string;
  iconGradient: string;
  iconShadow: string;
}> = {
  emerald: {
    border: 'border-emerald-200/70 dark:border-white/[0.08]',
    background: 'bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.14),transparent_36%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)]',
    eyebrow: 'text-emerald-700/80 dark:text-emerald-300/70',
    glow: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)',
    iconGradient: 'linear-gradient(145deg, #16a34a, #15803d)',
    iconShadow: '0 4px 14px rgba(22,163,74,0.35)',
  },
  amber: {
    border: 'border-amber-200/70 dark:border-white/[0.08]',
    background: 'bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.20),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(251,191,36,0.12),transparent_36%),linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(135deg,#1a1205_0%,#11100d_46%,#070807_100%)]',
    eyebrow: 'text-amber-700/85 dark:text-amber-300/72',
    glow: 'radial-gradient(circle, rgba(245,158,11,0.34), transparent 70%)',
    iconGradient: 'linear-gradient(145deg, #f59e0b, #d97706)',
    iconShadow: '0 4px 14px rgba(245,158,11,0.35)',
  },
  red: {
    border: 'border-red-200/70 dark:border-white/[0.08]',
    background: 'bg-[radial-gradient(circle_at_18%_20%,rgba(248,113,113,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(248,113,113,0.12),transparent_36%),linear-gradient(135deg,#fef2f2_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(239,68,68,0.12),transparent_36%),linear-gradient(135deg,#1b0909_0%,#11100d_46%,#070807_100%)]',
    eyebrow: 'text-red-600/85 dark:text-red-300/72',
    glow: 'radial-gradient(circle, rgba(239,68,68,0.32), transparent 70%)',
    iconGradient: 'linear-gradient(145deg, #ef4444, #b91c1c)',
    iconShadow: '0 4px 14px rgba(239,68,68,0.32)',
  },
  sky: {
    border: 'border-sky-200/70 dark:border-white/[0.08]',
    background: 'bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(56,189,248,0.12),transparent_36%),linear-gradient(135deg,#f0f9ff_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(14,165,233,0.12),transparent_36%),linear-gradient(135deg,#06161f_0%,#0d1110_46%,#070807_100%)]',
    eyebrow: 'text-sky-700/85 dark:text-sky-300/72',
    glow: 'radial-gradient(circle, rgba(14,165,233,0.32), transparent 70%)',
    iconGradient: 'linear-gradient(145deg, #0ea5e9, #0284c7)',
    iconShadow: '0 4px 14px rgba(14,165,233,0.32)',
  },
};

interface LeadershipHeroCardProps {
  tone: LeadershipHeroTone;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export function LeadershipHeroCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  children,
}: LeadershipHeroCardProps) {
  const styles = toneStyles[tone];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.38)] sm:p-6 ${styles.border} ${styles.background}`}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: styles.glow, filter: 'blur(10px)', transform: 'scale(1.5)' }}
            />
            <div
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: styles.iconGradient, boxShadow: styles.iconShadow }}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <p className={`text-[10px] font-mono font-medium uppercase tracking-[0.22em] ${styles.eyebrow}`}>
              {eyebrow}
            </p>
            <h1
              className="mt-1 text-[2rem] font-black leading-none text-gray-950 dark:text-white sm:text-[2.35rem]"
              style={{ letterSpacing: '-0.055em' }}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-gray-500 dark:text-white/44">
                {description}
              </p>
            )}
          </div>
        </div>

        {action && <div className="sm:shrink-0">{action}</div>}
      </div>

      {children ? (
        <div className="relative mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.10]">
          {children}
        </div>
      ) : null}
    </motion.section>
  );
}
