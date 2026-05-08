import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Copy, Loader2, LogIn, Shield, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141416]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Church Invite</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Join a Church Team</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Invite unavailable</p>
                  <p className="text-sm text-red-600 dark:text-red-300/80 mt-1">{error}</p>
                </div>
                <Link to="/login" className="btn-primary w-full justify-center">
                  Back to Login
                </Link>
              </div>
            ) : invitation ? (
              <>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4">
                    <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-2">Invitation</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{invitation.org_name}</p>
                    <p className="text-sm text-gray-500 dark:text-white/45 mt-1">This invite is for <span className="font-semibold text-gray-700 dark:text-white/70">{invitation.email}</span>.</p>
                  </div>

                  {(roleNames.length > 0 || invitation.is_admin) && (
                    <div className="flex flex-wrap gap-2">
                      {roleNames.map(name => (
                        <span key={name} className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                          {name}
                        </span>
                      ))}
                      {invitation.is_admin && (
                        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                          <Shield className="h-3 w-3" /> Church Admin
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-white/55">Sign in or create an account using <span className="font-semibold">{invitation.email}</span> to accept this invite.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Link to={`/login?redirect=${redirect}&email=${encodeURIComponent(invitation.email)}`} className="btn-primary justify-center">
                        <LogIn className="h-4 w-4" /> Sign In
                      </Link>
                      <Link to={`/register?redirect=${redirect}&email=${encodeURIComponent(invitation.email)}`} className="btn-secondary justify-center">
                        <UserPlus className="h-4 w-4" /> Create Account
                      </Link>
                    </div>
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Which one should I choose?</p>
                      <p className="text-sm text-gray-600 dark:text-white/55">
                        Use <span className="font-semibold">Sign In</span> if you already have an account with this email.
                      </p>
                      <p className="text-sm text-gray-600 dark:text-white/55">
                        Use <span className="font-semibold">Create Account</span> if this is your first time joining.
                      </p>
                    </div>
                    <button onClick={handleCopyLoginLink} className="btn-ghost w-full justify-center text-sm">
                      <Copy className="h-4 w-4" /> Copy Invite Link
                    </button>
                  </div>
                ) : emailMismatch ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Wrong signed-in account</p>
                      <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-1">
                        You are signed in as {profile?.email}. This invite is for {invitation.email}.
                      </p>
                    </div>
                    <button onClick={signOut} className="btn-primary w-full justify-center">
                      Sign Out and Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Ready to join</p>
                          <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                            Continue as {profile?.email} and join {invitation.org_name}.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button onClick={handleAccept} disabled={accepting} className="btn-primary w-full justify-center">
                      {accepting ? <><Loader2 className="h-4 w-4 animate-spin" /> Joining...</> : 'Accept Invite'}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
