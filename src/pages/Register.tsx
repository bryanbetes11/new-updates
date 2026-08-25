import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Cake, Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';
import { useSmartBack } from '../lib/navigationHistory';
import { LaunchFlowShell } from '../components/LaunchFlowShell';
import { launchInfoRowClass, launchInputClass, launchLabelClass, launchPrimaryButtonClass, launchSecondaryButtonClass } from '../lib/launchFlowStyles';

const churchSteps = [
  { label: 'Admin account', detail: 'Create and verify the first administrator' },
  { label: 'Church workspace', detail: 'Name the church and secure its space' },
  { label: 'Invite the team', detail: 'Bring members in through private links' },
];

const memberSteps = [
  { label: 'Church invite', detail: 'Open the private link from your leader' },
  { label: 'Member account', detail: 'Create the account tied to the invite' },
  { label: 'Your profile', detail: 'Add the details your team needs' },
];

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
  const requestedRedirect = params.get('redirect') || '';
  const inviteEmail = params.get('email') || '';
  const isInviteJoinFlow = Boolean(inviteEmail) && /^\/invite\/[a-zA-Z0-9-]+$/.test(requestedRedirect);
  const isCreateChurchFlow = params.get('create_church') === '1' && requestedRedirect === '/create-church';
  const redirectTo = isInviteJoinFlow ? requestedRedirect : isCreateChurchFlow ? '/create-church' : '/onboarding';
  const registrationAllowed = isInviteJoinFlow || isCreateChurchFlow;

  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
  }, [inviteEmail]);

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, user]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationAllowed) {
      toast('error', 'Registration is invite-only right now');
      return;
    }
    if (password.length < 6) {
      toast('error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password, firstName.trim());
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
      session
        ? isCreateChurchFlow
          ? 'Account created. Now create your church workspace.'
          : 'Account created. Continue to accept your church invite.'
        : 'Account created. Confirm your email, then sign in to continue.',
    );
    navigate(redirectTo);
  };

  const steps = isCreateChurchFlow ? churchSteps : memberSteps;
  const currentStep = isCreateChurchFlow ? 0 : isInviteJoinFlow ? 1 : 0;

  return (
    <LaunchFlowShell
      eyebrow={isCreateChurchFlow ? 'New church' : 'Private membership'}
      title={isCreateChurchFlow ? 'One account starts the whole workspace.' : 'Join the team without the noise.'}
      description={isCreateChurchFlow
        ? 'Verify the first administrator, create the church workspace, then invite members into a calm and private ministry hub.'
        : 'Church membership begins with a private invitation. Your account stays tied to the correct team from the first step.'}
      steps={steps}
      currentStep={currentStep}
      onBack={smartBack}
    >
      <div className="mx-auto w-full max-w-xl">
        {!registrationAllowed ? (
          <section aria-labelledby="invite-only-title">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Private by design</p>
            <h2 id="invite-only-title" className="mt-2 text-3xl font-black tracking-[-0.04em]">You need a church invite.</h2>
            <p className="mt-3 text-sm leading-6 text-white/48">New member accounts join through a private link from a church administrator.</p>
            <div className={`${launchInfoRowClass} mt-7`}>
              <Mail className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" />
              <p>Ask your church admin to send or resend your personal invitation link.</p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link to="/login" className={launchPrimaryButtonClass}>Sign in <ArrowRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => navigate('/')} className={launchSecondaryButtonClass}>Back to home</button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="create-account-title">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Step {isCreateChurchFlow ? '1' : '2'} of 3</p>
            <h2 id="create-account-title" className="mt-2 text-3xl font-black tracking-[-0.04em]">Create your account</h2>
            <p className="mt-3 text-sm leading-6 text-white/48">{isCreateChurchFlow ? 'This person becomes the first church administrator after verification.' : `This invitation is reserved for ${inviteEmail}.`}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="register-first-name" className={launchLabelClass}>First name</label>
                <input id="register-first-name" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={launchInputClass} placeholder="Your first name" autoComplete="given-name" required />
              </div>
              <div>
                <label htmlFor="register-email" className={launchLabelClass}>Email address</label>
                <input id="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${launchInputClass} ${inviteEmail ? 'cursor-not-allowed opacity-55' : ''}`} placeholder="you@example.com" autoComplete="email" required readOnly={isInviteJoinFlow} />
              </div>
              <div>
                <label htmlFor="register-password" className={launchLabelClass}>Password</label>
                <div className="relative">
                  <input id="register-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={`${launchInputClass} pr-12`} placeholder="At least 6 characters" autoComplete="new-password" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(value => !value)} className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={`${launchLabelClass} flex items-center gap-1.5`}><Cake className="h-3.5 w-3.5" /> Birthday <span className="normal-case font-semibold tracking-normal text-white/22">optional</span></label>
                <DatePicker value={birthday} onChange={setBirthday} placeholder="Select your birthday" />
              </div>

              <div className={launchInfoRowClass}>
                <Shield className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" />
                <p>{isCreateChurchFlow ? 'After email confirmation, this account becomes the first administrator of the new church workspace.' : 'Your church admin assigns ministry roles after you join.'}</p>
              </div>

              <button type="submit" disabled={loading || !firstName || !email || !password} className={`${launchPrimaryButtonClass} w-full`}>
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Creating account…</> : <>Create account <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </section>
        )}

        <p className="mt-8 border-t border-white/[0.07] pt-6 text-center text-sm text-white/32">
          Already have an account?{' '}
          <Link to={`/login${location.search}`} className="font-black text-[#63ee91] transition-colors hover:text-[#8bf5ac]">Sign in</Link>
        </p>
      </div>
    </LaunchFlowShell>
  );
}
