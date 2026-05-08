import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Layers3,
  Music2,
  ShieldCheck,
  Sparkles,
  Users,
  Users2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.58, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const chips = ['10-day free trial', 'No complex billing', 'Built for worship teams'];

const pricingPlans = [
  {
    name: 'Free',
    price: '₱0',
    cadence: 'month',
    description: 'For small teams trying ServeSync.',
    cta: 'Start Free',
    members: 'Up to 5 members',
    featured: false,
    features: [
      'Core workspace access',
      'Basic schedules',
      'Basic setlists',
      'Announcements',
      'Upgrade anytime',
    ],
  },
  {
    name: 'Starter',
    price: '₱599',
    cadence: 'month',
    description: 'For one worship team getting organized.',
    members: 'Up to 12 members',
    cta: 'Start Starter',
    featured: false,
    features: [
      'Everything in Free',
      'Full schedule planning',
      'Setlists and service notes',
      'Attendance tracking',
      'Team announcements',
    ],
  },
  {
    name: 'Team',
    price: '₱999',
    cadence: 'month',
    description: 'For growing worship teams with regular rotations.',
    members: 'Up to 25 members',
    cta: 'Start Team',
    featured: true,
    features: [
      'Everything in Starter',
      'More team seats',
      'Better for weekly rotations',
      'Cleaner team coordination',
      'Priority workspace features',
    ],
  },
  {
    name: 'Ministry',
    price: '₱1,799',
    cadence: 'month',
    description: 'For larger ministries with multiple teams.',
    members: 'Up to 60 members',
    cta: 'Start Ministry',
    featured: false,
    features: [
      'Everything in Team',
      'Larger team capacity',
      'Best for established ministries',
      'Multi-service planning support',
      'Built for long-term ministry rhythm',
    ],
  },
];

const featureCards = [
  {
    title: 'Schedule with confidence',
    body: 'Plan services, assign team members, and keep everyone aligned.',
    icon: CalendarDays,
  },
  {
    title: 'Keep setlists organized',
    body: 'Give leaders and musicians one clear place for songs, notes, and service flow.',
    icon: Music2,
  },
  {
    title: 'Track team rhythm',
    body: 'Manage attendance, announcements, and team visibility without messy spreadsheets.',
    icon: BellRing,
  },
  {
    title: 'Manage availability',
    body: 'Collect unavailable dates early so leaders stop chasing last-minute replies.',
    icon: Users2,
  },
  {
    title: 'Keep ministry updates visible',
    body: 'Post important team announcements where everyone can actually find them.',
    icon: Layers3,
  },
  {
    title: 'Protect accountability',
    body: 'See attendance trends and leadership follow-up in one consistent place.',
    icon: ShieldCheck,
  },
];

const heroSignals = [
  { label: 'Schedules', icon: CalendarDays },
  { label: 'Setlists', icon: Music2 },
  { label: 'Attendance', icon: Users },
  { label: 'Billing', icon: CreditCard },
];

const heroFloatingCards = [
  {
    label: 'ServeSync activity',
    title: 'Sunday service ready',
    body: 'Setlist locked in',
    tone: 'emerald',
    className: 'left-[4.5vw] top-[50%] hidden xl:flex',
    width: 'large' as const,
    opacity: 0.9,
    rotate: 1,
    duration: 10,
  },
  {
    label: 'Live',
    title: 'New team update',
    body: '2 announcements posted',
    tone: 'cyan',
    className: 'right-[5.5vw] top-[46%] hidden xl:flex',
    width: 'large' as const,
    opacity: 0.9,
    rotate: -1,
    duration: 9.5,
  },
  {
    label: 'Billing synced',
    title: 'Plan active',
    body: 'Team plan monthly',
    tone: 'amber',
    className: 'right-[11vw] top-[62%] hidden xl:flex',
    width: 'medium' as const,
    opacity: 0.8,
    rotate: 2,
    duration: 11,
  },
  {
    label: 'Music team',
    title: 'Setlist approved',
    body: '8 songs ready',
    tone: 'emerald',
    className: 'left-[11vw] top-[72%] hidden xl:flex',
    width: 'small' as const,
    opacity: 0.58,
    rotate: -1.5,
    duration: 9,
  },
  {
    label: 'This week',
    title: 'Rehearsal flow set',
    body: 'Friday 7:30 PM',
    tone: 'cyan',
    className: 'right-[15vw] top-[76%] hidden xl:flex',
    width: 'small' as const,
    opacity: 0.54,
    rotate: -2,
    duration: 10.5,
  },
  {
    label: 'Team workspace',
    title: '18 members active',
    body: '3 serving teams',
    tone: 'violet',
    className: 'left-[7vw] top-[24%] hidden xl:flex',
    width: 'medium' as const,
    opacity: 0.68,
    rotate: -2,
    duration: 8,
  },
  {
    label: 'Live',
    title: 'Attendance synced',
    body: '92% this week',
    tone: 'violet',
    className: 'right-[9.5vw] top-[23%] hidden xl:flex',
    width: 'medium' as const,
    opacity: 0.7,
    rotate: 1.5,
    duration: 9,
  },
];

