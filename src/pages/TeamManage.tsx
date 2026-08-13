import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, Shield, Search, ChevronDown, ChevronUp, Plus, X, Check, Crown, CreditCard as Edit3, Save, Camera, Loader2, FileText, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { passwordResetRedirectUrl } from '../lib/authRedirect';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { PageLoader } from '../components/LoadingSpinner';
import { DatePicker } from '../components/DatePicker';
import { RoleBadge, sortRolesLeadershipFirst } from '../components/RoleBadge';
import { Avatar } from '../components/Avatar';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import { phoneHref } from '../lib/phone';
import type { Profile, UserRole } from '../types';

interface MemberWithRoles extends Profile {
  user_roles: UserRole[];
}

interface MemberAuthAudit {
  profile_id: string;
  email: string;
  auth_email: string | null;
  has_auth_user: boolean;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  pending_invite_id: string | null;
  pending_invite_token: string | null;
  invite_expires_at: string | null;
  invite_accepted_at: string | null;
  auth_status: 'ready' | 'invite_pending' | 'missing_auth_account' | 'email_unconfirmed' | 'email_mismatch';
}

const ministryStatusConfig: Record<string, { label: string; textColor: string; bgColor: string }> = {
  active: { label: 'Active', textColor: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  restoration: { label: 'Restoration', textColor: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  suspended: { label: 'Suspended', textColor: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  inactive: { label: 'Inactive', textColor: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

const authStatusConfig: Record<MemberAuthAudit['auth_status'], { label: string; detail: string; className: string }> = {
  ready: {
    label: 'Login ready',
    detail: 'Auth account exists and email is confirmed.',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  },
  invite_pending: {
    label: 'Invite pending',
    detail: 'This member has an invite but has not created their account yet.',
    className: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  },
  missing_auth_account: {
    label: 'No login account',
    detail: 'A roster profile exists, but there is no matching Supabase Auth user.',
    className: 'bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
  },
  email_unconfirmed: {
    label: 'Confirm email',
    detail: 'The Auth account exists, but the email is not confirmed yet.',
    className: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  },
  email_mismatch: {
    label: 'Email mismatch',
    detail: 'The profile email does not match the Auth account email.',
    className: 'bg-orange-50 text-orange-700 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20',
  },
};

interface TeamManageProps {
  embedded?: boolean;
}

export function TeamManage({ embedded }: TeamManageProps = {}) {
  const { roles, isLeader, isOrgAdmin, canManageMembers, user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [stats, setStats] = useState({ total: 0, leaders: 0 });
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', second_name: '', middle_name: '', last_name: '', nickname: '', phone: '', gender: '', birthday: '', official_join_date: '', ministry_status: 'active', leadership_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [authAudit, setAuthAudit] = useState<Record<string, MemberAuthAudit>>({});
  const [resetConfirmMember, setResetConfirmMember] = useState<MemberWithRoles | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<MemberWithRoles | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const canManageChurchMembers = canManageMembers || isOrgAdmin;

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, user_roles(*, roles(*))')
      .order('first_name');
    setMembers((data || []) as MemberWithRoles[]);

    const leaderRoleIds = roles.filter(r => r.is_leadership).map(r => r.id);
    const leaders = (data || []).filter((m: MemberWithRoles) =>
      m.user_roles?.some(ur => leaderRoleIds.includes(ur.role_id))
    );

    setStats({
      total: (data || []).length,
      leaders: leaders.length,
    });

    if (canManageChurchMembers) {
      const { data: authAuditData, error: authAuditError } = await supabase.rpc('get_current_org_auth_audit');
      if (authAuditData) {
        const authAuditMap: Record<string, MemberAuthAudit> = {};
        (authAuditData as MemberAuthAudit[]).forEach(item => { authAuditMap[item.profile_id] = item; });
        setAuthAudit(authAuditMap);
      } else if (authAuditError && authAuditError.code !== 'PGRST202') {
        console.warn('[TeamManage] Auth audit unavailable:', authAuditError);
      }
    } else {
      setAuthAudit({});
    }

    setLoading(false);
  }, [roles, canManageChurchMembers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const addRole = async (userId: string, roleId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId });
    if (error) {
      toast('error', error.message.includes('duplicate') ? 'Role already assigned' : 'Failed to add role');
      return;
    }
    toast('success', 'Role added');
    fetchMembers();
  };

  const removeRole = async (userRoleId: string) => {
    await supabase.from('user_roles').delete().eq('id', userRoleId);
    toast('info', 'Role removed');
    fetchMembers();
  };

  const startEditing = (member: MemberWithRoles) => {
    setEditForm({
      first_name: member.first_name,
      second_name: member.second_name || '',
      middle_name: member.middle_name || '',
      last_name: member.last_name,
      nickname: member.nickname,
      phone: member.phone,
      gender: member.gender || '',
      birthday: member.birthday || '',
      official_join_date: member.official_join_date || '',
      ministry_status: member.ministry_status || 'active',
      leadership_notes: member.leadership_notes || '',
    });
    setEditingMember(member.id);
  };

  const saveMemberEdit = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    const { official_join_date, ...memberForm } = editForm;
    const officialJoinDateChanged = official_join_date !== (member?.official_join_date || '');

    const updatePayload: Record<string, string | null> = {
      ...memberForm,
      birthday: memberForm.birthday || null,
      updated_at: new Date().toISOString(),
    };

    if (officialJoinDateChanged) {
      updatePayload.official_join_date = official_join_date || null;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', memberId);
    setSaving(false);
    if (error) { toast('error', `Failed to save: ${error.message}`); return; }
    toast('success', 'Member updated');
    setEditingMember(null);
    fetchMembers();
  };

  const handleMemberAvatarUpload = async (memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) { toast('error', 'Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('error', 'Image must be under 2MB'); return; }
    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${memberId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { toast('error', 'Failed to upload image'); setAvatarUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', memberId);
    setAvatarUploading(false);
    toast('success', 'Photo updated');
    fetchMembers();
  };

  const sendPasswordReset = async () => {
    if (!resetConfirmMember?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetConfirmMember.email, {
      redirectTo: passwordResetRedirectUrl,
    });
    setSendingReset(false);
    setResetConfirmMember(null);
    if (error) {
      toast('error', 'Failed to send reset email. Please try again.');
    } else {
      toast('success', `Password reset email sent to ${resetConfirmMember.email}`);
    }
  };

  const removeMemberFromChurch = async () => {
    if (!removeConfirmMember) return;
    setRemovingMember(true);
    const { error } = await supabase.rpc('remove_member_from_current_org', {
      p_member_id: removeConfirmMember.id,
    });
    setRemovingMember(false);

    if (error) {
      toast('error', error.message || 'Failed to remove member');
      return;
    }

    toast('success', `${removeConfirmMember.first_name || 'Member'} removed from the church`);
    setRemoveConfirmMember(null);
    fetchMembers();
  };

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      toast('success', 'Invite link copied');
    } catch {
      toast('error', 'Failed to copy invite link');
    }
  };

  const filtered = members.filter(m => {
    if (!search) return true;
    const name = `${m.first_name} ${m.last_name} ${m.nickname} ${m.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const authIssueCount = Object.values(authAudit).filter(item => item.auth_status !== 'ready').length;

  if (loading) return <PageLoader />;

  if (!isLeader && !isOrgAdmin) {
    return (
      <div className={embedded ? 'flex items-center justify-center min-h-[40vh]' : 'page-container page-bottom-pad flex items-center justify-center min-h-[60vh]'}>
        <div className="text-center">
          <div
            className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
          >
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only leaders can access team management.</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className={embedded ? 'space-y-5' : 'space-y-5 sm:space-y-6'}>
      {!embedded && (
        <LeadershipHeroCard
          tone="emerald"
          icon={Users}
          eyebrow="Roles & Roster"
          title="Team."
          description="Manage your member roster, ministry roles, and account access from one shared leadership workspace."
        />
      )}
      <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 gap-2.5"
          >
            {[
              { label: 'Members', value: stats.total, icon: Users, dot: '#22c55e', dotDark: '#22c55e', tone: 'bg-emerald-50 dark:bg-emerald-500/[0.10] text-emerald-600 dark:text-emerald-400' },
              { label: 'Leaders', value: stats.leaders, icon: Shield, dot: '#0d9488', dotDark: '#2dd4bf', tone: 'bg-teal-50 dark:bg-teal-500/[0.10] text-teal-600 dark:text-teal-400' },
              { label: 'Auth issues', value: authIssueCount, icon: KeyRound, dot: '#ef4444', dotDark: '#f87171', tone: authIssueCount > 0 ? 'bg-red-50 dark:bg-red-500/[0.10] text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-white/[0.06] text-gray-500 dark:text-white/45' },
            ].map(s => (
              <div key={s.label} className="relative rounded-2xl p-3 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 14px -8px rgba(15,23,42,0.08)' }}>
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-xl mb-2 ${s.tone}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="text-xl font-black text-gray-900 dark:text-white leading-none tabular-nums" style={{ letterSpacing: '-0.04em' }}>{s.value}</p>
                <p className="text-[10px] text-gray-500 dark:text-white/45 mt-1.5 font-medium">{s.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <label htmlFor="team-member-search" className="sr-only">Search team members</label>
            <input
              id="team-member-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members by name or email…"
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-12 text-[13px] text-gray-900 outline-none transition-all placeholder-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/30 dark:focus:border-emerald-500/50"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300" aria-label="Clear member search">
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>

          <div className="space-y-2.5">
            {filtered.length === 0 && (
              <div className="rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] p-12 text-center" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}>
                <div className="relative h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-gray-400 dark:text-white/30" />
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>No members match your search</p>
              </div>
            )}
            {filtered.map((member, idx) => {
              const memberRoles = sortRolesLeadershipFirst(member.user_roles || []);
              const isExpanded = expanded === member.id;
              const ministryStatus = member.ministry_status ?? 'active';
              const statusCfg = ministryStatusConfig[ministryStatus] ?? ministryStatusConfig.active;
              const audit = authAudit[member.id];
              const authStatus = audit?.auth_status;
              const authCfg = authStatus ? authStatusConfig[authStatus] : null;
              const resetDisabled =
                !member.email ||
                authStatus === 'missing_auth_account' ||
                authStatus === 'invite_pending';

              return (
                <div
                  key={member.id}
                  className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-200"
                  style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)', animationDelay: `${idx * 20}ms`, animationFillMode: 'both' }}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />
                  <button
                    onClick={() => setExpanded(isExpanded ? null : member.id)}
                    className="relative w-full flex min-h-14 items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <Avatar
                      src={member.avatar_url}
                      firstName={member.first_name}
                      lastName={member.last_name}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {member.first_name} {member.last_name}
                          {member.nickname && <span className="text-gray-400 font-normal text-xs"> ({member.nickname})</span>}
                        </p>
                        {ministryStatus !== 'active' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${statusCfg.bgColor} ${statusCfg.textColor}`}>
                            {statusCfg.label}
                          </span>
                        )}
                        {authCfg && authStatus !== 'ready' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ring-1 ${authCfg.className}`}>
                            {authCfg.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {memberRoles.slice(0, 3).map(ur => ur.roles && (
                          <RoleBadge key={ur.id} role={ur.roles} size="sm" />
                        ))}
                        {memberRoles.length === 0 && <span className="text-[11px] text-gray-400">No roles</span>}
                        {memberRoles.length > 3 && <span className="text-[11px] text-gray-400">+{memberRoles.length - 3} more</span>}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="border-t border-black/[0.04] dark:border-white/[0.05] px-4 py-4">
                      {canManageChurchMembers && editingMember === member.id ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 mb-2">
                            <div className="relative group">
                              <Avatar
                                src={member.avatar_url}
                                firstName={member.first_name}
                                lastName={member.last_name}
                                size="lg"
                                className="rounded-2xl"
                              />
                              <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                {avatarUploading
                                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                                  : <Camera className="h-4 w-4 text-white" />
                                }
                                <input type="file" accept="image/*" onChange={e => handleMemberAvatarUpload(member.id, e)} className="hidden" disabled={avatarUploading} />
                              </label>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Select the photo to change it</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Gender</label>
                            <div className="flex gap-2">
                              {(['male', 'female'] as const).map(g => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, gender: g })}
                                  className={`min-h-11 flex-1 rounded-xl py-2 text-sm font-bold transition-all ring-1 ${
                                    editForm.gender === g
                                      ? 'bg-brand-50 dark:bg-brand-900/20 ring-brand-300 dark:ring-brand-700 text-brand-700 dark:text-brand-300'
                                      : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 text-gray-500 dark:text-gray-400 hover:ring-gray-300'
                                  }`}
                                >
                                  {g === 'male' ? 'Male' : 'Female'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">First Name</label>
                              <input type="text" value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className="input-field" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Second Name</label>
                              <input type="text" value={editForm.second_name} onChange={e => setEditForm({ ...editForm, second_name: e.target.value })} className="input-field" placeholder="Optional" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Middle Name</label>
                              <input type="text" value={editForm.middle_name} onChange={e => setEditForm({ ...editForm, middle_name: e.target.value })} className="input-field" placeholder="Optional" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Last Name</label>
                              <input type="text" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className="input-field" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Nickname</label>
                              <input type="text" value={editForm.nickname} onChange={e => setEditForm({ ...editForm, nickname: e.target.value })} className="input-field" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Phone</label>
                              <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="input-field" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Birthday</label>
                              <DatePicker value={editForm.birthday} onChange={v => setEditForm({ ...editForm, birthday: v })} placeholder="Select birthday" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Official Join Date</label>
                              <DatePicker value={editForm.official_join_date} onChange={v => setEditForm({ ...editForm, official_join_date: v })} placeholder="Select join date" />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Ministry Status</label>
                            <Select
                              value={editForm.ministry_status}
                              onChange={v => setEditForm({ ...editForm, ministry_status: v })}
                              options={[
                                { value: 'active', label: 'Active' },
                                { value: 'restoration', label: 'Restoration' },
                                { value: 'suspended', label: 'Suspended' },
                                { value: 'inactive', label: 'Inactive' },
                              ]}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Leadership Notes (internal)</label>
                            <textarea
                              value={editForm.leadership_notes}
                              onChange={e => setEditForm({ ...editForm, leadership_notes: e.target.value })}
                              className="input-field min-h-[60px] resize-none"
                              placeholder="Internal notes for leadership..."
                            />
                          </div>

                          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                            <button onClick={() => setEditingMember(null)} className="btn-secondary min-h-11 justify-center text-xs">Cancel</button>
                            <button onClick={() => saveMemberEdit(member.id)} disabled={saving} className="btn-primary min-h-11 justify-center text-xs">
                              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 mb-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
                                {[
                                  { label: 'Email', value: member.email || '--' },
                                  { label: 'Phone', value: member.phone || '--', href: phoneHref(member.phone) },
                                  { label: 'Birthday', value: member.birthday ? format(parseISO(member.birthday), 'MMM d, yyyy') : '--' },
                                  { label: 'Joined', value: format(parseISO(member.official_join_date || member.created_at), 'MMM d, yyyy') },
                                  { label: 'Status', value: statusCfg.label, color: statusCfg.textColor },
                                ].map(item => (
                                  <div key={item.label}>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{item.label}</p>
                                    {item.href ? (
                                      <a
                                        href={item.href}
                                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline truncate block"
                                      >
                                        {item.value}
                                      </a>
                                    ) : (
                                      <p className={`text-xs font-semibold ${item.color || 'text-gray-800 dark:text-gray-200'} truncate`}>{item.value}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {canManageChurchMembers && (
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-1.5 lg:shrink-0">
                                  <button onClick={() => startEditing(member)} className="btn-ghost min-h-11 justify-center text-xs">
                                    <Edit3 className="h-3.5 w-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => setResetConfirmMember(member)}
                                    disabled={resetDisabled}
                                    title={resetDisabled ? 'Password reset only works after an Auth account exists' : 'Send password reset email'}
                                    className="btn-ghost min-h-11 justify-center text-xs disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" /> Reset
                                  </button>
                                  {member.id !== user?.id && (
                                    <button
                                      onClick={() => setRemoveConfirmMember(member)}
                                      className="btn-ghost col-span-2 min-h-11 justify-center text-xs text-red-600 dark:text-red-400 sm:col-span-1"
                                    >
                                      <X className="h-3.5 w-3.5" /> Remove
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {authCfg && (
                              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] ring-1 ring-black/[0.04] dark:ring-white/[0.05] p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                                      <KeyRound className="h-3 w-3" /> Login Access
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ${authCfg.className}`}>
                                        {authCfg.label}
                                      </span>
                                      {audit?.last_sign_in_at && (
                                        <span className="text-[11px] text-gray-500 dark:text-white/35">
                                          Last sign in {format(parseISO(audit.last_sign_in_at), 'MMM d, yyyy h:mm a')}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500 dark:text-white/45 leading-relaxed">
                                      {authCfg.detail}
                                    </p>
                                    {authStatus === 'missing_auth_account' && (
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                                        Password reset will not help until they create an account from an invite link.
                                      </p>
                                    )}
                                  </div>
                                  {authStatus === 'invite_pending' && audit?.pending_invite_token && (
                                    <button
                                      type="button"
                                      onClick={() => copyInviteLink(audit.pending_invite_token!)}
                                      className="btn-secondary text-xs shrink-0"
                                    >
                                      Copy Invite Link
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {member.leadership_notes && (
                              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40">
                                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Leadership Notes
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{member.leadership_notes}</p>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Roles</p>
                              {canManageChurchMembers && (
                                <button
                                  onClick={() => { setShowRoleModal(member.id); setSelectedRole(''); }}
                                  className="btn-ghost min-h-11 text-xs"
                                >
                                  <Plus className="h-3 w-3" /> Add
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {memberRoles.map(ur => ur.roles && (
                                <span
                                  key={ur.id}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold ${
                                    ur.roles.is_leadership
                                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/60 dark:ring-amber-800/40'
                                      : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200/60 dark:ring-brand-800/40'
                                  }`}
                                >
                                  {ur.roles.is_leadership && <Crown className="h-3 w-3" />}
                                  {ur.roles.name}
                                  {member.id !== user?.id && canManageChurchMembers && (
                                    <button onClick={() => removeRole(ur.id)} className="hover:text-red-500 transition-colors ml-0.5">
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {memberRoles.length === 0 && (
                                <span className="text-xs text-gray-400 italic">No roles assigned</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Modal open={!!resetConfirmMember} onClose={() => !sendingReset && setResetConfirmMember(null)} title="Send Password Reset" size="sm">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Send a password reset email to:
              </p>
              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] ring-1 ring-black/[0.05] dark:ring-white/[0.06] px-4 py-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{resetConfirmMember?.first_name} {resetConfirmMember?.last_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{resetConfirmMember?.email}</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The user will receive an email with a link to set a new password.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button onClick={() => setResetConfirmMember(null)} disabled={sendingReset} className="btn-secondary min-h-11 justify-center">Cancel</button>
                <button onClick={sendPasswordReset} disabled={sendingReset} className="btn-primary min-h-11 justify-center">
                  {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {sendingReset ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </div>
          </Modal>

          <Modal open={!!showRoleModal} onClose={() => setShowRoleModal(null)} title="Add Role" size="sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                <Select
                  value={selectedRole}
                  onChange={setSelectedRole}
                  options={roles.map(r => ({ value: r.id, label: r.name }))}
                  placeholder="Select a role"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button onClick={() => setShowRoleModal(null)} className="btn-secondary min-h-11 justify-center">Cancel</button>
                <button
                  onClick={() => { if (showRoleModal && selectedRole) { addRole(showRoleModal, selectedRole); setShowRoleModal(null); } }}
                  disabled={!selectedRole}
                  className="btn-primary min-h-11 justify-center"
                >
                  <Check className="h-4 w-4" /> Add Role
                </button>
              </div>
            </div>
          </Modal>

          <Modal open={!!removeConfirmMember} onClose={() => !removingMember && setRemoveConfirmMember(null)} title="Remove Team Member" size="sm">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remove this member from your church team. Their login account will stay intact, but they will lose access to this church and all church roles.
              </p>
              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] ring-1 ring-black/[0.05] dark:ring-white/[0.06] px-4 py-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {removeConfirmMember?.first_name} {removeConfirmMember?.last_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{removeConfirmMember?.email}</p>
              </div>
              <p className="text-xs text-red-500 dark:text-red-300">
                This does not delete the account permanently. It only detaches the member from your church.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button onClick={() => setRemoveConfirmMember(null)} disabled={removingMember} className="btn-secondary min-h-11 justify-center">Cancel</button>
                <button onClick={removeMemberFromChurch} disabled={removingMember} className="btn-primary min-h-11 justify-center bg-red-600 hover:bg-red-500">
                  {removingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  {removingMember ? 'Removing...' : 'Remove Member'}
                </button>
              </div>
            </div>
          </Modal>
      </>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell relative pb-6 pt-4 sm:pt-5">
        {content}
      </div>
    </div>
  );
}
