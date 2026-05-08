import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Music2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast('error', error.message);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden">

      {/* ── LEFT PANEL (decorative, desktop only) ───────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden self-stretch"
        style={{ background: 'linear-gradient(160deg, #0a1a0a 0%, #0d1f0d 40%, #071407 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.08] blur-[90px]" />
          <div className="absolute bottom-[-5%] left-[-8%] w-[400px] h-[400px] rounded-full bg-emerald-400/[0.06] blur-[80px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[22%] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(145deg, #1e3a1e 0%, #0d1a0d 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)' }}
          >
            <Music2 className="text-emerald-400" style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white leading-tight tracking-tight">MCJC Worship</p>
            <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-widest leading-tight">Team Portal</p>
          </div>
        </div>

        <div className="relative">
          <p className="text-[11px] font-bold tracking-widest text-emerald-500/60 uppercase mb-4">Ministry Platform</p>
          <h2
            className="text-[clamp(2rem,3.5vw,3.2rem)] font-bold text-white leading-[1.1] tracking-[-0.03em] mb-6"
          >
            Serve together,<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              stay organized.
            </span>
          </h2>
          <p className="text-[15px] text-gray-400 leading-relaxed max-w-sm mb-10">
            Events, assignments, setlists, and team communication — all in one place for your worship ministry.
          </p>

          <div className="space-y-3">
            {[
              'Real-time event assignments & confirmations',
              'Setlist planning with leader approval workflow',
              'Push notifications for every update',
            ].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-sm text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-gray-600">
            Built for ministry teams that take excellence seriously.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (form) ───────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0a0a0a]">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-2.5 px-6 pt-14 pb-2">
          <div
            className="h-8 w-8 rounded-[22%] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <Music2 className="text-emerald-400" style={{ width: '16px', height: '16px' }} />
          </div>
          <span className="text-[14px] font-bold text-gray-900 dark:text-white tracking-tight">MCJC Worship</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-12">
          <div className="w-full max-w-[360px]">

            <div className="mb-9">
              <h1 className="text-[26px] sm:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-[14px] text-gray-400 dark:text-gray-500 leading-relaxed">
                Sign in to your MCJC Worship account to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl text-[14px] bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 dark:focus:border-emerald-500/40 transition-all"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-12 rounded-xl text-[14px] bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 dark:focus:border-emerald-500/40 transition-all"
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: loading || !email || !password
                      ? undefined
                      : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    backgroundColor: loading || !email || !password ? '#d1d5db' : undefined,
                    color: 'white',
                    boxShadow: loading || !email || !password ? 'none' : '0 4px 14px rgba(22,163,74,0.35)',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-7 pt-6 border-t border-gray-100 dark:border-white/[0.06]">
              <p className="text-center text-[13px] text-gray-400 dark:text-gray-500">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  Request access
                </Link>
              </p>
            </div>

          </div>
        </div>

        <p className="text-center py-5 text-[11px] text-gray-300 dark:text-gray-700 lg:hidden">
          MCJC Worship — Built for ministry teams
        </p>
      </div>

    </div>
  );
}
