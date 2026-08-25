import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Copy, Loader2, LogIn, Shield, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LaunchFlowShell } from '../components/LaunchFlowShell';
import { launchInfoRowClass, launchPrimaryButtonClass, launchSecondaryButtonClass } from '../lib/launchFlowStyles';

const steps = [
  { label: 'Church invite', detail: 'Confirm the church and invited email' },
  { label: 'Member account', detail: 'Sign in or create the reserved account' },
  { label: 'Your profile', detail: 'Finish the details your team needs' },
];

interface InvitationLookup {
  invitation_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  email: string;
  role_ids: string[];
  is_admin: boolean;
  expires_at: string;
  accepted_at: string | null;
}

export function InviteAccept() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile, roles, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleNames = useMemo(() => {
    if (!invitation) return [];
    return invitation.role_ids
      .map(roleId => roles.find(role => role.id === roleId)?.name)
      .filter((name): name is string => Boolean(name));
  }, [invitation, roles]);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invite token is missing.');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('get_organization_invitation_by_token', {
        p_token: token,
      });

      if (rpcError) {
        setError('Failed to load invite.');
        setLoading(false);
        return;
      }

      const invite = Array.isArray(data) ? data[0] : data;
      if (!invite) {
        setError('This invite link is invalid.');
        setLoading(false);
        return;
      }

      if (invite.accepted_at) {
        setError('This invite has already been used.');
        setLoading(false);
        return;
      }

      if (new Date(invite.expires_at).getTime() < Date.now()) {
        setError('This invite link has expired.');
        setLoading(false);
        return;
      }

      setInvitation(invite as InvitationLookup);
      setLoading(false);
    };

    fetchInvitation();
  }, [token]);

  const redirect = encodeURIComponent(`/invite/${token}`);

  const handleAccept = async () => {
    if (!invitation) return;
    setAccepting(true);

    const { error: rpcError } = await supabase.rpc('accept_organization_invitation', {
      p_token: token,
    });

    setAccepting(false);

    if (rpcError) {
      toast('error', rpcError.message);
      return;
    }

    await refreshProfile();
    toast('success', `You joined ${invitation.org_name}`);
    navigate(profile?.is_onboarded ? '/dashboard' : '/onboarding', { replace: true });
  };

  const handleCopyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      toast('success', 'Invite link copied');
    } catch {
      toast('error', 'Failed to copy invite link');
    }
  };

  const emailMismatch = Boolean(
    user &&
    invitation &&
    profile?.email &&
    profile.email.toLowerCase() !== invitation.email.toLowerCase(),
  );

  return (
    <LaunchFlowShell
      eyebrow="Private membership"
      title="Your church saved you a place."
      description="Confirm the invitation, use the reserved email, and enter the correct church workspace without exposing another church's people or ministry records."
      steps={steps}
      currentStep={0}
      backTo="/"
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-black">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Step 1 of 3</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">Review your church invite</h2>
          </div>
        </div>

          <div className="space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#63ee91]" />
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="border-y border-red-400/20 bg-red-500/[0.055] py-4">
                  <p className="text-sm font-black text-red-300">Invite unavailable</p>
                  <p className="mt-1 text-sm text-red-200/62">{error}</p>
                </div>
                <Link to="/login" className={`${launchPrimaryButtonClass} w-full`}>
                  Back to Login
                </Link>
              </div>
            ) : invitation ? (
              <>
                <div className="space-y-3">
                  <div className="border-y border-white/[0.08] py-5">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/32">Invitation</p>
                    <p className="text-2xl font-black tracking-[-0.025em] text-white">{invitation.org_name}</p>
                    <p className="mt-1 text-sm text-white/42">Reserved for <span className="font-black text-white/72">{invitation.email}</span>.</p>
                  </div>

                  {(roleNames.length > 0 || invitation.is_admin) && (
                    <div className="flex flex-wrap gap-2">
                      {roleNames.map(name => (
                        <span key={name} className="inline-flex rounded-full bg-[#1ed760]/12 px-3 py-1.5 text-xs font-black text-[#7cffaa]">
                          {name}
                        </span>
                      ))}
                      {invitation.is_admin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-300">
                          <Shield className="h-3 w-3" /> Church Admin
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-white/52">Sign in or create an account using <span className="font-black text-white/78">{invitation.email}</span> to accept this invite.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Link to={`/login?redirect=${redirect}&email=${encodeURIComponent(invitation.email)}`} className={launchPrimaryButtonClass}>
                        <LogIn className="h-4 w-4" /> Sign In
                      </Link>
                      <Link to={`/register?redirect=${redirect}&email=${encodeURIComponent(invitation.email)}`} className={launchSecondaryButtonClass}>
                        <UserPlus className="h-4 w-4" /> Create Account
                      </Link>
                    </div>
                    <div className={`${launchInfoRowClass} flex-col gap-1`}>
                      <p className="text-sm font-black text-white">Which one should I choose?</p>
                      <p className="text-sm text-white/48">
                        Use <span className="font-semibold">Sign In</span> if you already have an account with this email.
                      </p>
                      <p className="text-sm text-white/48">
                        Use <span className="font-semibold">Create Account</span> if this is your first time joining.
                      </p>
                    </div>
                    <button onClick={handleCopyLoginLink} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-black text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75">
                      <Copy className="h-4 w-4" /> Copy Invite Link
                    </button>
                  </div>
                ) : emailMismatch ? (
                  <div className="space-y-3">
                    <div className="border-y border-amber-400/20 bg-amber-400/[0.055] py-4">
                      <p className="text-sm font-black text-amber-300">Wrong signed-in account</p>
                      <p className="mt-1 text-sm text-amber-200/62">
                        You are signed in as {profile?.email}. This invite is for {invitation.email}.
                      </p>
                    </div>
                    <button onClick={signOut} className={`${launchPrimaryButtonClass} w-full`}>
                      Sign Out and Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={launchInfoRowClass}>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#63ee91]" />
                        <div>
                          <p className="text-sm font-black text-white">Ready to join</p>
                          <p className="mt-1 text-sm text-white/48">
                            Continue as {profile?.email} and join {invitation.org_name}.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button onClick={handleAccept} disabled={accepting} className={`${launchPrimaryButtonClass} w-full`}>
                      {accepting ? <><Loader2 className="h-4 w-4 animate-spin" /> Joining...</> : 'Accept Invite'}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
      </div>
    </LaunchFlowShell>
  );
}
