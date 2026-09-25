import { ArrowRight, Building2, Cake, Mail, ShieldCheck } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LaunchFlowShell } from '../components/LaunchFlowShell';
import { launchInfoRowClass, launchInputClass, launchLabelClass, launchPrimaryButtonClass } from '../lib/launchFlowStyles';
import { Onboarding } from './Onboarding';

type PreviewRole = 'admin' | 'member';

const steps = {
  admin: [
    { label: 'Admin account', detail: 'Verify your administrator email' },
    { label: 'Church workspace', detail: 'Create your private church space' },
    { label: 'Your profile', detail: 'Add your own details before inviting the team' },
  ],
  member: [
    { label: 'Church invite', detail: 'Join the correct private workspace' },
    { label: 'Member account', detail: 'Secure your ServeSync access' },
    { label: 'Your profile', detail: 'Share the details your team needs' },
  ],
};

function onboardingPreviewUrl(role: PreviewRole, step = 0) {
  const stage = role === 'admin' ? ['account', 'church', 'profile'] : ['invite', 'account', 'profile'];
  return `/preview/onboarding?role=${role}&step=${stage[step]}`;
}

function OnboardingPreviewNavigation({ role, currentStep }: { role: PreviewRole; currentStep: number }) {
  return (
    <nav aria-label="Preview steps" className="mb-7 rounded-2xl border border-[#1ed760]/25 bg-[#1ed760]/[0.07] p-4 text-sm">
      <p className="font-black text-[#7cffaa]">Onboarding preview · Nothing will be saved</p>
      <p className="mt-1 text-white/55">Sample details only. Tap a step to explore the flow.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {steps[role].map((item, index) => (
          <Link
            key={item.label}
            to={onboardingPreviewUrl(role, index)}
            aria-current={currentStep === index ? 'step' : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-bold transition-colors ${currentStep === index ? 'bg-[#1ed760] text-black' : 'bg-white/[0.075] text-white/70 hover:bg-white/[0.13]'}`}
          >
            {index + 1}. {item.label}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs font-bold">
        <Link to={onboardingPreviewUrl('admin')} className="text-[#7cffaa] underline">Admin view</Link>
        <Link to={onboardingPreviewUrl('member')} className="text-[#7cffaa] underline">Member view</Link>
      </div>
    </nav>
  );
}

function SampleField({ label, value, type = 'text' }: { label: string; value: string; type?: string }) {
  return (
    <div>
      <p className={launchLabelClass}>{label}</p>
      <div className={`${launchInputClass} flex items-center text-white/65`} aria-label={`${label}: ${value}`}>
        {type === 'password' ? '••••••••••' : value}
      </div>
    </div>
  );
}

export function OnboardingPreview() {
  const [searchParams] = useSearchParams();
  const role: PreviewRole = searchParams.get('role') === 'member' ? 'member' : 'admin';
  const requestedStep = searchParams.get('step');
  const currentStep = requestedStep === 'profile' ? 2 : requestedStep === (role === 'admin' ? 'church' : 'account') ? 1 : 0;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [role, currentStep]);

  if (currentStep === 2) return <Onboarding preview />;

  const isAdmin = role === 'admin';
  const nextUrl = onboardingPreviewUrl(role, currentStep + 1);

  return (
    <LaunchFlowShell
      eyebrow={isAdmin ? 'Church administrator setup' : 'Member setup'}
      title={isAdmin
        ? currentStep === 0 ? 'Start with one trusted admin.' : 'Give your church its own space.'
        : currentStep === 0 ? 'Your church saved you a place.' : 'Secure your place on the team.'}
      description={isAdmin
        ? currentStep === 0
          ? 'An approved administrator creates and verifies an account before setting up the church.'
          : 'A private workspace keeps this church’s people, schedules, and messages together.'
        : currentStep === 0
          ? 'A personal invitation connects you to the correct church and reserved email address.'
          : 'Use the email on your invitation to create your account or sign in.'}
      steps={steps[role]}
      currentStep={currentStep}
      backTo={currentStep === 1 ? onboardingPreviewUrl(role, 0) : undefined}
    >
      <div className="mx-auto w-full max-w-xl">
        <OnboardingPreviewNavigation role={role} currentStep={currentStep} />
        <div className="mb-7 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-black">
            {isAdmin && currentStep === 1 ? <Building2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Step {currentStep + 1} of 3</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
              {isAdmin ? currentStep === 0 ? 'Create the admin account' : 'Create church workspace' : currentStep === 0 ? 'Review your church invite' : 'Create your account'}
            </h2>
          </div>
        </div>

        {isAdmin && currentStep === 0 && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-white/52">The first administrator uses the email approved for the private pilot. After verifying it, they can name the church.</p>
            <SampleField label="First name" value="Alex" />
            <SampleField label="Approved email address" value="admin@example.org" />
            <SampleField label="Password" value="" type="password" />
            <SampleField label="Birthday (optional)" value="Choose your birthday" />
            <div className={launchInfoRowClass}><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" /><p>In the real flow, email verification is required before this account can create a church.</p></div>
          </div>
        )}
        {isAdmin && currentStep === 1 && (
          <div className="space-y-5">
            <div className={launchInfoRowClass}><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" /><p>Signed in as <strong className="text-white">admin@example.org</strong>. This account becomes the first church admin.</p></div>
            <SampleField label="Church name" value="Example Community Church" />
            <SampleField label="Workspace identifier" value="example-community" />
            <p className="text-sm leading-6 text-white/52">The real administrator confirms they are at least 18 and reviews the <a href="/pilot-terms.html" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline">pilot terms</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline">privacy notice</a> before creating the workspace.</p>
          </div>
        )}
        {!isAdmin && currentStep === 0 && (
          <div className="space-y-5">
            <div className="border-y border-white/[0.08] py-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/32">Sample invitation</p>
              <p className="text-2xl font-black tracking-[-0.025em]">Example Community Church</p>
              <p className="mt-1 text-sm text-white/42">Reserved for <strong className="text-white/72">volunteer@example.org</strong>.</p>
            </div>
            <span className="inline-flex rounded-full bg-[#1ed760]/12 px-3 py-1.5 text-xs font-black text-[#7cffaa]">Worship Team</span>
            <p className="text-sm leading-6 text-white/52">A real member opens a personal link from the church admin. They can sign in if they already have an account, or create one with the reserved email.</p>
          </div>
        )}
        {!isAdmin && currentStep === 1 && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-white/52">The invitation is reserved for <strong className="text-white">volunteer@example.org</strong>.</p>
            <SampleField label="First name" value="Jordan" />
            <SampleField label="Email address" value="volunteer@example.org" />
            <SampleField label="Password" value="" type="password" />
            <SampleField label="Birthday (optional)" value="Choose your birthday" />
            <div className={launchInfoRowClass}><Cake className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" /><p>Birthday is optional. In the private pilot, a member confirms adulthood and reviews the pilot terms before joining.</p></div>
          </div>
        )}

        <Link to={nextUrl} className={`${launchPrimaryButtonClass} mt-7 w-full`}>
          {currentStep === 0 ? 'See next step' : 'See your profile'} <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-center text-xs text-white/35">Preview only. No account, invitation, or church is created.</p>
      </div>
    </LaunchFlowShell>
  );
}
