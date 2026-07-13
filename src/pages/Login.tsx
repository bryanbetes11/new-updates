import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, KeyRound, Mail, RefreshCw, Trash2, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isPasswordRecoveryUrl, recoveryRedirectPath } from '../lib/authRedirect';

type LoginView = 'login' | 'account';
type AccountUpdateMode = 'password' | 'email';

const inputClass = `w-full h-12 px-4 rounded-2xl text-[14px]
  bg-white/[0.055]
  border border-white/[0.09]
  text-white
  placeholder-white/24
  focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:border-emerald-400/50
  transition-all duration-200`;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');
  const [accountUpdateMode, setAccountUpdateMode] = useState<AccountUpdateMode>('password');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const { signIn, user, savedAccounts, switchAccount, forgetSavedAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isRecoveryLink = isPasswordRecoveryUrl(location.search, location.hash);
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/dashboard';
  const prefillEmail = params.get('email') || '';
  const inviteCreateAccountLink = `/register${location.search}`;

  const getLoginErrorMessage = (error: Error & { code?: string }) => {
    const message = error.message || 'Unable to sign in. Please try again.';
    const isInvalidCredentials =
      error.code === 'invalid_credentials' ||
      message.toLowerCase().includes('invalid login credentials');

    if (!isInvalidCredentials) return message;

    if (params.get('email')) {
      return 'Invalid email or password. If this is your first time using ServeSync, use Create Account from the invite link first.';
    }

    return 'Invalid email or password. Try again or use Update my account to reset it.';
  };

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

  const openAccountUpdate = () => {
    setView('account');
    setAccountUpdateMode('password');
    setForgotEmail(email);
    setForgotSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast('error', getLoginErrorMessage(error));
    } else {
      navigate(redirectTo);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);

    if (error) {
      toast('error', 'Failed to send reset email. Please try again.');
    } else {
      setForgotSent(true);
    }
  };

  const handleQuickSwitch = async (targetUserId: string) => {
    setSwitchingAccountId(targetUserId);
    const { error } = await switchAccount(targetUserId);
    setSwitchingAccountId(null);

    if (error) toast('error', error.message);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(250,204,21,0.08),transparent_28%),linear-gradient(180deg,#090b09_0%,#050505_48%,#000_100%)]" />

      <aside className="fixed inset-y-0 left-0 hidden w-[48%] max-w-[740px] flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[linear-gradient(160deg,rgba(16,185,129,0.12)_0%,rgba(255,255,255,0.035)_42%,rgba(0,0,0,0)_100%)] p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-emerald-500/10 blur-[80px]" />
          <div className="absolute bottom-[-10%] right-[-8%] h-[28rem] w-[28rem] rounded-full bg-emerald-300/[0.055] blur-[90px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="ServeSync" className="h-12 w-12 shrink-0 rounded-2xl bg-black/40 object-contain p-2 shadow-[0_18px_40px_-24px_rgba(34,197,94,0.8)]" />
          <div>
            <p className="text-[18px] font-black leading-tight tracking-[-0.04em] text-white">ServeSync</p>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] leading-tight text-emerald-300/70">Team Portal</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h2 className="text-[clamp(3.6rem,6vw,6rem)] font-black leading-[0.88] tracking-[-0.085em] text-white">
            Serve<br />
            in sync.
          </h2>
          <p className="mt-7 max-w-md text-[17px] leading-8 text-white/45">
            One focused workspace for the weekly rhythm of worship ministry.
          </p>

          <div className="mt-10 grid max-w-md gap-2">
            {['Assignments', 'Setlists', 'Team updates'].map(item => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                <span className="text-sm font-bold text-white/70">{item}</span>
                <div className="ml-auto h-px w-10 bg-gradient-to-r from-emerald-400/50 to-transparent" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3 text-xs font-bold text-white/28">
          <span className="h-px w-10 bg-white/15" />
          Built for ministry teams
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col lg:ml-[48%]">
        <div className="flex items-center gap-3 px-6 pt-14 pb-2 lg:hidden">
          <img src="/logo.png" alt="ServeSync" className="h-12 w-12 shrink-0 rounded-2xl bg-black/40 object-contain p-2" />
          <span className="text-[26px] font-black tracking-[-0.055em] text-white">ServeSync</span>
        </div>

        <div className="flex flex-1 items-start justify-center px-6 py-6 sm:items-center sm:px-10 sm:py-10 lg:px-16">
          <div className="w-full max-w-[430px]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_30px_90px_-60px_rgba(34,197,94,0.7)] backdrop-blur-xl transition-colors duration-300 sm:p-8">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-400/[0.06] blur-[70px]" />

              <AnimatePresence mode="wait">
                {view === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    <div className="mb-8">
                      <h1 className="text-[2.45rem] font-black leading-[0.98] tracking-[-0.07em] text-white sm:text-[2.75rem]">
                        Welcome back
                      </h1>
                      <p className="mt-3 text-[14px] leading-6 text-white/42">
                        Sign in to continue your ServeSync workspace.
                      </p>
                    </div>

                    {savedAccounts.length > 0 && (
                      <div className="mb-6 rounded-3xl border border-white/[0.08] bg-black/20 p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Saved on this device</p>
                        <div className="mt-3 space-y-2">
                          {savedAccounts.map(account => {
                            const isSwitching = switchingAccountId === account.userId;

                            return (
                              <div key={account.userId} className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-2">
                                <button type="button" onClick={() => handleQuickSwitch(account.userId)} disabled={isSwitching} className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-[12px] font-black text-emerald-300">
                                    {(account.displayName || account.email || '?').slice(0, 1).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold text-white">{account.displayName}</p>
                                    <p className="truncate text-[11px] font-mono text-white/34">{account.email}</p>
                                  </div>
                                  <RefreshCw className={`h-3.5 w-3.5 shrink-0 text-emerald-300 ${isSwitching ? 'animate-spin' : ''}`} />
                                </button>

                                <button type="button" onClick={() => forgetSavedAccount(account.userId)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300" title="Forget saved account" aria-label={`Forget ${account.displayName || account.email}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="login-email" className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/34">Email address</label>
                        <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" required />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label htmlFor="login-password" className="block text-[11px] font-black uppercase tracking-[0.16em] text-white/34">Password</label>
                          <button type="button" onClick={openAccountUpdate} className="text-[11px] font-bold text-emerald-300 transition-colors hover:text-emerald-200">
                            Update my account
                          </button>
                        </div>
                        <div className="relative">
                          <input id="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} placeholder="Your password" autoComplete="current-password" required />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/30 transition-colors hover:text-white/60" aria-label={showPw ? 'Hide password' : 'Show password'}>
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button type="submit" disabled={loading || !email || !password} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-[14px] font-black text-black shadow-[0_18px_50px_-24px_rgba(34,197,94,0.9)] transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                        {loading ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />Signing in...</> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                      </button>
                    </form>

                    <div className="mt-7 border-t border-white/[0.07] pt-6">
                      {!params.get('email') ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-3.5 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                            <Users className="h-3.5 w-3.5 text-white/36" />
                          </div>
                          <p className="text-[13px] font-semibold text-white/38">Ask your church admin for an invite</p>
                        </div>
                      ) : (
                        <p className="text-center text-[13px] text-white/34">
                          Don&apos;t have an account?{' '}
                          <Link to={inviteCreateAccountLink} className="font-bold text-emerald-300 transition-colors hover:text-emerald-200">
                            Create one
                          </Link>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {view === 'account' && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    <button type="button" onClick={() => { setView('login'); setForgotSent(false); }} className="mb-6 flex min-h-11 items-center gap-1 text-[13px] font-bold text-white/38 transition-colors hover:text-white/70">
                      <ChevronLeft className="h-4 w-4" /> Back to sign in
                    </button>

                    {forgotSent ? (
                      <div>
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                          <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <h1 className="mb-3 text-[2rem] font-black leading-none tracking-[-0.065em] text-white">Check your email</h1>
                        <p className="mb-2 text-[14px] leading-6 text-white/42">We sent an account update link to:</p>
                        <p className="mb-6 break-all text-[14px] font-bold text-white">{forgotEmail}</p>
                        <p className="text-[13px] leading-6 text-white/30">Click the link in the email to set a new password. Check your spam folder if you don&apos;t see it.</p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-8">
                          <h1 className="text-[2.25rem] font-black leading-[0.98] tracking-[-0.07em] text-white">Update my account</h1>
                          <p className="mt-3 text-[14px] leading-6 text-white/42">
                            Reset your password by email, or sign in first to securely change the email on your account.
                          </p>
                        </div>

                        <div className="mb-5 grid gap-3">
                          <button type="button" onClick={() => setAccountUpdateMode('password')} className={`w-full rounded-3xl border p-4 text-left transition-all active:scale-[0.99] ${accountUpdateMode === 'password' ? 'border-emerald-500/40 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]' : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.16] hover:bg-white/[0.055]'}`} aria-pressed={accountUpdateMode === 'password'}>
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-300"><KeyRound className="h-5 w-5" /></span>
                              <div>
                                <p className="text-[14px] font-black text-white">Update password</p>
                                <p className="mt-1 text-[12px] text-white/36">We will email a secure reset link.</p>
                              </div>
                            </div>
                          </button>

                          <button type="button" onClick={() => setAccountUpdateMode('email')} className={`w-full rounded-3xl border p-4 text-left transition-all active:scale-[0.99] ${accountUpdateMode === 'email' ? 'border-emerald-500/40 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]' : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.16] hover:bg-white/[0.055]'}`} aria-pressed={accountUpdateMode === 'email'}>
                            <div className="flex items-start gap-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accountUpdateMode === 'email' ? 'bg-emerald-500/14 text-emerald-300' : 'bg-white/[0.06] text-white/45'}`}><Mail className="h-5 w-5" /></span>
                              <div>
                                <p className="text-[14px] font-black text-white">Update email address</p>
                                <p className="mt-1 text-[12px] leading-5 text-white/36">
                                  Sign in first, then open Profile and choose Email. We will send a confirmation email to your new address.
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>

                        {accountUpdateMode === 'password' ? (
                          <form onSubmit={handleForgot} className="space-y-4">
                            <div>
                              <label htmlFor="account-update-email" className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/34">Email address</label>
                              <input id="account-update-email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" required />
                            </div>
                            <button type="submit" disabled={forgotLoading || !forgotEmail} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-[14px] font-black text-black transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                              {forgotLoading ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />Sending...</> : <>Send Password Email <ArrowRight className="h-4 w-4" /></>}
                            </button>
                          </form>
                        ) : (
                          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4">
                            <p className="text-[13px] font-bold text-white">Email changes happen inside Profile.</p>
                            <p className="mt-1 text-[12px] leading-5 text-white/36">
                              This protects the account from someone changing the login email without already being signed in.
                            </p>
                            <button type="button" onClick={() => { setView('login'); setForgotSent(false); }} className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-[13px] font-black text-black transition hover:bg-white/90">
                              Back to sign in
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <p className="pb-5 text-center text-[11px] text-white/20 lg:hidden">ServeSync - Built for ministry teams</p>
      </main>
    </div>
  );
}
