import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music2, Calendar, Users, Bell, BookOpen, Shield, ArrowRight,
  CheckCircle, Mic2, Guitar, Layers, ChevronDown, Music
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const features = [
  { icon: Calendar, title: 'Event Management', desc: 'Organize services, assign members, and track confirmations in real time.', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
  { icon: Users, title: 'Team Coordination', desc: 'Manage roles, availability, and member preferences across departments.', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50' },
  { icon: Music, title: 'Setlist Planning', desc: 'Build and submit setlists for approval with keys and YouTube references.', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
  { icon: Bell, title: 'Push Notifications', desc: 'Real-time alerts for assignments, approvals, and announcements.', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' },
  { icon: BookOpen, title: 'Media Library', desc: 'Organize reference videos and worship materials in one searchable place.', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50' },
  { icon: Shield, title: 'Role-Based Access', desc: 'Leaders, directors, and members each see exactly what they need.', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50' },
];

const roles = [
  { icon: Mic2, name: 'Vocalists', count: 'Lead & backup singers' },
  { icon: Guitar, name: 'Instrumentalists', count: 'Keys, guitar, bass, drums' },
  { icon: Layers, name: 'Production', count: 'Sound, lights, and tech' },
  { icon: Users, name: 'Leadership', count: 'Directors and section leads' },
];

const faqs = [
  { q: 'Who can join the portal?', a: 'Worship Portal is for ministry team members. Access is provided by your worship director or admin.' },
  { q: 'Is this available on mobile?', a: 'Yes. The portal is fully mobile-responsive and can be installed as a PWA on iOS and Android directly from your browser.' },
  { q: 'How do event assignments work?', a: 'Admins assign roles per event. Members receive a push notification and can confirm or decline directly in the app.' },
  { q: 'Can I manage my own availability?', a: 'Yes. Members can submit unavailability requests which are reviewed and approved by the production director.' },
  { q: 'What about setlists?', a: 'Worship leaders build setlists linked to events, submit for approval, and include song keys and YouTube references.' },
];

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] overflow-x-hidden text-gray-900 dark:text-white">

      {/* ── NAV ─────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]'
            : ''
        }`}
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 sm:px-8 h-[60px]">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-[22%] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0a0908 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
            >
              <Music2 className="text-emerald-400" style={{ width: '16px', height: '16px' }} />
            </div>
            <span className="text-[15px] font-bold tracking-tight">MCJC Worship</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
            >
              Join Team
            </button>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO ────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col justify-center pt-[60px]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[10%] right-[-4%] w-[560px] h-[560px] rounded-full bg-emerald-400/[0.07] dark:bg-emerald-500/[0.05] blur-[80px]" />
            <div className="absolute bottom-[12%] left-[-6%] w-[400px] h-[400px] rounded-full bg-emerald-300/[0.06] dark:bg-emerald-600/[0.04] blur-[70px]" />
          </div>

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-24 sm:py-32">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 mb-8"
              style={{ opacity: 0, animation: 'fadeSlideIn 0.6s ease 0.1s forwards' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Worship Team Portal
            </div>

            <h1
              className="text-[clamp(2.6rem,7vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.04] max-w-3xl"
              style={{ opacity: 0, animation: 'fadeSlideIn 0.65s ease 0.18s forwards' }}
            >
              Serve together,{' '}
              <br className="hidden sm:block" />
              <span
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                stay organized.
              </span>
            </h1>

            <p
              className="mt-6 text-[1.05rem] sm:text-[1.15rem] text-gray-500 dark:text-gray-400 max-w-xl leading-[1.65]"
              style={{ opacity: 0, animation: 'fadeSlideIn 0.65s ease 0.28s forwards' }}
            >
              A purpose-built management portal for worship teams. Events, assignments,
              setlists, leave requests, and team communication — in one clean app.
            </p>

            <div
              className="mt-10 flex flex-col sm:flex-row gap-3"
              style={{ opacity: 0, animation: 'fadeSlideIn 0.65s ease 0.38s forwards' }}
            >
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-[15px] font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-all active:scale-[0.98] shadow-lg shadow-black/10 w-full sm:w-auto"
              >
                Request Access <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-[15px] font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-all active:scale-[0.98] w-full sm:w-auto"
              >
                Sign In to Portal
              </button>
            </div>

            <div
              className="mt-12 flex flex-col sm:flex-row gap-4 sm:gap-8"
              style={{ opacity: 0, animation: 'fadeSlideIn 0.65s ease 0.48s forwards' }}
            >
              {['PWA — install on any device', 'Real-time notifications', 'Role-based access control'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 text-gray-300 dark:text-gray-600 animate-bounce">
            <ChevronDown className="h-5 w-5" />
          </div>
        </section>

        {/* ── STATS ───────────────────────────────────────── */}
        <section className="border-y border-black/[0.05] dark:border-white/[0.05] bg-gray-50/60 dark:bg-[#111113] py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="grid grid-cols-3 gap-6 sm:gap-10 text-center">
              {[
                { num: '100+', label: 'Team Members' },
                { num: '50+', label: 'Monthly Events' },
                { num: '200+', label: 'Songs in Library' },
              ].map((s, i) => (
                <Reveal key={s.label} delay={i * 80}>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{s.num}</p>
                  <p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500 font-medium">{s.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="max-w-xl mb-16">
              <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-500 uppercase mb-3">Features</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Everything your team needs in one place
              </h2>
              <p className="mt-4 text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Designed for real worship teams — from assignment tracking to setlist approval.
              </p>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100 dark:bg-white/[0.05] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/[0.05]">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 50}>
                  <div className="bg-white dark:bg-[#0f0f0f] p-7 h-full group hover:bg-gray-50 dark:hover:bg-[#141414] transition-colors">
                    <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${f.bg} ${f.color} mb-5`}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[15px] font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROLES ───────────────────────────────────────── */}
        <section className="py-24 sm:py-32 bg-gray-50/60 dark:bg-[#111113]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-500 uppercase mb-3">Ministry Roles</p>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-5">
                  A place for every role in your ministry
                </h2>
                <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
                  Whether you're a vocalist, instrumentalist, sound tech, or worship leader —
                  the portal gives each role exactly the tools they need.
                </p>
                <button
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-md shadow-emerald-600/20"
                >
                  Join the team <ArrowRight className="h-4 w-4" />
                </button>
              </Reveal>

              <div className="grid grid-cols-2 gap-4">
                {roles.map((role, i) => (
                  <Reveal key={role.name} delay={i * 70}>
                    <div className="bg-white dark:bg-[#181818] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                        <role.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold">{role.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{role.count}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <Reveal className="text-center mb-16">
              <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-500 uppercase mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Up and running in minutes</h2>
            </Reveal>

            <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 relative">
              <div className="hidden sm:block absolute top-9 left-[calc(16.7%+20px)] right-[calc(16.7%+20px)] h-px bg-gray-200 dark:bg-white/[0.07]" />
              {[
                { step: '01', title: 'Request access', desc: 'Create your account and your admin approves your role.' },
                { step: '02', title: 'Get assigned', desc: 'Leaders add you to events. You receive an instant notification.' },
                { step: '03', title: 'Confirm & serve', desc: 'Confirm your slot, check setlists, and show up prepared.' },
              ].map((s, i) => (
                <Reveal key={s.step} delay={i * 100} className="relative">
                  <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-600 text-white text-sm font-bold mb-5 relative z-10">
                      {s.step}
                    </div>
                    <h3 className="text-[15px] font-semibold mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────── */}
        <section className="py-24 sm:py-32 bg-gray-50/60 dark:bg-[#111113]">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <Reveal className="text-center mb-14">
              <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-500 uppercase mb-3">FAQ</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Common questions</h2>
            </Reveal>

            <div className="divide-y divide-gray-100 dark:divide-white/[0.06] border border-gray-100 dark:border-white/[0.06] rounded-2xl overflow-hidden bg-white dark:bg-[#141414]">
              {faqs.map((faq, i) => (
                <Reveal key={i} delay={i * 40}>
                  <div>
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-[15px] font-medium pr-4">{faq.q}</span>
                      <ChevronDown
                        className="h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200"
                        style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)' }}
                      />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ maxHeight: openFaq === i ? '140px' : '0' }}
                    >
                      <p className="px-6 pb-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-5 sm:px-8 text-center">
            <Reveal>
              <div
                className="relative rounded-3xl overflow-hidden px-8 sm:px-16 py-16 sm:py-20"
                style={{ background: 'linear-gradient(135deg, #0d1f0d 0%, #0f1a0f 60%, #141c14 100%)' }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-[-20%] right-[-10%] w-64 h-64 rounded-full bg-emerald-500/[0.12] blur-[60px]" />
                  <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 rounded-full bg-emerald-400/[0.08] blur-[50px]" />
                </div>

                <div className="relative">
                  <p className="text-xs font-bold tracking-widest text-emerald-500 uppercase mb-4">Get Started</p>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
                    Ready to serve with your team?
                  </h2>
                  <p className="text-[15px] text-gray-400 max-w-md mx-auto leading-relaxed mb-10">
                    Join the MCJC Worship portal. Create your account and your admin will activate your role.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => navigate('/register')}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-[15px] font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25"
                    >
                      Create Account <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-[15px] font-semibold text-white/80 border border-white/[0.12] hover:bg-white/[0.07] transition-all active:scale-[0.98]"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-black/[0.05] dark:border-white/[0.05] bg-white dark:bg-[#0a0a0a] py-10">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-[22%] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0a0908 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
            >
              <Music2 className="text-emerald-400" style={{ width: '14px', height: '14px' }} />
            </div>
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">MCJC Worship</span>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
            Built for ministry teams that take excellence seriously.
          </p>
          <div className="flex items-center gap-5 text-sm text-gray-400">
            <button onClick={() => navigate('/login')} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Sign In</button>
            <button onClick={() => navigate('/register')} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Join Team</button>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
