import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Calendar,
  Check,
  GripVertical,
  Layers3,
  Music2,
  Play,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ── shared primitives ───────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
}

function Wrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-5 lg:px-7 ${className}`}>
      {children}
    </div>
  );
}

// ── in-product visuals ──────────────────────────────────────────

function ScheduleVisual() {
  const days = [
    { n: 'Mon', has: false },
    { n: 'Tue', has: false },
    { n: 'Wed', has: true },
    { n: 'Thu', has: false },
    { n: 'Fri', has: true },
    { n: 'Sat', has: false },
    { n: 'Sun', has: true, big: true },
  ];
  return (
    <div className="rounded-[18px] bg-[#0e1a26] border border-white/[0.07] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[11px] text-white/50">This week · May 11–17</span>
        <span className="font-mono text-[11px] text-white/35">Week 19</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(d => (
          <div
            key={d.n}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 ${
              d.has
                ? 'bg-[rgba(52,211,153,0.14)] border border-[rgba(52,211,153,0.30)]'
                : 'bg-white/[0.03] border border-white/[0.06]'
            }`}
          >
            <span className={`font-mono text-[10px] font-semibold ${d.has ? 'text-emerald-400' : 'text-white/40'}`}>
              {d.n}
            </span>
            {d.has && <span className="h-1.5 w-full rounded-full bg-emerald-400/70" />}
            {d.has && d.big && <span className="h-1 w-full rounded-full bg-emerald-400/40" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SetlistVisual() {
  const songs = [
    { n: '01', t: 'Goodness of God', s: 'Bethel · 72 BPM', k: 'A' },
    { n: '02', t: 'Build My Life', s: 'Pat Barrett · 72 BPM', k: 'E', active: true },
    { n: '03', t: 'Way Maker', s: 'Sinach · 70 BPM', k: 'D' },
    { n: '04', t: 'King of Kings', s: 'Hillsong · 73 BPM', k: 'D' },
  ];
  return (
    <div className="rounded-[18px] bg-[#0e1a26] border border-white/[0.07] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <span className="text-sm font-semibold text-[#eef3f8]">Sunday — May 17</span>
        <span className="font-mono text-[11px] text-white/45">5 songs · 28 min</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {songs.map(r => (
          <div
            key={r.n}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              r.active ? 'bg-[rgba(52,211,153,0.10)] border-l-2 border-emerald-400' : ''
            }`}
          >
            <GripVertical className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold truncate ${r.active ? 'text-emerald-400' : 'text-[#eef3f8]'}`}>
                {r.t}
              </div>
              <div className="font-mono text-[10px] text-white/40 truncate">{r.s}</div>
            </div>
            <span
              className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                r.active ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/[0.07] text-white/50'
              }`}
            >
              {r.k}
            </span>
            <Play className="h-3.5 w-3.5 text-white/30 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceVisual() {
  const bars = [42, 56, 48, 68, 72, 65, 80, 74, 82, 88, 84, 92];
  return (
    <div className="rounded-[18px] bg-[#0e1a26] border border-white/[0.07] p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="font-mono text-[11px] text-white/45 mb-2">12-week attendance</div>
          <div className="flex items-end gap-1">
            <span className="font-mono text-5xl font-semibold text-[#eef3f8] leading-none">92</span>
            <span className="font-mono text-xl text-white/40 mb-0.5">%</span>
          </div>
        </div>
        <span className="font-mono text-[12px] font-semibold text-emerald-400 bg-[rgba(52,211,153,0.14)] px-2.5 py-1 rounded-full mt-1">
          +11 vs Q1
        </span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${i < 6 ? 'bg-white/[0.12]' : 'bg-emerald-400/70'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2.5">
        {['W1', 'W6', 'W12'].map(l => (
          <span key={l} className="font-mono text-[10px] text-white/35">{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── nav ─────────────────────────────────────────────────────────

function Nav({ onSignIn }: { onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="sticky z-50 px-5 lg:px-7"
      style={{ top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}
    >
      <div
        className={`mx-auto flex h-[60px] max-w-[1180px] items-center justify-between rounded-full border border-white/[0.08] px-5 transition-colors duration-200`}
        style={{ backdropFilter: 'blur(14px)', background: scrolled ? 'rgba(7,16,26,0.92)' : 'rgba(14,26,38,0.70)' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[9px] bg-white flex items-center justify-center shrink-0">
            <Music2 className="h-4 w-4 text-[#07101a]" />
          </div>
          <span className="font-semibold text-[#eef3f8] text-sm">ServeSync</span>
        </div>

        <div className="hidden md:flex items-center gap-7">
          {[['Features', '#features'], ['Product', '#walkthrough'], ['FAQ', '#faq']].map(
            ([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-[13px] text-white/55 hover:text-white transition-colors duration-150"
              >
                {label}
              </a>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSignIn}
            className="h-[38px] px-4 rounded-full border border-white/[0.10] text-[13px] font-semibold text-white/70 hover:text-white hover:bg-white/[0.06] transition-all duration-150"
          >
            Sign in
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── main export ─────────────────────────────────────────────────

const FEATURES = [
  { icon: Calendar,  n: '01', title: 'Schedules that stick',       body: 'Plan services, assign team members, and stop chasing replies in five different group chats.' },
  { icon: Music2,    n: '02', title: 'One home for setlists',      body: 'Songs, keys, notes, and service flow — visible to leaders and musicians before rehearsal starts.' },
  { icon: BellRing,  n: '03', title: 'Announcements that land',    body: 'Post team updates where everyone can actually find them. No more buried Messenger threads.' },
  { icon: Users2,    n: '04', title: 'Availability up front',      body: 'Collect unavailable dates early so leaders aren\'t filling slots the night before.' },
  { icon: Layers3,   n: '05', title: 'Attendance in context',      body: 'See who\'s serving, who\'s missed two weeks in a row, and who\'s quietly carrying the team.' },
  { icon: ShieldCheck, n: '06', title: 'Built for ministry rhythm', body: 'Weekly cadence, multi-team support, and structured accountability — without the spreadsheet.' },
];

const WALK = [
  {
    label: 'Schedules',
    title: 'Plan the next four Sundays in one view.',
    body: 'Drag people into slots. See conflicts before they happen. Send confirmation in one click.',
    checks: ['Recurring services', 'Conflict detection', 'Replacement requests'],
    visual: <ScheduleVisual />,
    flip: false,
  },
  {
    label: 'Setlists',
    title: 'Songs, keys, and notes in the right place.',
    body: 'Build a setlist, lock the keys, share notes with the band. Everyone walks into rehearsal already prepared.',
    checks: ['Reusable song library', 'Per-service notes', 'Synced to the team'],
    visual: <SetlistVisual />,
    flip: true,
  },
  {
    label: 'Attendance',
    title: 'See who shows up — and who needs a check-in.',
    body: 'Track who served, who missed, and who is quietly burning out. Trends you can actually act on.',
    checks: ['Weekly check-in', '12-week trend', 'Leader follow-ups'],
    visual: <AttendanceVisual />,
    flip: false,
  },
];

const STEPS = [
  { n: 'Step 01', title: 'Sign in with your team account',  body: 'Use the church workspace already set up for your ministry team.' },
  { n: 'Step 02', title: 'Set the cadence',      body: 'Add your recurring services and rehearsals. ServeSync builds the weekly view automatically.' },
  { n: 'Step 03', title: 'Build a setlist',      body: 'Drop in songs, set the keys, write the notes. Share with the band in one tap.' },
  { n: 'Step 04', title: 'Run a calmer week',    body: 'Mark attendance, post updates, and let the rhythm carry the team instead of leaders chasing it.' },
];

const PLANS = [
  {
    name: 'Free',     price: '₱0',     seats: 'Up to 5 members',
    desc: 'For small teams trying ServeSync.',
    feat: false,
    features: ['Core workspace', 'Basic schedules', 'Basic setlists', 'Announcements'],
  },
  {
    name: 'Starter',  price: '₱599',   seats: 'Up to 12 members',
    desc: 'For one worship team getting organized.',
    feat: false,
    features: ['Everything in Free', 'Full schedule planning', 'Setlists + service notes', 'Attendance tracking'],
  },
  {
    name: 'Team',     price: '₱999',   seats: 'Up to 25 members',
    desc: 'For growing teams with regular rotations.',
    feat: true,
    features: ['Everything in Starter', 'More team seats', 'Built for weekly rotations', 'Priority workspace features'],
  },
  {
    name: 'Ministry', price: '₱1,799', seats: 'Up to 60 members',
    desc: 'For larger ministries with multiple teams.',
    feat: false,
    features: ['Everything in Team', 'Larger team capacity', 'Multi-service planning', 'Long-term ministry rhythm'],
  },
];

const FAQS = [
  { q: 'Can a new church sign up right now?', a: 'New church signups are paused while this workspace focuses on the current church team.' },
  { q: 'How is the team size counted?', a: 'A "member" is anyone you invite into the workspace — leaders, musicians, vocalists, tech volunteers. Inactive members can be archived without removing their history.' },
  { q: 'Can we use ServeSync for multiple teams or campuses?', a: 'Yes. The Ministry plan supports multiple worship teams and parallel service planning. Each team gets its own schedules, setlists, and announcements.' },
  { q: 'Does ServeSync work on mobile?', a: 'Yes. The app is built mobile-first — musicians can check setlists, confirm availability, and see schedules from their phones.' },
  { q: 'What happens to our data if we cancel?', a: 'You can export your schedules, setlists, and member list at any time. After cancelling, your workspace is preserved read-only for 30 days before deletion.' },
  { q: 'Why peso pricing?', a: 'ServeSync is built and operated in the Philippines. We price for ministry budgets here. Card payments work internationally.' },
];

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [navigate, user]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-[#07101a] text-[#eef3f8] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* bg-field: faint grid + accent glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '88px 88px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 1200px 720px at 50% -60px, rgba(52,211,153,0.11) 0%, rgba(125,211,252,0.05) 55%, transparent 100%)' }}
      />

      <Nav onSignIn={() => navigate('/login')} />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 0 40px' }}>
        <Wrap>
          <div className="grid items-center gap-14 lg:gap-[56px]" style={{ gridTemplateColumns: 'min(100%, 1fr)', gridTemplateRows: 'auto auto' }}>
            {/* copy — full width on mobile, then split */}
            <div className="lg:hidden">
              <Eyebrow>Worship team workspace</Eyebrow>
              <h1 className="mt-4 font-black text-[#eef3f8] leading-[0.94] tracking-[-0.045em]" style={{ fontSize: 'clamp(44px, 10vw, 80px)' }}>
                Worship planning,{' '}
                <em className="not-italic" style={{ background: 'linear-gradient(180deg, #eef3f8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  finally calm.
                </em>
              </h1>
              <p className="mt-5 text-[16px] leading-[1.6] text-white/65 max-w-[520px]">
                Schedules, setlists, attendance and announcements in one place. Built for the way worship teams actually plan a week.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-7">
                <button onClick={() => navigate('/login')} className="h-[50px] px-6 rounded-full bg-emerald-400 text-[#07101a] text-sm font-bold hover:bg-emerald-300 transition-all hover:-translate-y-px flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate('/login')} className="h-[50px] px-6 rounded-full border border-white/[0.12] text-sm font-semibold text-white/75 hover:text-white hover:bg-white/[0.05] transition-all hover:-translate-y-px">
                  Sign in
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-5 mt-5">
                {['Private workspace', 'Invite-only access', 'Built for this team'].map(m => (
                  <span key={m} className="flex items-center gap-1.5 font-mono text-[11px] text-white/50">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* desktop 2-col */}
          <div className="hidden lg:grid items-center gap-[56px]" style={{ gridTemplateColumns: '1.05fr 0.95fr' }}>
            {/* left copy */}
            <div>
              <Eyebrow>Worship team workspace</Eyebrow>
              <h1 className="mt-4 font-black text-[#eef3f8] leading-[0.94] tracking-[-0.045em]" style={{ fontSize: 'clamp(48px, 7.6vw, 96px)' }}>
                Worship<br />planning,<br />
                <em className="not-italic" style={{ background: 'linear-gradient(180deg, #eef3f8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  finally calm.
                </em>
              </h1>
              <p className="mt-5 text-[17.5px] leading-[1.55] text-white/65 max-w-[520px]">
                Schedules, setlists, attendance and announcements in one place. Built for the way worship teams actually plan a week.
              </p>
              <div className="flex items-center gap-3 mt-7">
                <button onClick={() => navigate('/login')} className="h-[50px] px-6 rounded-full bg-emerald-400 text-[#07101a] text-sm font-bold hover:bg-emerald-300 transition-all hover:-translate-y-px flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate('/login')} className="h-[50px] px-6 rounded-full border border-white/[0.12] text-sm font-semibold text-white/75 hover:text-white hover:bg-white/[0.05] transition-all hover:-translate-y-px">
                  Sign in
                </button>
              </div>
              <div className="flex items-center gap-5 mt-5">
                {['Private workspace', 'Invite-only access', 'Built for this team'].map(m => (
                  <span key={m} className="flex items-center gap-1.5 font-mono text-[11px] text-white/50">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* right mock */}
            <div className="relative">
              <div
                className="rounded-[22px] border border-white/[0.09] overflow-visible"
                style={{ background: '#0e1a26', boxShadow: '0 30px 80px -48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                {/* chrome */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/20" />)}
                  </div>
                  <span className="font-mono text-[11px] text-white/40 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                    grace-city / this week
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-live" />
                    <span className="font-mono text-[10px] font-semibold text-emerald-400">LIVE</span>
                  </div>
                </div>
                {/* body */}
                <div className="p-4 space-y-3">
                  {/* service card */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <div className="shrink-0 rounded-lg bg-emerald-400/20 text-emerald-400 text-center px-2.5 py-1.5 min-w-[40px]">
                      <div className="font-mono text-[9px] font-semibold">Sun</div>
                      <div className="font-mono text-lg font-bold leading-none">12</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#eef3f8] truncate">Sunday Morning Service</div>
                      <div className="font-mono text-[10px] text-white/45 truncate">7:30 AM call · 9:00 service · 11:00 service</div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/25">
                      Ready
                    </span>
                  </div>
                  {/* 2-col panels */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* setlist */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                      <div className="font-mono text-[10px] text-white/40 mb-2.5">Setlist · 5 songs</div>
                      {[['01','Goodness of God','A'],['02','Build My Life','E'],['03','Way Maker','D'],['04','King of Kings','D'],['05','Doxology','G']].map(([n, s, k]) => (
                        <div key={n} className="flex items-center gap-1.5 py-[3px]">
                          <span className="font-mono text-[9px] text-white/28 w-4 shrink-0">{n}</span>
                          <span className="text-[11px] text-white/65 flex-1 truncate">{s}</span>
                          <span className="font-mono text-[9px] text-emerald-400 bg-emerald-400/15 px-1 py-px rounded shrink-0">{k}</span>
                        </div>
                      ))}
                    </div>
                    {/* roster */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                      <div className="font-mono text-[10px] text-white/40 mb-2.5">Team · 9 serving</div>
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {['MA','JR','PL','SD','KO'].map(av => (
                          <div key={av} className="h-[26px] w-[26px] rounded-full bg-[#1e3a2e] border border-emerald-400/25 text-emerald-400 font-mono text-[9px] font-semibold flex items-center justify-center">
                            {av}
                          </div>
                        ))}
                        <div className="h-[26px] w-[26px] rounded-full bg-white/[0.08] border border-white/[0.10] text-white/45 font-mono text-[9px] flex items-center justify-center">+4</div>
                      </div>
                      <div className="text-[10px] text-white/40 leading-5">Leader · <b className="text-white/60">Maria A.</b></div>
                      <div className="text-[10px] text-white/40 leading-5">Drums · <b className="text-emerald-400">Confirmed</b></div>
                      <div className="text-[10px] text-white/40 leading-5">Keys · <b className="text-white/45">Awaiting</b></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* float 1 */}
              <div
                className="absolute -top-5 -left-6 z-10 flex items-center gap-2.5 rounded-2xl border border-white/[0.09] px-3.5 py-2.5 animate-bob"
                style={{ background: '#0e1a26', backdropFilter: 'blur(12px)', boxShadow: '0 18px 48px -22px rgba(0,0,0,0.65)' }}
              >
                <div className="h-7 w-7 rounded-xl bg-emerald-400/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <BellRing className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#eef3f8]">2 new replies</div>
                  <div className="font-mono text-[10px] text-white/45">Setlist approved</div>
                </div>
              </div>

              {/* float 2 */}
              <div
                className="absolute -bottom-5 -right-5 z-10 flex items-center gap-2.5 rounded-2xl border border-white/[0.09] px-3.5 py-2.5 animate-bob-delayed"
                style={{ background: '#0e1a26', backdropFilter: 'blur(12px)', boxShadow: '0 18px 48px -22px rgba(0,0,0,0.65)' }}
              >
                <div className="h-7 w-7 rounded-xl bg-emerald-400/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Users2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#eef3f8]">18 active</div>
                  <div className="font-mono text-[10px] text-white/45">92% attendance</div>
                </div>
              </div>
            </div>
          </div>

          {/* mobile mock — shown below copy on small screens */}
          <div className="lg:hidden mt-2 relative">
            <div
              className="rounded-[22px] border border-white/[0.09] overflow-hidden"
              style={{ background: '#0e1a26', boxShadow: '0 30px 80px -48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/20" />)}
                </div>
                <span className="font-mono text-[11px] text-white/40 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                  grace-city / this week
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-live" />
                  <span className="font-mono text-[10px] font-semibold text-emerald-400">LIVE</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <div className="shrink-0 rounded-lg bg-emerald-400/20 text-emerald-400 text-center px-2.5 py-1.5 min-w-[40px]">
                    <div className="font-mono text-[9px] font-semibold">Sun</div>
                    <div className="font-mono text-lg font-bold leading-none">12</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#eef3f8] truncate">Sunday Morning Service</div>
                    <div className="font-mono text-[10px] text-white/45 truncate">7:30 AM · 9:00 · 11:00 service</div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/25">
                    Ready
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                    <div className="font-mono text-[10px] text-white/40 mb-2">Setlist · 5 songs</div>
                    {[['01','Goodness of God','A'],['02','Build My Life','E'],['03','Way Maker','D']].map(([n,s,k]) => (
                      <div key={n} className="flex items-center gap-1.5 py-[3px]">
                        <span className="font-mono text-[9px] text-white/28 w-4 shrink-0">{n}</span>
                        <span className="text-[11px] text-white/65 flex-1 truncate">{s}</span>
                        <span className="font-mono text-[9px] text-emerald-400 bg-emerald-400/15 px-1 rounded shrink-0">{k}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                    <div className="font-mono text-[10px] text-white/40 mb-2">Team · 9 serving</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {['MA','JR','PL','SD'].map(av => (
                        <div key={av} className="h-[24px] w-[24px] rounded-full bg-[#1e3a2e] border border-emerald-400/25 text-emerald-400 font-mono text-[8px] font-semibold flex items-center justify-center">
                          {av}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/40 leading-5">Drums · <b className="text-emerald-400">Confirmed</b></div>
                    <div className="text-[10px] text-white/40 leading-5">Keys · <b className="text-white/45">Awaiting</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Logo strip ─────────────────────────────────────────────── */}
      <Wrap className="border-t border-white/[0.07] py-7">
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/38 shrink-0">
            Used by worship teams in 40+ churches
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6">
            {['Grace City', 'Hope Chapel', 'Bridgepoint', 'Mosaic Manila', 'New Life'].map(name => (
              <span key={name} className="font-mono text-[12px] text-white/32">◦ {name}</span>
            ))}
          </div>
        </div>
      </Wrap>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '110px 0' }}>
        <Wrap>
          <div className="text-center mb-12">
            <Eyebrow>What changes</Eyebrow>
            <h2 className="mt-4 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(32px, 4.4vw, 56px)' }}>
              The weekly cadence<br />feels controlled again.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-white/60 max-w-[560px] mx-auto">
              ServeSync replaces the scattered chats, forgotten updates, and manual tracking with one weekly rhythm your team can actually follow.
            </p>
          </div>

          {/* hairline gap grid */}
          <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px">
              {FEATURES.map(f => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="relative bg-[#07101a] p-8 hover:bg-[#0e1a26] transition-colors duration-200 group"
                  >
                    <span className="absolute top-5 right-6 font-mono text-[11px] text-white/20">{f.n}</span>
                    <div className="h-[38px] w-[38px] rounded-[10px] bg-[rgba(52,211,153,0.14)] text-emerald-400 flex items-center justify-center mb-5">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <h3 className="text-[17px] font-semibold text-[#eef3f8] mb-2">{f.title}</h3>
                    <p className="text-[14px] leading-[1.6] text-white/55">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Walkthrough ─────────────────────────────────────────────── */}
      <section id="walkthrough" style={{ padding: '110px 0' }}>
        <Wrap>
          <div className="text-center mb-16">
            <Eyebrow>Inside the workspace</Eyebrow>
            <h2 className="mt-4 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(32px, 4.4vw, 56px)' }}>
              Three workflows.<br />One quiet week.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-white/60 max-w-[560px] mx-auto">
              The parts of ministry that usually take three apps, four spreadsheets, and a group chat — in one place.
            </p>
          </div>

          <div className="space-y-20">
            {WALK.map(w => (
              <div
                key={w.label}
                className={`grid items-center gap-12 lg:gap-16 ${w.flip ? 'lg:[grid-template-columns:1.05fr_1fr]' : 'lg:[grid-template-columns:1fr_1.05fr]'}`}
              >
                <div className={w.flip ? 'lg:order-2' : ''}>
                  <Eyebrow>{w.label}</Eyebrow>
                  <h3 className="mt-3 text-[20px] font-semibold text-[#eef3f8] leading-[1.3] tracking-[-0.02em]">{w.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.65] text-white/60">{w.body}</p>
                  <div className="mt-5 space-y-2.5">
                    {w.checks.map(c => (
                      <div key={c} className="flex items-center gap-2.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400 shrink-0">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        <span className="font-mono text-[12px] text-white/60">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`aspect-[4/3] ${w.flip ? 'lg:order-1' : ''}`}>
                  {w.visual}
                </div>
              </div>
            ))}
          </div>

          {/* photo strip */}
          <div className="mt-20 grid gap-3" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
            {[
              { tag: 'REAL PHOTO · WIDE', label: 'Worship team mid-rehearsal' },
              { tag: 'REAL PHOTO', label: 'Leader briefing the band' },
              { tag: 'REAL PHOTO', label: 'Sunday service — wide shot' },
            ].map(p => (
              <div
                key={p.label}
                className="relative rounded-[18px] overflow-hidden aspect-[4/3] flex items-end p-4"
                style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px), #0a1420' }}
              >
                <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/25 bg-white/[0.05] px-2 py-1 rounded-full">
                  {p.tag}
                </span>
                <span className="font-mono text-[10px] text-white/35">{p.label}</span>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how" style={{ padding: '110px 0' }}>
        <Wrap>
          <div className="text-center mb-12">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(32px, 4.4vw, 56px)' }}>
              Set up in an afternoon.<br />Run by Sunday.
            </h2>
          </div>

          <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px">
              {STEPS.map(s => (
                <div key={s.title} className="bg-[#07101a] hover:bg-[#0e1a26] transition-colors duration-200 p-8 flex flex-col">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400 mb-4">{s.n}</span>
                  <h3 className="text-[18px] font-semibold text-[#eef3f8] leading-[1.3] mb-3">{s.title}</h3>
                  <p className="text-[14px] leading-[1.65] text-white/55 flex-1">{s.body}</p>
                  <div className="mt-6 h-px w-7 bg-emerald-400/60" />
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '110px 0' }}>
        <Wrap>
          <div className="text-center mb-12">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(32px, 4.4vw, 56px)' }}>
              Honest plans.<br />Priced for ministries.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-white/60">
              New church signups are paused for now while ServeSync stays focused on the current church workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map(p => (
              <div
                key={p.name}
                className="relative flex flex-col rounded-[18px] p-6 overflow-hidden"
                style={p.feat ? {
                  background: 'linear-gradient(180deg, rgba(9,40,34,0.96) 0%, rgba(9,24,22,0.96) 100%)',
                  border: '1px solid rgba(52,211,153,0.30)',
                  boxShadow: '0 34px 100px -42px rgba(52,211,153,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
                } : {
                  background: 'linear-gradient(180deg, rgba(14,26,38,0.96) 0%, rgba(10,20,32,0.96) 100%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 30px 90px -48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {p.feat && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.12) 0%, transparent 100%)' }} />
                )}
                {p.feat && (
                  <span className="absolute top-4 right-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300 bg-emerald-400/15 px-2.5 py-1 rounded-full border border-emerald-400/25">
                    Popular
                  </span>
                )}
                <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-1.5">{p.name}</div>
                <div className="text-[13px] text-white/55 mb-5">{p.desc}</div>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="font-mono text-[44px] font-bold text-[#eef3f8] leading-none tracking-[-0.04em]">{p.price}</span>
                  <span className="font-mono text-[13px] text-white/40 mb-1">/ month</span>
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/38 mb-6">{p.seats}</div>
                <ul className="space-y-3 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400 shrink-0 mt-px">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="text-[13px] text-white/65">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full h-11 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-px ${
                    p.feat
                      ? 'bg-emerald-400 text-[#07101a] hover:bg-emerald-300'
                      : 'border border-white/[0.12] text-white/80 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  Sign in <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <div className="font-mono text-[11px] text-white/35 text-center mt-3">
                  Existing church access only
                </div>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: '110px 0' }}>
        <Wrap>
          <div className="max-w-[760px] mx-auto border-t border-white/[0.07] pt-12">
            <div className="text-center mb-10">
              <Eyebrow>Questions</Eyebrow>
              <h2 className="mt-4 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(32px, 4.4vw, 56px)' }}>
                Things worship leaders<br />usually ask first.
              </h2>
            </div>
            <div>
              {FAQS.map((f, i) => (
                <div key={f.q} className="border-b border-white/[0.07]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-[22px] text-left group"
                  >
                    <span className="text-[17px] font-medium text-[#eef3f8] group-hover:text-white transition-colors">{f.q}</span>
                    <span
                      className="h-6 w-6 rounded-full border border-white/[0.15] flex items-center justify-center shrink-0 transition-all duration-200"
                      style={openFaq === i ? { background: 'rgba(52,211,153,0.14)', borderColor: 'rgba(52,211,153,0.30)', color: '#34d399', transform: 'rotate(45deg)' } : { color: 'rgba(238,243,248,0.55)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  {openFaq === i && (
                    <p className="pb-6 text-[14.5px] leading-[1.7] text-white/60 max-w-[640px]">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section style={{ paddingBottom: '80px' }}>
        <Wrap>
          <div
            className="relative rounded-[28px] overflow-hidden px-8 py-16 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(14,26,38,0.98) 0%, rgba(7,16,26,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 30px 80px -48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* radial accent wash */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 900px 400px at 50% 0%, rgba(52,211,153,0.14) 0%, transparent 60%)' }} />
            {/* inner grid */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '88px 88px',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
                maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
              }}
            />
            <div className="relative z-10">
              <Eyebrow>Bring structure to your worship team</Eyebrow>
              <h2 className="mt-5 font-bold text-[#eef3f8] leading-[1.02] tracking-[-0.035em]" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
                Ready for a quieter<br />Sunday morning?
              </h2>
              <p className="mt-5 text-[16px] leading-[1.6] text-white/60 max-w-[480px] mx-auto">
                Sign in to your church workspace, plan your next service, and keep the team moving in one place.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                <button onClick={() => navigate('/login')} className="h-[50px] px-7 rounded-full bg-emerald-400 text-[#07101a] text-sm font-bold hover:bg-emerald-300 transition-all hover:-translate-y-px flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate('/login')} className="h-[50px] px-7 rounded-full border border-white/[0.12] text-sm font-semibold text-white/75 hover:text-white hover:bg-white/[0.05] transition-all hover:-translate-y-px">
                  Sign in
                </button>
              </div>
              <div className="font-mono text-[11px] text-white/35 mt-5">Invite-only access for the current church team</div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07]">
        <Wrap className="py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-[7px] bg-white flex items-center justify-center shrink-0">
                <Music2 className="h-3.5 w-3.5 text-[#07101a]" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#eef3f8]">ServeSync</div>
                <div className="font-mono text-[10px] text-white/35">© 2026 · Worship team workspace</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-[13px] text-white/50">
              <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Sign in</button>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="mailto:hello@servesync.app" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
