import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Cake, Mail, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';
import { useSmartBack } from '../lib/navigationHistory';

const inputClass = `w-full h-12 px-4 rounded-xl text-[14px]
  bg-gray-50 dark:bg-white/[0.05]
  border border-gray-200 dark:border-white/[0.08]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-white/20
  focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50
  transition-all duration-200`;

export function Register() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const smartBack = useSmartBack('/login');
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/onboarding';
  const inviteEmail = params.get('email') || '';
  const isInviteJoinFlow = Boolean(inviteEmail) && redirectTo.startsWith('/invite/');

  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
  }, [inviteEmail]);

  if (user) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInviteJoinFlow) {
      toast('error', 'Registration is invite-only right now');
      return;
    }
    if (password.length < 6) {
      toast('error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, firstName);
    if (error) {
      toast('error', error.message);
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const updates: Record<string, unknown> = {};
      if (birthday) updates.birthday = birthday;
      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', session.user.id);
      }
    }

    setLoading(false);
    toast(
      'success',
      'Account created. Continue to accept your church invite.',
    );
    navigate(redirectTo);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0d0d0f] transition-colors duration-300">

      {/* Back button — fixed top-left */}
      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={smartBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 bg-white/90 dark:bg-white/[0.07] backdrop-blur-md border border-gray-200/70 dark:border-white/[0.09] shadow-sm hover:text-gray-800 dark:hover:text-white/70 transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      <div className="flex items-center justify-center min-h-screen px-6 py-20">
        <div className="w-full max-w-[380px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative bg-white dark:bg-white/[0.025] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors duration-300">
              {/* Top-edge highlight */}
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.12] to-transparent" />

              {/* Logo */}
              <div className="flex justify-center mb-6">
                <img
                  src="/servesync-logo-new.png"
                  alt="ServeSync"
                  className="h-14 w-14 rounded-[22%] shadow-md shadow-black/10 dark:shadow-black/40"
                />
              </div>

              {/* ── INVITE-ONLY STATE ── */}
              {!isInviteJoinFlow && (
                <>
                  <div className="text-center mb-7">
                    <h1 className="text-[24px] font-bold text-gray-900 dark:text-white tracking-[-0.025em] transition-colors duration-300">
                      Invite only
                    </h1>
                    <p className="mt-2 text-[14px] text-gray-500 dark:text-white/35 leading-relaxed transition-colors duration-300">
                      New accounts join through a church invite link.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/[0.07] border border-sky-100 dark:border-sky-500/[0.12] mb-6 transition-colors duration-300">
                    <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <p className="text-[13px] text-sky-700 dark:text-sky-300/80 leading-relaxed transition-colors duration-300">
                      Ask your church admin for an invite link to join ServeSync.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <Link
                      to="/login"
                      className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
                    >
                      Sign In <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.10] text-gray-700 dark:text-white/70 active:scale-[0.98] transition-all border border-gray-200/80 dark:border-white/[0.06]"
                    >
                      Back to Home
                    </button>
                  </div>
                </>
              )}

              {/* ── FORM: CREATE ACCOUNT ── */}
              {isInviteJoinFlow && (
                <>
                  <div className="text-center mb-7">
                    <h1 className="text-[24px] font-bold text-gray-900 dark:text-white tracking-[-0.025em] transition-colors duration-300">
                      Create your account
                    </h1>
                    <p className="mt-2 text-[14px] text-gray-500 dark:text-white/35 leading-relaxed transition-colors duration-300">
                      Joining as {inviteEmail}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        className={inputClass}
                        placeholder="Your first name"
                        autoComplete="given-name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={`${inputClass} ${Boolean(inviteEmail) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        readOnly={Boolean(inviteEmail)}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className={`${inputClass} pr-12`}
                          placeholder="Min. 6 characters"
                          autoComplete="new-password"
                          required
                          minLength={6}
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

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                        <Cake className="h-3.5 w-3.5" />
                        Birthday
                        <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                      </label>
                      <DatePicker value={birthday} onChange={setBirthday} placeholder="Select your birthday" />
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.12] transition-colors duration-300">
                      <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[13px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed transition-colors duration-300">
                        Your church admin will assign your ministry roles after you join.
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={loading || !firstName || !email || !password}
                        className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                      >
                        {loading
                          ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</>
                          : <>Create Account <ArrowRight className="h-4 w-4" /></>}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Sign-in link */}
              <div className="mt-7 pt-6 border-t border-gray-100 dark:border-white/[0.06] transition-colors duration-300">
                <p className="text-center text-[13px] text-gray-400 dark:text-white/30 transition-colors duration-300">
                  Already have an account?{' '}
                  <Link
                    to={`/login${location.search}`}
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
