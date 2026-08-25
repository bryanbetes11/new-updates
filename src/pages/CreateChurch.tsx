import { useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { isValidChurchSlug, normalizeChurchSlug, slugifyChurchName } from '../lib/churchOnboarding';
import { LaunchFlowShell } from '../components/LaunchFlowShell';
import { launchInfoRowClass, launchInputClass, launchLabelClass, launchPrimaryButtonClass, launchSecondaryButtonClass } from '../lib/launchFlowStyles';

const steps = [
  { label: 'Admin account', detail: 'Verify the first church administrator' },
  { label: 'Church workspace', detail: 'Name the church and choose its identifier' },
  { label: 'Invite the team', detail: 'Add members privately after setup' },
];

export function CreateChurch() {
  const { user, loading, hasOrganization, isOrgAdmin, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyChurchName(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!loading && user && hasOrganization) {
      navigate(isOrgAdmin ? '/admin/church' : '/dashboard', { replace: true });
    }
  }, [hasOrganization, isOrgAdmin, loading, navigate, user]);

  const normalizedSlug = normalizeChurchSlug(slug);
  const slugIsValid = isValidChurchSlug(normalizedSlug);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      navigate('/register?create_church=1&redirect=/create-church');
      return;
    }
    if (name.trim().length < 2) {
      toast('error', 'Enter your church name');
      return;
    }
    if (!slugIsValid) {
      toast('error', 'Church URL must be 3–40 letters, numbers, or hyphens');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('create_organization_for_current_user', {
      p_name: name.trim(),
      p_slug: normalizedSlug,
      p_logo_url: null,
    });
    setSubmitting(false);

    if (error) {
      toast('error', error.message || 'Could not create the church workspace');
      return;
    }

    await refreshProfile();
    toast('success', 'Church workspace created. Your 10-day trial has started.');
    navigate('/onboarding', { replace: true });
  };

  if (loading || (user && hasOrganization)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <LaunchFlowShell
      eyebrow="New church"
      title={user ? 'Give your church its own space.' : 'Start with one trusted admin.'}
      description={user
        ? 'This workspace keeps your people, schedules, messages, and ministry records separate from every other church on ServeSync.'
        : 'Create and verify the first administrator account. You will name the church next, then invite the team privately.'}
      steps={steps}
      currentStep={user ? 1 : 0}
      backTo="/"
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1ed760] text-black">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Step {user ? '2' : '1'} of 3</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{user ? 'Create church workspace' : 'Create the admin account'}</h2>
          </div>
        </div>
          {!user ? (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-white/52">
                Create an account for the first church administrator. After your email is confirmed, you can name the church and invite the rest of the team.
              </p>
              <div className={launchInfoRowClass}>
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" />
                <div>
                <p className="text-sm font-black text-white">
                  10-day trial · no card required
                </p>
                <p className="mt-1 text-xs leading-5 text-white/42">The first account becomes the church admin and controls invitations, roles, policies, and billing.</p>
                </div>
              </div>
              <Link to="/register?create_church=1&redirect=/create-church" className={`${launchPrimaryButtonClass} w-full`}>
                Create admin account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login?redirect=/create-church" className={`${launchSecondaryButtonClass} w-full`}>
                I already have an account
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className={launchInfoRowClass}>
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" />
                <span>Signed in as <strong className="font-black text-white">{user.email}</strong>. This account will become the first church admin.</span>
              </div>

              <div>
                <label htmlFor="church-name" className={launchLabelClass}>Church name</label>
                <input id="church-name" value={name} onChange={event => setName(event.target.value)} className={launchInputClass} placeholder="Grace Community Church" maxLength={120} autoFocus required />
              </div>

              <div>
                <label htmlFor="church-slug" className={launchLabelClass}>Workspace identifier</label>
                <input
                  id="church-slug"
                  value={slug}
                  onChange={event => {
                    setSlugTouched(true);
                    setSlug(normalizeChurchSlug(event.target.value));
                  }}
                  className={launchInputClass}
                  placeholder="grace-community"
                  minLength={3}
                  maxLength={40}
                  required
                />
                <div className="mt-2 flex items-start gap-2 text-xs text-white/38">
                  <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${slugIsValid ? 'text-[#63ee91]' : 'text-white/18'}`} />
                  <span>Workspace identifier: <span className="font-mono">{normalizedSlug || 'your-church'}</span></span>
                </div>
              </div>

              <button type="submit" disabled={submitting || name.trim().length < 2 || !slugIsValid} className={`${launchPrimaryButtonClass} w-full`}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating workspace…</> : <>Create church workspace <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="text-center text-[11px] leading-5 text-white/30">
                Church data is isolated from every other ServeSync workspace at the database level.
              </p>
            </form>
          )}
      </div>
    </LaunchFlowShell>
  );
}
