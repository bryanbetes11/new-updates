import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Cake, ArrowLeft, Music, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';

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
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect') || '/onboarding';
  const inviteEmail = params.get('email') || '';
  const isCreateChurchFlow = params.get('create_church') === '1' && redirectTo === '/create-church';
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
    if (!isInviteJoinFlow && !isCreateChurchFlow) {
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
      isInviteJoinFlow
        ? 'Account created. Continue to accept your church invite.'
        : 'Account created. Continue to set up your church.',
    );
    navigate(redirectTo);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-7">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 mb-7 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </button>

            <div className="flex justify-center mb-5">
              <div className="relative">
                <img
                  src="/servesync-logo-3d.svg"
                  alt="ServeSync"
                  className="h-14 w-14 rounded-[22%] shadow-lg shadow-black/10 dark:shadow-black/30"
                />
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-gray-50 dark:ring-[#0a0a0a]">
                  <Music className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
                {isInviteJoinFlow || isCreateChurchFlow ? 'Create your account' : 'Invite-only registration'}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                {isInviteJoinFlow
                  ? `Continue joining your church team as ${inviteEmail}`
                  : isCreateChurchFlow
                    ? 'Create your account to set up a new church workspace'
                  : 'Ask your church admin for an invite link to join.'}
              </p>
            </div>
          </div>

          {!isInviteJoinFlow && !isCreateChurchFlow ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/10 p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Church invite required</p>
                    <p className="text-sm text-sky-700/80 dark:text-sky-300/80 mt-1">
                      New member accounts now join through a church invite. Existing MCJC accounts can keep signing in normally.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Link to="/login" className="btn-primary w-full justify-center py-3 text-[15px]">
                  Sign In
                </Link>
                <Link to="/" className="btn-secondary w-full justify-center py-3 text-[15px]">
                  Back to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="input-field"
                  placeholder="Your first name"
                  autoComplete="given-name"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  readOnly={Boolean(inviteEmail)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-11"
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> Birthday <span className="font-normal text-gray-400">(optional)</span></span>
                </label>
                <DatePicker value={birthday} onChange={setBirthday} placeholder="Select your birthday" />
              </div>

              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {isInviteJoinFlow ? 'Roles come from the invite' : 'You will create the first church admin account'}
                </p>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                  {isInviteJoinFlow
                    ? 'Your church admin will assign your access and ministry roles after you join.'
                    : 'After signup, you will create your church and become its first tenant admin.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !firstName || !email || !password}
                className="btn-primary w-full py-3 text-[15px] mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-500">
            Already have an account?{' '}
            <Link to={`/login${location.search}`} className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <p className="text-center py-5 text-xs text-gray-300 dark:text-gray-600">
        ServeSync — Built for ministry teams
      </p>
    </div>
  );
}
