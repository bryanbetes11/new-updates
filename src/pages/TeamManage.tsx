import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Users, Shield, Search, ChevronDown, ChevronUp, Plus, X, Check, BarChart3, Crown, CreditCard as Edit3, Save, Camera, Loader2, ClipboardCheck, AlertTriangle, FileText, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { PageLoader } from '../components/LoadingSpinner';
import { DatePicker } from '../components/DatePicker';
import { RoleBadge, sortRolesLeadershipFirst } from '../components/RoleBadge';
import { Avatar } from '../components/Avatar';
import { AttendanceMonitoring } from '../components/AttendanceMonitoring';
import type { Profile, UserRole } from '../types';

interface MemberWithRoles extends Profile {
  user_roles: UserRole[];
}

interface MemberAttendanceStats {
  user_id: string;
  late_count: number;
  absent_count: number;
  offense_level: number;
  events_assigned: number;
  present_count: number;
  excused_count: number;
}

const ministryStatusConfig: Record<string, { label: string; textColor: string; bgColor: string }> = {
  active: { label: 'Active', textColor: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  restoration: { label: 'Restoration', textColor: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  suspended: { label: 'Suspended', textColor: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  inactive: { label: 'Inactive', textColor: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

const offenseColors: Record<number, { text: string; bg: string }> = {
  0: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  1: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  2: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  3: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  4: { text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900/30' },
};

interface TeamManageProps {
  embedded?: boolean;
}

export function TeamManage({ embedded }: TeamManageProps = {}) {
  const { roles, isLeader, canManageMembers, canManageDiscipline, user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [stats, setStats] = useState({ total: 0, leaders: 0, events: 0 });
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', second_name: '', middle_name: '', last_name: '', nickname: '', phone: '', gender: '', birthday: '', ministry_status: 'active', leadership_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'attendance'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'attendance' ? 'attendance' : 'members';
  });
  const [attendanceStats, setAttendanceStats] = useState<Record<string, MemberAttendanceStats>>({});
  const [resetConfirmMember, setResetConfirmMember] = useState<MemberWithRoles | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

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

    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    setStats({
      total: (data || []).length,
      leaders: leaders.length,
      events: eventCount || 0,
    });

    const { data: statsData } = await supabase.rpc('get_all_members_attendance_stats', {
      p_year: currentYear,
      p_quarter: currentQuarter,
    });

    if (statsData) {
      const statsMap: Record<string, MemberAttendanceStats> = {};
      (statsData as MemberAttendanceStats[]).forEach(s => { statsMap[s.user_id] = s; });
      setAttendanceStats(statsMap);
    }

    setLoading(false);
  }, [roles, currentYear, currentQuarter]);

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
      ministry_status: member.ministry_status || 'active',
      leadership_notes: member.leadership_notes || '',
    });
    setEditingMember(member.id);
  };

  const saveMemberEdit = async (memberId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq('id', memberId);
    setSaving(false);
    if (error) { toast('error', 'Failed to save'); return; }
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
      redirectTo: `${window.location.origin}/login`,
    });
    setSendingReset(false);
    setResetConfirmMember(null);
    if (error) {
      toast('error', 'Failed to send reset email. Please try again.');
    } else {
      toast('success', `Password reset email sent to ${resetConfirmMember.email}`);
    }
  };

  const filtered = members.filter(m => {
    if (!search) return true;
    const name = `${m.first_name} ${m.last_name} ${m.nickname} ${m.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (loading) return <PageLoader />;

  if (!isLeader) {
    return (
      <div className={embedded ? 'flex items-center justify-center min-h-[40vh]' : 'page-container page-bottom-pad flex items-center justify-center min-h-[60vh]'}>
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Only leaders can access team management.</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">
      {!embedded && (
        <div className="animate-fade-in">
          <h1 className="page-header">Team Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage team members and their roles</p>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-2xl animate-slide-up" style={{ background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
        {(['members', 'attendance'] as const).map(tab => {
          const isActive = activeTab === tab;
          const Icon = tab === 'members' ? Users : ClipboardCheck;
          const label = tab === 'members' ? 'Members' : 'Attendance';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-white dark:bg-[#232325] text-gray-900 dark:text-white shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.08]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600 dark:text-brand-400' : ''}`} />
              {label}
              {tab === 'members' && (
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg transition-colors ${
                  isActive ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {filtered.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'attendance' ? (
        <AttendanceMonitoring />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
            {[
              { label: 'Members', value: stats.total, icon: Users, iconColor: 'text-brand-600 dark:text-brand-400', iconBg: 'bg-brand-50 dark:bg-brand-900/30' },
              { label: 'Leaders', value: stats.leaders, icon: Shield, iconColor: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-900/30' },
              { label: 'Events', value: stats.events, icon: BarChart3, iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-900/30' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-xl mb-2.5 ${s.iconBg}`}>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="relative animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members by name or email..."
              className="input-field pl-10"
            />
          </div>

          <div className="space-y-2 animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
            {filtered.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No members match your search</p>
              </div>
            )}
            {filtered.map((member, idx) => {
              const memberRoles = sortRolesLeadershipFirst(member.user_roles || []);
              const isExpanded = expanded === member.id;
              const mStats = attendanceStats[member.id];
              const hasStats = mStats && mStats.events_assigned > 0;
              const attendanceRate = hasStats ? Math.round(((mStats.present_count + mStats.late_count) / mStats.events_assigned) * 100) : null;
              const offLevel = mStats?.offense_level ?? 0;
              const offColors = offenseColors[Math.min(offLevel, 4)] ?? offenseColors[0];
              const ministryStatus = member.ministry_status ?? 'active';
              const statusCfg = ministryStatusConfig[ministryStatus] ?? ministryStatusConfig.active;

              return (
                <div
                  key={member.id}
                  className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] transition-all duration-200"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animationDelay: `${idx * 20}ms`, animationFillMode: 'both' }}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : member.id)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <Avatar
                      src={member.avatar_url}
                      firstName={member.first_name}
                      lastName={member.last_name}
                      size="md"
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
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {memberRoles.slice(0, 3).map(ur => ur.roles && (
                          <RoleBadge key={ur.id} role={ur.roles} size="sm" />
                        ))}
                        {memberRoles.length === 0 && <span className="text-[11px] text-gray-400">No roles</span>}
                        {memberRoles.length > 3 && <span className="text-[11px] text-gray-400">+{memberRoles.length - 3} more</span>}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 mr-1">
                      {attendanceRate !== null ? (
                        <>
                          <span className={`text-xs font-bold ${
                            attendanceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                            attendanceRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {attendanceRate}%
                          </span>
                          {offLevel > 0 && (
                            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${offColors.text}`}>
                              <AlertTriangle className="h-2.5 w-2.5" /> Lvl {offLevel}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400">No data</span>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="border-t border-black/[0.04] dark:border-white/[0.05] px-4 py-4">
                      {canManageMembers && editingMember === member.id ? (
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
                              <label className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                {avatarUploading
                                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                                  : <Camera className="h-4 w-4 text-white" />
                                }
                                <input type="file" accept="image/*" onChange={e => handleMemberAvatarUpload(member.id, e)} className="hidden" disabled={avatarUploading} />
                              </label>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Hover photo to change</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Gender</label>
                            <div className="flex gap-2">
                              {(['male', 'female'] as const).map(g => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, gender: g })}
                                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ring-1 ${
                                    editForm.gender === g
                                      ? 'bg-brand-50 dark:bg-brand-900/20 ring-brand-300 dark:ring-brand-700 text-brand-700 dark:text-brand-300'
                                      : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 text-gray-500 dark:text-gray-400 hover:ring-gray-300'
                                  }`}
                                >
                                  {g === 'male' ? 'Brother' : 'Sister'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
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

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Birthday</label>
                            <DatePicker value={editForm.birthday} onChange={v => setEditForm({ ...editForm, birthday: v })} placeholder="Select birthday" />
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

                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setEditingMember(null)} className="btn-secondary text-xs">Cancel</button>
                            <button onClick={() => saveMemberEdit(member.id)} disabled={saving} className="btn-primary text-xs">
                              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 mb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                                {[
                                  { label: 'Email', value: member.email || '--' },
                                  { label: 'Phone', value: member.phone || '--' },
                                  { label: 'Birthday', value: member.birthday ? format(parseISO(member.birthday), 'MMM d') : '--' },
                                  { label: 'Status', value: statusCfg.label, color: statusCfg.textColor },
                                ].map(item => (
                                  <div key={item.label}>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{item.label}</p>
                                    <p className={`text-xs font-semibold ${item.color || 'text-gray-800 dark:text-gray-200'} truncate`}>{item.value}</p>
                                  </div>
                                ))}
                              </div>
                              {canManageMembers && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => startEditing(member)} className="btn-ghost text-xs">
                                    <Edit3 className="h-3.5 w-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => setResetConfirmMember(member)}
                                    disabled={!member.email}
                                    title={member.email ? 'Send password reset email' : 'No email on file'}
                                    className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" /> Reset
                                  </button>
                                </div>
                              )}
                            </div>

                            {hasStats && attendanceRate !== null && (
                              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] ring-1 ring-black/[0.04] dark:ring-white/[0.05] p-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2.5">Attendance This Quarter</p>
                                <div className="grid grid-cols-5 gap-2">
                                  {[
                                    { label: 'Assigned', value: mStats!.events_assigned, color: 'text-gray-700 dark:text-gray-300' },
                                    { label: 'Present', value: mStats!.present_count, color: 'text-emerald-600 dark:text-emerald-400' },
                                    { label: 'Late', value: mStats!.late_count, color: 'text-amber-600 dark:text-amber-400' },
                                    { label: 'Absent', value: mStats!.absent_count, color: 'text-red-600 dark:text-red-400' },
                                    { label: 'Rate', value: `${attendanceRate}%`, color: attendanceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : attendanceRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400' },
                                  ].map(s => (
                                    <div key={s.label} className="text-center">
                                      <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {offLevel > 0 && (
                                  <div className={`mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${offColors.bg}`}>
                                    <AlertTriangle className={`h-3 w-3 shrink-0 ${offColors.text}`} />
                                    <p className={`text-xs font-bold ${offColors.text}`}>Offense Level {offLevel}</p>
                                  </div>
                                )}
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
                              {canManageMembers && (
                                <button
                                  onClick={() => { setShowRoleModal(member.id); setSelectedRole(''); }}
                                  className="btn-ghost text-xs py-1"
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
                                  {member.id !== user?.id && canManageMembers && (
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
              <div className="flex justify-end gap-3">
                <button onClick={() => setResetConfirmMember(null)} disabled={sendingReset} className="btn-secondary">Cancel</button>
                <button onClick={sendPasswordReset} disabled={sendingReset} className="btn-primary">
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
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowRoleModal(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => { if (showRoleModal && selectedRole) { addRole(showRoleModal, selectedRole); setShowRoleModal(null); } }}
                  disabled={!selectedRole}
                  className="btn-primary"
                >
                  <Check className="h-4 w-4" /> Add Role
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="page-container page-bottom-pad">
      {content}
    </div>
  );
}
