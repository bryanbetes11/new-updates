import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Music2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

const requirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
];

type Status = 'checking' | 'ready' | 'expired' | 'success';
type ResetLinkType = 'recovery' | 'magiclink';

function getResetLinkType(type: string | null): ResetLinkType {
  return type === 'magiclink' ? 'magiclink' : 'recovery';
}

export function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Detect recovery token from PKCE (?code=), OTP token_hash, and implicit (#type=recovery) flows
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
    const type = searchParams.get('type') || hashParams.get('type');
    const hasImplicitToken = hashParams.has('access_token') || hashParams.has('refresh_token');
    const isRecoveryFlow = Boolean(code || tokenHash || hasImplicitToken || type === 'recovery' || type === 'magiclink');

    const markStatus = (nextStatus: Status) => {
      if (!cancelled) setStatus(nextStatus);
    };

    // Listen for Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markStatus('ready');
        return;
      }
      // PKCE, token hash, and magic-link flows can fire SIGNED_IN after exchange.
      if (event === 'SIGNED_IN' && session && isRecoveryFlow) {
        markStatus('ready');
        return;
      }
    });

    const verifyResetLink = async () => {
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error && data.session) {
          markStatus('ready');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        markStatus(session ? 'ready' : 'expired');
        return;
      }

      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: getResetLinkType(type),
        });
        if (!cancelled && !error && data.session) {
          markStatus('ready');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        markStatus(session ? 'ready' : 'expired');
        return;
      }

      if (!isRecoveryFlow) {
        const { data: { session } } = await supabase.auth.getSession();
        markStatus(session ? 'ready' : 'expired');
        return;
      }

      window.setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        markStatus(session ? 'ready' : 'expired');
      }, 1200);
    };

    void verifyResetLink();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const passwordOk = requirements.every(r => r.test(password));
  const confirmOk = password === confirm && confirm.length > 0;
  const canSubmit = passwordOk && confirmOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast('error', error.message || 'Failed to update password.');
    } else {
      setStatus('success');
      // Sign out and redirect to login after a brief moment
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 2500);
    }
  };

  // ── Checking / loading ────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070709]">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-white/30">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden bg-[#070709]">

      {/* Left decorative panel */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a1a0a 0%, #0d2010 40%, #071407 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.08] blur-[90px]" />
          <div className="absolute bottom-[-5%] left-[-8%] w-[400px] h-[400px] rounded-full bg-emerald-400/[0.06] blur-[80px]" />
        </div>
        <div className="relative flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[22%] flex items-center justify-center"
            style={{ background: 'linear-gradient(145deg, #1e3a1e 0%, #0d1a0d 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          >
            <Music2 className="text-emerald-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white leading-tight tracking-tight">ServeSync</p>
            <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-widest">Team Portal</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-[clamp(2rem,3.5vw,3rem)] font-bold text-white leading-[1.1] tracking-[-0.03em] mb-4">
            {status === 'success' ? 'All done.' : 'Set your'}<br />
            <span style={{ background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {status === 'success' ? 'Password updated.' : 'new password.'}
            </span>
          </h2>
          <p className="text-[15px] text-white/40 leading-relaxed max-w-sm">
            {status === 'success'
              ? 'You can now sign in with your new password.'
              : 'Choose a strong password to keep your account secure.'}
          </p>
        </div>
        <p className="relative text-xs text-white/20">ServeSync — Built for ministry teams</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col">
        <div className="lg:hidden flex items-center gap-2.5 px-6 pt-14 pb-2">
          <div className="h-8 w-8 rounded-[22%] flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)' }}>
            <Music2 className="text-emerald-400" style={{ width: 16, height: 16 }} />
          </div>
          <span className="text-[14px] font-bold text-white tracking-tight">ServeSync</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-12"
        >
          <div className="w-full max-w-[360px]">

            {/* ── Success ── */}
            {status === 'success' && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">Password updated!</h1>
                <p className="text-[14px] text-white/40">Redirecting you to sign in…</p>
              </motion.div>
            )}

            {/* ── Expired ── */}
            {status === 'expired' && (
              <div className="text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">Link expired</h1>
                <p className="text-[14px] text-white/40 mb-6 leading-relaxed">
                  This reset link is no longer valid. Request a new one from the sign in page.
                </p>
                <button onClick={() => navigate('/login')} className="btn-primary">
                  Back to Sign In
                </button>
              </div>
            )}

            {/* ── Ready — show form ── */}
            {status === 'ready' && (
              <>
                <div className="mb-9">
                  <h1 className="text-[26px] font-bold text-white tracking-[-0.025em] leading-tight">Set new password</h1>
                  <p className="mt-2 text-[14px] text-white/35">Choose a strong password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-[11px] font-bold text-white/30 uppercase tracking-[0.12em] mb-2">New Password</label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-12 px-4 pr-12 rounded-xl text-[14px] bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/25 transition-colors hover:text-white/50"
                        aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {password.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 grid grid-cols-2 gap-2">
                        {requirements.map(r => {
                          const met = r.test(password);
                          return (
                            <div key={r.label} className="flex items-center gap-1.5">
                              {met
                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                : <AlertCircle className="h-3.5 w-3.5 text-white/20 shrink-0" />}
                              <span className={`text-[11px] font-medium ${met ? 'text-emerald-400' : 'text-white/30'}`}>{r.label}</span>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-[11px] font-bold text-white/30 uppercase tracking-[0.12em] mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        className={`w-full h-12 px-4 pr-12 rounded-xl text-[14px] bg-white/[0.05] border text-white placeholder-white/20 focus:outline-none focus:ring-2 transition-all ${
                          confirm.length > 0
                            ? confirmOk ? 'border-emerald-500/50 focus:ring-emerald-500/40' : 'border-red-500/50 focus:ring-red-500/40'
                            : 'border-white/[0.08] focus:ring-emerald-500/40 focus:border-emerald-500/50'
                        }`}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/25 transition-colors hover:text-white/50"
                        aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}>
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirm.length > 0 && !confirmOk && (
                      <p className="mt-1.5 text-[12px] text-red-400 font-medium">Passwords do not match</p>
                    )}
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={!canSubmit || loading}
                      className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                    >
                      {loading
                        ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating…</>
                        : 'Set New Password'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </motion.div>
      </div>
    </div>
  );
}