const heroFloatingCardsLg = [
  {
    label: 'Team workspace',
    title: '18 members active',
    body: '3 serving teams',
    tone: 'violet' as FloatingTone,
    className: 'left-[7vw] top-[24%] hidden lg:flex xl:hidden',
    width: 'medium' as const,
    opacity: 0.78,
    rotate: -2,
    duration: 8.5,
  },
  {
    label: 'ServeSync activity',
    title: 'Sunday service ready',
    body: 'Setlist locked in',
    tone: 'emerald' as FloatingTone,
    className: 'left-[4.5vw] top-[53%] hidden lg:flex xl:hidden',
    width: 'large' as const,
    opacity: 0.88,
    rotate: 1,
    duration: 10,
  },
  {
    label: 'Live',
    title: 'Attendance synced',
    body: '92% this week',
    tone: 'violet' as FloatingTone,
    className: 'right-[9.5vw] top-[23%] hidden lg:flex xl:hidden',
    width: 'medium' as const,
    opacity: 0.74,
    rotate: 1.5,
    duration: 9,
  },
  {
    label: 'Live',
    title: 'New team update',
    body: '2 announcements posted',
    tone: 'cyan' as FloatingTone,
    className: 'right-[5.5vw] top-[47%] hidden lg:flex xl:hidden',
    width: 'large' as const,
    opacity: 0.88,
    rotate: -1,
    duration: 9.5,
  },
];

type FloatingTone = 'emerald' | 'cyan' | 'violet' | 'amber';

function FloatingStatusCard({
  label,
  title,
  body,
  tone,
  className,
  delay = 0,
  compact = false,
  width = 'medium',
  opacity = 1,
  rotate = 0,
  duration = 8,
}: {
  label: string;
  title: string;
  body: string;
  tone: FloatingTone;
  className: string;
  delay?: number;
  compact?: boolean;
  width?: 'small' | 'medium' | 'large';
  opacity?: number;
  rotate?: number;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();

  const widthClass = compact
    ? 'w-[168px]'
    : width === 'small'
      ? 'w-[152px]'
      : width === 'large'
        ? 'w-[190px]'
        : 'w-[172px]';

  const toneClasses =
    tone === 'emerald'
      ? 'bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]'
      : tone === 'cyan'
        ? 'bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.85)]'
        : tone === 'amber'
          ? 'bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.85)]'
          : 'bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.85)]';

  return (
    <motion.div
      initial={false}
      animate={
        reduceMotion
          ? { y: 0, rotate }
          : { y: [0, -6, 0], rotate }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration, repeat: Infinity, ease: 'easeInOut', delay }
      }
      style={{ opacity }}
      className={`pointer-events-none absolute z-20 flex ${widthClass} flex-col rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(19,29,39,0.92),rgba(11,17,24,0.95))] p-3.5 text-left shadow-[0_22px_48px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses}`} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-white/88">{title}</p>
          <p className="mt-1 text-xs leading-5 text-white/58">{body}</p>
        </div>
      </div>
      <div className="mt-3 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0.1),transparent)]" />
      <div className="mt-2 text-[11px] font-medium text-white/40">ServeSync</div>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
      {children}
    </p>
  );
}

