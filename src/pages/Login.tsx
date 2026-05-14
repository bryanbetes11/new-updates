import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ChevronLeft, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { isPasswordRecoveryUrl, recoveryRedirectPath } from '../lib/authRedirect';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isRecoveryLink = isPasswordRecoveryUrl(location.search, location.hash);
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/dashboard';
  const prefillEmail = params.get('email') || '';
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isRecoveryLink) {
      navigate(recoveryRedirectPath(location.search, location.hash), { replace: true });
      return;
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
      setForgotEmail(prefillEmail);
    }
    if (user) navigate(redirectTo, { replace: true });
  }, [isRecoveryLink, location.hash, location.search, navigate, user, redirectTo, prefillEmail]);

  if (user || isRecoveryLink) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast('error', error.message);
    } else {
      navigate(redirectTo);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast('error', 'Failed to send reset email. Please try again.');
    } else {
      setForgotSent(true);
    }
  };

  const inputClass = `w-full h-12 px-4 rounded-xl text-[14px]
    bg-gray-50 dark:bg-white/[0.05]
    border border-gray-200 dark:border-white/[0.08]
    text-gray-900 dark:text-white
    placeholder-gray-400 dark:placeholder-white/20
    focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50
    transition-all duration-200`;

  return (
    <div className="min-h-screen flex overflow-x-hidden bg-[#f5f5f7] dark:bg-[#0d0d0f] transition-colors duration-300">

      {/* Theme toggle — fixed top-right, always visible */}
      <div className="fixed top-4 right-4 z-30">
        <div className="bg-white/90 dark:bg-white/[0.07] backdrop-blur-md rounded-xl border border-gray-200/70 dark:border-white/[0.09] shadow-sm transition-colors duration-300">
          <ThemeToggle />
        </div>
      </div>

      {/* ── LEFT PANEL (desktop only) ────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden self-stretch transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(160deg, #0a1a0a 0%, #0d2010 40%, #071407 100%)'
            : 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 50%, #f7fef9 100%)',
        }}
      >
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[90px] transition-all duration-500"
            style={{ background: isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.22)' }}
          />
          <div
            className="absolute bottom-[-5%] left-[-8%] w-[400px] h-[400px] rounded-full blur-[80px] transition-all duration-500"
            style={{ background: isDark ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.18)' }}
          />
        </div>

        {/* Logo mark */}
        <div className="relative flex items-center gap-3">
          <img
            src="/servesync-logo-new.png"
            alt="ServeSync"
            className="h-9 w-9 rounded-[22%] shrink-0 shadow-md shadow-black/20 dark:shadow-black/40"
          />
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight tracking-tight transition-colors duration-300">ServeSync</p>
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500/70 uppercase tracking-widest leading-tight transition-colors duration-300">Team Portal</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative">
          <p className="text-[11px] font-bold tracking-widest text-emerald-600 dark:text-emerald-500/60 uppercase mb-4 transition-colors duration-300">
            Ministry Platform
          </p>
          <h2 className="text-[clamp(2rem,3.5vw,3.2rem)] font-bold text-gray-900 dark:text-white leading-[1.1] tracking-[-0.03em] mb-6 transition-colors duration-300">
            Serve together,<br />
            <span
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #16a34a 0%, #166534 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              stay organized.
            </span>
          </h2>
          <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mb-10 transition-colors duration-300">
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
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative">
          <p className="text-xs text-gray-400 dark:text-gray-600 transition-colors duration-300">
            Built for ministry teams that take excellence seriously.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (form) ────────────────────────────── */}
      <div className="flex-1 flex flex-col">

        {/* Mobile logo bar */}
        <div className="lg:hidden flex items-center gap-2.5 px-6 pt-14 pb-2">
          <img
            src="/servesync-logo-new.png"
            alt="ServeSync"
            className="h-8 w-8 rounded-[22%] shrink-0 shadow-sm shadow-black/10 dark:shadow-black/30"
          />
          <span className="text-[14px] font-bold text-gray-900 dark:text-white tracking-tight transition-colors duration-300">
            ServeSync
          </span>
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-12 overflow-hidden">
          <div className="w-full max-w-[380px]">

            {/* Card */}
            <div className="relative bg-white dark:bg-white/[0.025] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors duration-300">
              {/* Top-edge luminous highlight */}
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.12] to-transparent" />

              <AnimatePresence mode="wait">

                {/* ── SIGN IN VIEW ── */}
                {view === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-8">
                      <h1 className="text-[26px] sm:text-[28px] font-bold text-gray-900 dark:text-white tracking-[-0.025em] leading-tight transition-colors duration-300">
                        Welcome back
                      </h1>
                      <p className="mt-2 text-[14px] text-gray-500 dark:text-white/35 leading-relaxed transition-colors duration-300">
                        Sign in to your ServeSync account to continue.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                          Email address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className={inputClass}
                          placeholder="you@example.com"
                          autoComplete="email"
                          required
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] transition-colors duration-300">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => { setView('forgot'); setForgotEmail(email); }}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPw ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className={`${inputClass} pr-12`}
                            placeholder="Your password"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(!showPw)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
                          >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={loading || !email || !password}
                          className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                        >
                          {loading
                            ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                            : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      </div>
                    </form>

                    <div className="mt-7 pt-6 border-t border-gray-100 dark:border-white/[0.06] transition-colors duration-300">
                      {!params.get('email') ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-gray-400 dark:text-white/25 uppercase tracking-widest text-center mb-3 transition-colors duration-300">
                            New here?
                          </p>
                          {/* Info row — not clickable */}
                          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.04] transition-colors duration-300">
                            <div className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 transition-colors duration-300">
                              <Users className="h-3.5 w-3.5 text-gray-400 dark:text-white/30" />
                            </div>
                            <p className="text-[13px] text-gray-500 dark:text-white/30 transition-colors duration-300">
                              Ask your church admin for an invite
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-[13px] text-gray-400 dark:text-white/30 transition-colors duration-300">
                          Don&apos;t have an account?{' '}
                          <Link
                            to={`/register${location.search}`}
                            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                          >
                            Create one
                          </Link>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── FORGOT PASSWORD VIEW ── */}
                {view === 'forgot' && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <button
                      onClick={() => { setView('login'); setForgotSent(false); }}
                      className="flex items-center gap-1 text-[13px] font-medium text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition-colors mb-8"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back to sign in
                    </button>

                    {forgotSent ? (
                      <div>
                        <div className="mb-6 h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                          <svg className="h-7 w-7 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        </div>
                        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white tracking-[-0.025em] mb-3 transition-colors duration-300">
                          Check your email
                        </h1>
                        <p className="text-[14px] text-gray-500 dark:text-white/35 leading-relaxed mb-2 transition-colors duration-300">
                          We sent a password reset link to:
                        </p>
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white mb-6 transition-colors duration-300">
                          {forgotEmail}
                        </p>
                        <p className="text-[13px] text-gray-400 dark:text-white/25 leading-relaxed transition-colors duration-300">
                          Click the link in the email to set a new password. Check your spam folder if you don&apos;t see it.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-9">
                          <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-[-0.025em] leading-tight transition-colors duration-300">
                            Forgot password?
                          </h1>
                          <p className="mt-2 text-[14px] text-gray-500 dark:text-white/35 leading-relaxed transition-colors duration-300">
                            Enter your email and we&apos;ll send you a reset link.
                          </p>
                        </div>

                        <form onSubmit={handleForgot} className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                              Email address
                            </label>
                            <input
                              type="email"
                              value={forgotEmail}
                              onChange={e => setForgotEmail(e.target.value)}
                              className={inputClass}
                              placeholder="you@example.com"
                              autoComplete="email"
                              required
                            />
                          </div>
                          <div className="pt-1">
                            <button
                              type="submit"
                              disabled={forgotLoading || !forgotEmail}
                              className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                            >
                              {forgotLoading
                                ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                                : <>Send Reset Link <ArrowRight className="h-4 w-4" /></>}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>

        <p className="text-center py-5 text-[11px] text-gray-400 dark:text-white/20 lg:hidden transition-colors duration-300">
          ServeSync — Built for ministry teams
        </p>
      </div>

    </div>
  );
}
