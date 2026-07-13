import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Building2, Copy, Loader2, Mail, Plus, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/EmptyState';
import { PageLoader } from '../../components/LoadingSpinner';
import { sortRolesLeadershipFirst } from '../../components/RoleBadge';
import type { OrganizationInvitation } from '../../types';

function formatStatus(status: string | null | undefined) {
  if (!status) return 'Exempt / not active';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function OrganizationSettings() {
  const { organization, roles, isOrgAdmin, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    logo_url: '',
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    is_admin: false,
    role_ids: [] as string[],
  });
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const billingStatus = organization?.billing_status || organization?.subscription_status;
  const billingRestricted = billingStatus === 'past_due' || billingStatus === 'suspended';

  const roleOptions = useMemo(() => sortRolesLeadershipFirst(roles), [roles]);

  const fetchInvitations = useCallback(async () => {
    if (!organization?.id) {
      setInvitations([]);
      return;
    }

    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('org_id', organization.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast('error', 'Failed to load church invites');
      return;
    }

    setInvitations((data || []) as OrganizationInvitation[]);
  }, [organization?.id, toast]);

  useEffect(() => {
    if (!organization) {
      setLoading(false);
      return;
    }

    setOrgForm({
      name: organization.name || '',
      logo_url: organization.logo_url || '',
    });

    fetchInvitations().finally(() => setLoading(false));
  }, [fetchInvitations, organization]);

  const handleSaveOrganization = async () => {
    if (!organization?.id) return;
    if (billingRestricted) {
      toast('info', 'Church settings are locked until billing is resolved.');
      return;
    }
    if (!orgForm.name.trim()) {
      toast('error', 'Church name is required');
      return;
    }

    setSavingOrg(true);
    const { error } = await supabase
      .from('organizations')
      .update({
        name: orgForm.name.trim(),
        logo_url: orgForm.logo_url.trim() || null,
      })
      .eq('id', organization.id);
    setSavingOrg(false);

    if (error) {
      toast('error', 'Failed to save church settings');
      return;
    }

    await refreshProfile();
    toast('success', 'Church settings updated');
  };

  const handleToggleInviteRole = (roleId: string) => {
    setInviteForm(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId],
    }));
  };

  const handleCreateInvite = async () => {
    if (!organization?.id) return;
    if (billingRestricted) {
      toast('info', 'Invites are locked until billing is resolved.');
      return;
    }
    const email = inviteForm.email.trim().toLowerCase();

    if (!email) {
      toast('error', 'Invite email is required');
      return;
    }

    setCreatingInvite(true);
    const { error } = await supabase.from('organization_invitations').insert({
      org_id: organization.id,
      email,
      role_ids: inviteForm.role_ids,
      is_admin: inviteForm.is_admin,
    });
    setCreatingInvite(false);

    if (error) {
      toast('error', 'Failed to create invite');
      return;
    }

    setInviteForm({ email: '', is_admin: false, role_ids: [] });
    await fetchInvitations();
    toast('success', 'Invite created');
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (billingRestricted) {
      toast('info', 'Invite changes are locked until billing is resolved.');
      return;
    }
    setDeletingInviteId(inviteId);
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', inviteId);
    setDeletingInviteId(null);

    if (error) {
      toast('error', 'Failed to revoke invite');
      return;
    }

    setInvitations(prev => prev.filter(invite => invite.id !== inviteId));
    toast('info', 'Invite revoked');
  };

  const handleCopyInvite = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Invite link copied');
    } catch {
      toast('error', 'Failed to copy invite link');
    }
  };

  if (loading) return <PageLoader />;

  if (!isOrgAdmin || !organization) {
    return (
      <div className="page-container page-bottom-pad">
        <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div
                className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
              >
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
              <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only church admins can manage tenant settings.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-5 sm:space-y-6">
      {billingRestricted && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Billing needs attention. Church settings and invite actions are temporarily locked until the billing status is resolved in the Billing tab.
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Tenant</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Church Settings</h2>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Manage the church record that future teams and billing attach to.</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Church Name</label>
            <input
              type="text"
              value={orgForm.name}
              onChange={e => setOrgForm(prev => ({ ...prev, name: e.target.value }))}
              className="input-field text-sm"
              placeholder="Church name"
              disabled={billingRestricted}
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Logo URL</label>
            <input
              type="url"
              value={orgForm.logo_url}
              onChange={e => setOrgForm(prev => ({ ...prev, logo_url: e.target.value }))}
              className="input-field text-sm"
              placeholder="https://..."
              disabled={billingRestricted}
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Slug</label>
            <input
              type="text"
              value={organization.slug}
              className="input-field text-sm bg-gray-50 dark:bg-gray-800"
              disabled
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Subscription</label>
            <input
              type="text"
              value={formatStatus(organization.subscription_status)}
              className="input-field text-sm bg-gray-50 dark:bg-gray-800"
              disabled
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSaveOrganization} disabled={savingOrg || billingRestricted} className="btn-primary text-sm">
            {savingOrg ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Church Settings'}
          </button>
          <p className="text-xs text-gray-400 dark:text-white/35">MCJC remains exempt from billing during rollout.</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Membership</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Invite Members</h2>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Create invite links now. The full join-by-invite signup flow is the next onboarding phase.</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-500/[0.12] text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Invite Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                className="input-field text-sm"
                placeholder="member@example.com"
                disabled={billingRestricted}
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-2">Assign Roles</label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map(role => {
                  const selected = inviteForm.role_ids.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleToggleInviteRole(role.id)}
                      disabled={billingRestricted}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ring-1 ${
                        selected
                          ? role.is_leadership
                            ? 'bg-amber-50 dark:bg-amber-900/20 ring-amber-300 dark:ring-amber-700 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-[#232325] ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-400 hover:ring-gray-300'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={inviteForm.is_admin}
                onChange={e => setInviteForm(prev => ({ ...prev, is_admin: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                disabled={billingRestricted}
              />
              Grant church-admin access
            </label>

            <button onClick={handleCreateInvite} disabled={creatingInvite || billingRestricted} className="btn-primary text-sm">
              {creatingInvite ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Create Invite</>}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Pending Invites</p>
            </div>

            {invitations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Mail className="h-6 w-6" />}
                  title="No invites yet"
                  description="Create the first invite link for a new member."
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {invitations.map(invite => (
                  <div key={invite.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{invite.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Expires {format(parseISO(invite.expires_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {invite.is_admin && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </div>

                    {invite.role_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {invite.role_ids.map(roleId => {
                          const role = roleOptions.find(r => r.id === roleId);
                          if (!role) return null;
                          return (
                            <span key={roleId} className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              {role.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => handleCopyInvite(invite.token)} disabled={billingRestricted} className="btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-50">
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        disabled={deletingInviteId === invite.id || billingRestricted}
                        className="btn-secondary text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingInviteId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
        {content}
      </div>
    </div>
  );
}