function Surface({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[32px] bg-[linear-gradient(180deg,rgba(18,27,36,0.94),rgba(11,17,24,0.96))] ring-1 ring-white/[0.08] shadow-[0_28px_90px_-56px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8">
      <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)]" />
    </div>
  );
}

function HeroPreviewPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto mt-5 w-full max-w-[740px]"
    >
      <div className="pointer-events-none absolute inset-x-10 -top-6 h-24 rounded-full bg-emerald-400/16 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.12),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-10 bottom-[-0.75rem] h-24 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(18,27,36,0.8),rgba(10,16,24,0.9))] px-4 py-4 shadow-[0_28px_80px_-44px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_40px_-32px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-white/[0.03]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.24),transparent)]" />
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Workspace Preview</p>
            <h3 className="mt-1 text-sm font-semibold text-white/88 sm:text-base">This Week in ServeSync</h3>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
            Ready for rehearsal
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="flex min-h-[118px] flex-col rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36">Schedule</p>
            <p className="mt-3 text-sm font-semibold text-white/88 sm:text-base">Sunday Service</p>
            <p className="mt-1 text-sm text-white/56">7:30 AM call time</p>
          </div>

          <div className="flex min-h-[118px] flex-col rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36">Setlist</p>
            <p className="mt-3 text-sm font-semibold text-white/88 sm:text-base">8 songs ready</p>
            <p className="mt-1 text-sm text-white/56">Leader approved</p>
          </div>

          <div className="flex min-h-[118px] flex-col rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36">Team</p>
            <p className="mt-3 text-sm font-semibold text-white/88 sm:text-base">18 active members</p>
            <p className="mt-1 text-sm text-white/56">92% attendance</p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-white/34">
          <span>Built for weekly planning</span>
          <span className="h-1 w-1 rounded-full bg-white/18" />
          <span>rehearsal flow</span>
          <span className="h-1 w-1 rounded-full bg-white/18" />
          <span>team coordination</span>
        </div>
      </div>
    </motion.div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroGlowY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const gridOpacity = useTransform(scrollYProgress, [0, 0.45], [0.16, 0.06]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [navigate, user]);

  if (user) return null;

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#081019] text-white"
      style={{
        colorScheme: 'dark',
        fontFamily: 'Inter, Geist, system-ui, sans-serif',
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{ y: heroGlowY }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.16), transparent 30%),' +
                'radial-gradient(circle at 18% 18%, rgba(20,184,166,0.12), transparent 22%),' +
                'radial-gradient(circle at 82% 16%, rgba(56,189,248,0.10), transparent 18%),' +
                'linear-gradient(180deg, #0f1722 0%, #0a1118 55%, #081019 100%)',
            }}
          />
          <div className="absolute left-1/2 top-24 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-emerald-400/8 blur-[120px]" />
          <div className="absolute right-[8%] top-48 h-56 w-56 rounded-full bg-cyan-400/6 blur-[110px]" />
        </motion.div>
        <motion.div
          animate={{
            x: [0, 24, -12, 0],
            y: [0, -18, 12, 0],
            scale: [1, 1.04, 0.98, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-[-8rem] top-32 h-[22rem] w-[22rem] rounded-full bg-emerald-300/6 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -20, 10, 0],
            y: [0, 24, -10, 0],
            scale: [1, 0.96, 1.02, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-24 right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-sky-300/5 blur-[130px]"
        />
        <motion.div
          style={{ opacity: gridOpacity }}
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:96px_96px]"
        />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-screen [background-image:radial-gradient(circle_at_20%_20%,white_0.6px,transparent_0.8px)] [background-size:22px_22px]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      </div>

      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.42 }}
        className="sticky top-0 z-50 px-4 pt-4 transition-all sm:px-6 lg:px-8"
      >
        <div
          className={`mx-auto flex h-16 max-w-[1120px] items-center justify-between rounded-full border border-white/[0.08] px-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:px-5 ${
            scrolled
              ? 'bg-[#0c141d]/88'
              : 'bg-[linear-gradient(180deg,rgba(19,29,39,0.78),rgba(11,17,24,0.72))]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.12] bg-white text-gray-950 shadow-[0_14px_34px_-20px_rgba(255,255,255,0.35)]">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">ServeSync</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Worship team workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-semibold text-white/82 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/create-church')}
              className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-gray-950 shadow-[0_18px_44px_-24px_rgba(255,255,255,0.42)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              Create Church
            </button>
          </div>
        </div>
      </motion.header>

      <main>
        <section className="relative flex min-h-[calc(100vh-5rem)] items-center overflow-hidden pb-6 pt-1 sm:pt-3 lg:pb-10">
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.14),transparent_56%)]" />
            <div
              className="absolute left-1/2 top-[34%] h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-80"
              style={{
                background:
                  'radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(56,189,248,0.07) 38%, transparent 72%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse at center, black 0%, black 48%, transparent 78%)',
                maskImage:
                  'radial-gradient(ellipse at center, black 0%, black 48%, transparent 78%)',
              }}
            />
            <div
              className="absolute left-1/2 top-[72%] h-[300px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-70"
              style={{
                background:
                  'radial-gradient(circle, rgba(45,212,191,0.10) 0%, rgba(15,23,42,0.06) 45%, transparent 75%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse at center, black 0%, black 50%, transparent 80%)',
                maskImage:
                  'radial-gradient(ellipse at center, black 0%, black 50%, transparent 80%)',
              }}
            />
            <div
              className="absolute left-[14%] top-[30%] h-52 w-52 rounded-full blur-[110px]"
              style={{
                background:
                  'radial-gradient(circle, rgba(110,231,183,0.08) 0%, rgba(110,231,183,0.03) 45%, transparent 75%)',
              }}
            />
            <div
              className="absolute right-[12%] top-[56%] h-56 w-56 rounded-full blur-[120px]"
              style={{
                background:
                  'radial-gradient(circle, rgba(125,211,252,0.08) 0%, rgba(125,211,252,0.03) 45%, transparent 78%)',
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,rgba(8,16,25,0.92))]" />
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 select-none">
            {heroFloatingCards.map((card, index) => (
              <FloatingStatusCard
                key={card.title}
                label={card.label}
                title={card.title}
                body={card.body}
                tone={card.tone as FloatingTone}
                className={card.className}
                delay={index * 0.18}
                width={card.width}
                opacity={card.opacity}
                rotate={card.rotate}
                duration={card.duration}
              />
            ))}
            {heroFloatingCardsLg.map((card, index) => (
              <FloatingStatusCard
                key={card.title}
                label={card.label}
                title={card.title}
                body={card.body}
                tone={card.tone}
                className={card.className}
                delay={index * 0.14}
                width={card.width}
                opacity={card.opacity}
                rotate={card.rotate}
                duration={card.duration}
              />
            ))}
          </div>

          <div className="relative z-20 mx-auto flex w-full max-w-[820px] flex-col items-center px-6 text-center">
            <Reveal>
              <div className="relative">
                <motion.div
                  animate={{
                    scale: [1, 1.06, 1],
                    opacity: [0.28, 0.45, 0.28],
                  }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute left-1/2 top-16 z-0 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-400/16 blur-[90px]"
                />
                <div className="pointer-events-none absolute left-1/2 top-[-2.5rem] z-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-white/[0.05] opacity-60" />
                <div className="pointer-events-none absolute left-1/2 top-[2.75rem] z-0 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full border border-white/[0.035] opacity-50" />
                <motion.div
                  animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 28, repeat: Infinity, ease: 'linear' }}
                  className="pointer-events-none absolute left-1/2 top-10 z-0 hidden h-[22rem] w-[22rem] -translate-x-1/2 rounded-full border border-white/[0.05] lg:block"
                >
                  <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_26px_rgba(110,231,183,0.9)]" />
                  <div className="absolute bottom-0 left-12 h-2.5 w-2.5 translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.8)]" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 inline-flex items-center gap-2 rounded-full border border-emerald-500/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(16,185,129,0.06))] px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.55)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Premium worship team workspace
              </motion.div>

              <h1 className="relative z-10 mx-auto mt-5 max-w-5xl text-[clamp(3.2rem,9vw,6.2rem)] font-black leading-[0.9] tracking-[-0.08em]">
                Worship planning,
                <br />
                with{' '}
                <span className="bg-[linear-gradient(135deg,#ffffff_0%,#c7f9e8_48%,#7dd3fc_100%)] bg-clip-text text-transparent">
                  finally composed.
                </span>
              </h1>

              <p className="relative z-10 mx-auto mt-4 max-w-2xl text-base leading-7 text-white/56 sm:text-lg">
                One calm workspace for worship teams.
              </p>

              <div className="relative z-10 mt-4 flex flex-wrap justify-center gap-2.5">
                {heroSignals.map(signal => {
                  const Icon = signal.icon;
                  return (
                    <motion.div
                      key={signal.label}
                      whileHover={{ y: -3, scale: 1.01 }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3.5 py-2 text-sm font-medium text-white/78 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <div className="rounded-xl bg-emerald-500/12 p-1.5 text-emerald-300">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {signal.label}
                    </motion.div>
                  );
                })}
              </div>

              <div className="relative z-10 mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <motion.button
                  onClick={() => navigate('/create-church')}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-gray-950 shadow-[0_20px_52px_-24px_rgba(255,255,255,0.48)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50 sm:text-base"
                >
                  Start 10-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
                <motion.button
                  onClick={() => navigate('/login')}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.985 }}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-6 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] sm:text-base"
                >
                  Sign In
                </motion.button>
              </div>

              <div className="relative z-10 mt-3.5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-white/31">
                {chips.map((chip, index) => (
                  <div key={chip} className="flex items-center gap-2">
                    {index > 0 && <span className="h-1 w-1 rounded-full bg-white/18" />}
                    <span>{chip}</span>
                  </div>
                ))}
              </div>

              <HeroPreviewPanel />

              <div className="relative z-10 mt-8 flex w-full flex-col gap-3 lg:hidden">
                <FloatingStatusCard
                  label="Live"
                  title="Sunday service ready"
                  body="Setlist locked in"
                  tone="emerald"
                  className="relative left-auto top-auto right-auto bottom-auto mx-auto"
                  compact
                />
                <FloatingStatusCard
                  label="Team workspace"
                  title="18 members active"
                  body="3 serving teams"
                  tone="violet"
                  className="relative left-auto top-auto right-auto bottom-auto mx-auto"
                  compact
                />
              </div>
            </Reveal>
          </div>
        </section>

        <SectionDivider />

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <Reveal>
                <SectionLabel>What Changes</SectionLabel>
                <h2 className="mt-3 text-[clamp(2rem,5vw,3.3rem)] font-black leading-[0.96] tracking-[-0.06em]">
                  The weekly ministry cadence
                  <br />
                  feels controlled again.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/58">
                  ServeSync helps worship teams move from scattered chats, forgotten updates, and manual tracking into one structured weekly rhythm.
                </p>
              </Reveal>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map(feature => {
                const Icon = feature.icon;
                return (
                  <Reveal key={feature.title}>
                    <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.22 }}>
                      <Surface className="relative overflow-hidden h-full p-6 text-left">
                        <div className="absolute right-5 top-5 h-12 w-12 rounded-full bg-emerald-400/7 blur-2xl" />
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-6 text-xl font-bold tracking-tight">{feature.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-white/60">{feature.body}</p>
                        <div className="mt-6 flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-white/[0.06]">
                            <div className="h-full w-4/5 rounded-full bg-[linear-gradient(90deg,rgba(16,185,129,0.88),rgba(103,232,249,0.75))]" />
                          </div>
                          <div className="h-2 w-10 rounded-full bg-white/[0.05]" />
                        </div>
                      </Surface>
                    </motion.div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <SectionDivider />

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <Surface className="relative overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(16,185,129,0.10),transparent_32%)]" />
                <div className="text-center">
                  <SectionLabel>Pricing Structure</SectionLabel>
                  <h2 className="mt-3 text-[clamp(2rem,5vw,3.5rem)] font-black leading-[0.96] tracking-[-0.06em]">
                    Simple plans for growing
                    <br />
                    worship teams.
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/58">
                    Start free, then upgrade when your team needs more space.
                  </p>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                  {pricingPlans.map(plan => (
                    <motion.div
                      key={plan.name}
                      whileHover={{ y: -8 }}
                      transition={{ duration: 0.22 }}
                      className={`relative flex h-full flex-col overflow-hidden rounded-[32px] p-5 sm:p-6 ${
                        plan.featured
                          ? 'bg-[linear-gradient(180deg,rgba(9,40,34,0.96),rgba(9,24,22,0.96))] ring-1 ring-emerald-500/28 shadow-[0_34px_100px_-42px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'bg-[linear-gradient(180deg,rgba(18,27,36,0.96),rgba(11,17,24,0.96))] ring-1 ring-white/[0.07] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]'
                      }`}
                    >
                      <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)]" />
                      {plan.featured && <div className="pointer-events-none absolute right-[-3rem] top-[-3rem] h-28 w-28 rounded-full bg-emerald-400/12 blur-3xl" />}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold tracking-tight">{plan.name}</p>
                          <p className="mt-2 max-w-full text-[14px] leading-[1.5] text-white/58">{plan.description}</p>
                        </div>
                        {plan.featured && (
                          <span className="shrink-0 rounded-full bg-emerald-400/14 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 ring-1 ring-emerald-500/28">
                            Popular
                          </span>
                        )}
                      </div>

                      <div className="mt-6">
                        <div className="flex items-end gap-2">
                          <span className="text-5xl font-black tracking-[-0.07em]">{plan.price}</span>
                          <span className="pb-1 text-sm font-semibold text-white/42">/ {plan.cadence}</span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                          {plan.members}
                        </p>
                      </div>

                      <div className="mt-6 flex-1 space-y-3">
                        {plan.features.map(feature => (
                          <div key={feature} className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-xl bg-emerald-500/12 p-1.5 text-emerald-300">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-[14px] leading-[1.45] text-white/72">{feature}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto border-t border-white/[0.08] pt-5">
                        <button
                          onClick={() => navigate('/create-church')}
                          className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                            plan.featured
                              ? 'bg-white text-gray-950 shadow-[0_22px_54px_-24px_rgba(255,255,255,0.48)] hover:bg-emerald-50'
                              : 'border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]'
                          }`}
                        >
                          {plan.cta}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <p className="mt-3 text-center text-[11px] text-white/38">
                          {plan.price === '₱0' ? 'Start free and upgrade later' : '10-day free trial included'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Surface>
            </Reveal>
          </div>
        </section>

        <SectionDivider />

        <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <Surface className="relative overflow-hidden bg-[linear-gradient(135deg,rgba(16,26,36,0.98),rgba(8,17,24,0.98))] px-6 py-8 sm:px-8 sm:py-10 lg:px-12">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.12),transparent_38%)]" />
                <div className="flex flex-col items-center text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/82 ring-1 ring-white/[0.08]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    Subscription-ready and ministry-safe
                  </div>
                  <h2 className="mt-5 text-[clamp(2.1rem,5vw,3.8rem)] font-black leading-[0.96] tracking-[-0.06em]">
                    Ready to bring structure
                    <br />
                    to your worship team?
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/60">
                    Start with a 10-day trial and set up your church workspace in minutes.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => navigate('/create-church')}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-gray-950 shadow-[0_20px_52px_-24px_rgba(255,255,255,0.48)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50 sm:text-base"
                    >
                      Start 10-Day Trial
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-6 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] sm:text-base"
                    >
                      Sign In
                    </button>
                  </div>

                  <p className="mt-5 text-xs uppercase tracking-[0.16em] text-white/38">
                    10-day trial included. Manual verification after trial.
                  </p>
                </div>
              </Surface>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.12] bg-white text-gray-950">
              <Music2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">ServeSync</p>
              <p className="text-xs uppercase tracking-[0.15em] text-white/38">Premium workflow for worship teams</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/58">
            <button onClick={() => navigate('/login')} className="transition-colors hover:text-white">
              Sign In
            </button>
            <button onClick={() => navigate('/create-church')} className="transition-colors hover:text-white">
              Create Church
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
