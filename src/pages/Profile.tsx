import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Pencil, Save, LogOut, X, Check, Crown,
  Camera, Loader2, Shield, ChevronDown, Clock,
  MessageSquare, XCircle, CheckCircle, Eye, KeyRound,
  Phone, Cake, Calendar, AlertCircle, Mail
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DatePicker } from '../components/DatePicker';
import { PageLoader } from '../components/LoadingSpinner';
import { PushNotificationSetting } from '../components/PushNotificationSetting';
import { RoleBadge, sortRolesLeadershipFirst } from '../components/RoleBadge';
import { phoneHref } from '../lib/phone';
import type { DisciplineRecord } from '../types';

interface AccountabilitySummary {
  user_id: string;
  proposal_overdue_count: number;
  proposal_submitted_late_count: number;
  pending_assignment_count: number;
  approved_leave_count: number;
  pending_leave_count: number;
  open_discipline_count: number;
  events_assigned: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  offense_level: number;
}

const disciplineStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:           { label: 'Open',           color: 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-white/55 border border-gray-200 dark:border-white/[0.08]', icon: Clock },
  verbal_warning: { label: 'Verbal Warning', color: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25', icon: MessageSquare },
  counselling:    { label: 'Counselling',    color: 'bg-orange-50 dark:bg-orange-500/[0.12] text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25', icon: MessageSquare },
  suspension:     { label: 'Suspended',      color: 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25', icon: XCircle },
  resolved:       { label: 'Resolved',       color: 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25', icon: CheckCircle },
};

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">{children}</span>
      {action}
    </div>
  );
}

function PremiumCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />
      {children}
    </div>
  );
}

export function Profile() {
  const { user, profile, userRoles, roles, signOut, refreshProfile, isLeader, organization } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [editingRoles, setEditingRoles] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '', second_name: '', middle_name: '', last_name: '', nickname: '', phone: '', gender: '', birthday: '', official_join_date: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [myDisciplineRecords, setMyDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [disciplineExpanded, setDisciplineExpanded] = useState<string | null>(null);
  const [accountabilitySummary, setAccountabilitySummary] = useState<AccountabilitySummary | null>(null);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailUpdating, setEmailUpdating] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name,
        second_name: profile.second_name || '',
        middle_name: profile.middle_name || '',
        last_name: profile.last_name,
        nickname: profile.nickname,
        phone: profile.phone,
        gender: profile.gender || '',
        birthday: profile.birthday || '',
        official_join_date: profile.official_join_date || '',
      });
      setNewEmail(profile.email || '');
    }
  }, [profile]);

  const fetchMyDiscipline = useCallback(async () => {
    if (!user || isLeader) return;
    const { data } = await supabase
      .from('discipline_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMyDisciplineRecords((data || []) as DisciplineRecord[]);
  }, [user, isLeader]);

  useEffect(() => { fetchMyDiscipline(); }, [fetchMyDiscipline]);

  const fetchMyAccountability = useCallback(async () => {
    if (!user || !profile) return;
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const { data } = await supabase.rpc('get_my_accountability_summary', {
      p_year: currentYear,
      p_quarter: currentQuarter,
    });
    setAccountabilitySummary((data?.[0] as AccountabilitySummary) || null);
  }, [user]);

  useEffect(() => { fetchMyAccountability(); }, [fetchMyAccountability]);

  const handleSave = async () => {
    if (!user || !profile) return;
    const { official_join_date, ...profileForm } = form;
    const officialJoinDateChanged = official_join_date !== (profile.official_join_date || '');

    const updatePayload: Record<string, string | null> = {
      ...profileForm,
      birthday: profileForm.birthday || null,
      updated_at: new Date().toISOString(),
    };

    if (officialJoinDateChanged) {
      updatePayload.official_join_date = official_join_date || null;
    }

    setLoading(true);
    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    setLoading(false);
    if (error) { toast('error', `Failed to save: ${error.message}`); return; }
    toast('success', 'Profile updated');
    setEditing(false);
    refreshProfile();
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const normalizedEmail = newEmail.trim().toLowerCase();
    const currentEmail = (profile.email || user.email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      toast('error', 'Enter the new email address.');
      return;
    }

    if (normalizedEmail === currentEmail) {
      toast('error', 'That is already your current email.');
      return;
    }

    setEmailUpdating(true);
    const { error } = await supabase.auth.updateUser(
      { email: normalizedEmail },
      { emailRedirectTo: `${window.location.origin}/profile` },
    );
    setEmailUpdating(false);

    if (error) {
      toast('error', error.message || 'Failed to send email confirmation.');
      return;
    }

    toast('success', `Confirmation sent to ${normalizedEmail}`);
    setEmailPanelOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) { toast('error', 'Please select an image'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('error', 'Image must be under 2MB'); return; }
    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { toast('error', 'Upload failed'); setAvatarUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}`, updated_at: new Date().toISOString() }).eq('id', user.id);
    await refreshProfile();
    setAvatarUploading(false);
    toast('success', 'Profile picture updated');
  };

  if (!profile) return <PageLoader />;

  const sortedUserRoles = sortRolesLeadershipFirst(userRoles);
  const startEditingRoles = () => { setSelectedRoleIds(userRoles.map(ur => ur.role_id)); setEditingRoles(true); };
  const toggleRoleSelection = (roleId: string) => setSelectedRoleIds(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);

  const saveRoles = async () => {
    if (!user) return;
    setLoading(true);
    const currentIds = userRoles.map(ur => ur.role_id);
    const toAdd = selectedRoleIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !selectedRoleIds.includes(id));
    for (const roleId of toRemove) await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role_id', roleId);
    if (toAdd.length > 0) await supabase.from('user_roles').insert(toAdd.map(role_id => ({ user_id: user.id, role_id })));
    await refreshProfile();
    setEditingRoles(false);
    setLoading(false);
    toast('success', 'Roles updated');
  };

  const openDisciplineCount = myDisciplineRecords.filter(r => r.status !== 'resolved').length;
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const isLeaderProfile = sortedUserRoles.some(ur => ur.roles?.is_leadership);
  const profilePhoneHref = phoneHref(profile.phone);
  const billingLocked = searchParams.get('billing_locked') === '1';
  const billingStatus = organization?.billing_status || organization?.subscription_status;
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const currentYear = new Date().getFullYear();
  const joinedDate = profile.official_join_date || profile.created_at;
  const joinedLabel = format(parseISO(joinedDate), 'MMM d, yyyy');
  const joinedShortLabel = format(parseISO(joinedDate), 'MMM yyyy');
  const primaryRoleLabel = sortedUserRoles[0]?.roles?.name || 'Member';
  const profileStatusLabel = isLeaderProfile ? 'Leadership' : 'Member';
  const heroFacts = [
    { label: 'Roles', value: sortedUserRoles.length || '—' },
    { label: 'Joined', value: joinedShortLabel },
    { label: 'Status', value: profileStatusLabel },
  ];

  return (
    <div className="page-container page-bottom-pad relative">
      {/* Ambient page glow — sits behind everything */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-50 dark:opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="relative max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-5 sm:space-y-6">
        {billingLocked && billingStatus === 'suspended' && (
          <div className="rounded-[26px] border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-4 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-200">Church billing is currently suspended</p>
                <p className="text-sm text-red-700/85 dark:text-red-200/80 mt-1">
                  Access to most team areas is temporarily limited until your church admin resolves billing. You can still view your profile and sign out from here.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Editorial Identity Hero ──────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.24),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.16),transparent_36%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] p-4 shadow-[0_24px_80px_-46px_rgba(6,95,70,0.72)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)] sm:p-6">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping dark:bg-emerald-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <p className="truncate text-[10px] font-mono font-black uppercase tracking-[0.32em] text-emerald-700/75 dark:text-emerald-300/70">
                  Profile <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> {isLeaderProfile ? 'Leadership' : 'Member'}
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <button
                  onClick={() => setEditing(!editing)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black transition-all active:scale-[0.97] ${
                    editing
                      ? 'border border-black/[0.08] bg-white text-gray-600 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.08] dark:text-white/65'
                      : 'border border-white bg-white text-gray-700 shadow-sm hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70'
                  }`}
                >
                  {editing ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
                </button>
                <button
                  onClick={() => navigate('/change-password')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white bg-white px-3 text-[11px] font-black text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Password
                </button>
                <button
                  onClick={() => setEmailPanelOpen(open => !open)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white bg-white px-3 text-[11px] font-black text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  onClick={handleSignOut}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-[11px] font-black text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 active:scale-[0.97] dark:border-red-500/25 dark:bg-red-500/[0.1] dark:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            </div>

            <div className="relative mt-4 flex flex-col gap-4 sm:mt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
              <div className="flex min-w-0 items-start gap-3 sm:gap-5">
                <div className="group relative shrink-0">
                  <div
                    className="absolute -inset-[3px] rounded-[1.25rem] opacity-80 dark:opacity-90 sm:rounded-[1.45rem]"
                    style={{ background: 'conic-gradient(from 200deg, rgba(34,197,94,0.7), rgba(16,185,129,0.18), rgba(20,184,166,0.55), rgba(34,197,94,0.7))' }}
                  />
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.first_name}
                      className="relative h-16 w-16 rounded-[1.15rem] object-cover ring-4 ring-white sm:h-[104px] sm:w-[104px] sm:rounded-[1.35rem] dark:ring-[#0d0d0f]"
                    />
                  ) : (
                    <div
                      className="relative flex h-16 w-16 items-center justify-center rounded-[1.15rem] text-xl font-black text-white ring-4 ring-white sm:h-[104px] sm:w-[104px] sm:rounded-[1.35rem] sm:text-[2.4rem] dark:ring-[#0d0d0f]"
                      style={{ background: 'linear-gradient(145deg, #16a34a, #15803d)', letterSpacing: '-0.02em' }}
                    >
                      {profile.first_name[0]}{profile.last_name?.[0] || ''}
                    </div>
                  )}
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[1.15rem] bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 sm:rounded-[1.35rem]">
                    {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
                  </label>
                </div>

                <div className="min-w-0 pt-0.5">
                  <p className="truncate text-xs font-semibold text-gray-500 dark:text-white/45 sm:text-sm">{primaryRoleLabel}</p>
                  <h1
                    className="mt-1 text-[1.85rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                    style={{ letterSpacing: '-0.065em' }}
                  >
                    {fullName}
                  </h1>
                  <p className="mt-1.5 truncate text-[11px] font-mono tracking-wide text-gray-500 dark:text-white/40 sm:mt-2 sm:text-[13px]">
                    {profile.email}
                  </p>
                  {profile.nickname && (
                    <p className="mt-1 truncate text-[12px] font-bold text-emerald-700/80 dark:text-emerald-300/70">
                      Called “{profile.nickname}”
                    </p>
                  )}
                </div>
              </div>

              <div className="hidden grid-cols-3 gap-2 sm:grid sm:min-w-[23rem]">
                {heroFacts.map(item => (
                  <div key={item.label} className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
                    <p className="truncate text-lg font-black leading-none text-gray-950 dark:text-white">{item.value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {!editing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="relative mt-4 grid grid-cols-1 gap-2 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.11] min-[420px]:grid-cols-2 sm:mt-5 sm:flex sm:flex-wrap"
              >
                {[
                  { icon: profile.gender === 'male' ? '♂' : profile.gender === 'female' ? '♀' : '·', label: 'Gender', value: profile.gender === 'male' ? 'Male' : profile.gender === 'female' ? 'Female' : '—', mono: false },
                  { icon: <Phone className="h-3 w-3" />, label: 'Phone', value: profile.phone || '—', mono: true, href: profilePhoneHref },
                  { icon: <Cake className="h-3 w-3" />, label: 'Birthday', value: profile.birthday ? format(parseISO(profile.birthday), 'MMM d, yyyy') : '—', mono: false },
                  { icon: <Calendar className="h-3 w-3" />, label: 'Joined', value: joinedLabel, mono: false },
                ].map((fact, i) => (
                  <div
                    key={i}
                    className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-white bg-white pl-3 pr-3.5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] sm:h-10"
                  >
                    <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[12px] font-bold text-gray-400 dark:text-white/35">
                      {fact.icon}
                    </span>
                    <span className="hidden shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-white/35 sm:inline">{fact.label}</span>
                    {fact.href ? (
                      <a
                        href={fact.href}
                        className={`min-w-0 truncate text-[12px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300 ${fact.mono ? 'font-mono' : ''}`}
                      >
                        {fact.value}
                      </a>
                    ) : (
                      <span className={`min-w-0 truncate text-[12px] font-semibold text-gray-800 dark:text-white/85 ${fact.mono ? 'font-mono' : ''}`}>{fact.value}</span>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-1.5 sm:hidden">
              <button
                onClick={() => setEditing(!editing)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-black transition-all active:scale-[0.97] ${
                  editing
                    ? 'border border-black/[0.08] bg-white text-gray-600 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.08] dark:text-white/65'
                    : 'border border-white bg-white text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70'
                }`}
              >
                {editing ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
              </button>
              <button
                onClick={() => navigate('/change-password')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white bg-white text-[12px] font-black text-gray-700 shadow-sm active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70"
              >
                <KeyRound className="h-3.5 w-3.5" /> Password
              </button>
              <button
                onClick={() => setEmailPanelOpen(open => !open)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white bg-white text-[12px] font-black text-gray-700 shadow-sm active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-[12px] font-black text-red-600 active:scale-[0.97] dark:border-red-500/25 dark:bg-red-500/[0.1] dark:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>

          {emailPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4"
            >
              <PremiumCard className="p-5 sm:p-6">
                <form onSubmit={handleEmailUpdate} className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                        <Mail className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-base font-black text-gray-950 dark:text-white">Update email address</h2>
                        <p className="text-xs text-gray-500 dark:text-white/40">We will send a confirmation email to the new address.</p>
                      </div>
                    </div>
                    <label className="mt-4 block text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-2">
                      New email address
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="w-full h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-gray-500 dark:text-white/35">
                      Your email changes only after the confirmation link is opened.
                    </p>
                    <button
                      type="submit"
                      disabled={emailUpdating}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
                    >
                      {emailUpdating ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : 'Send confirmation'}
                    </button>
                  </div>
                </form>
              </PremiumCard>
            </motion.div>
          )}

          {/* Inline edit form */}
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mt-7"
            >
              <PremiumCard className="p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-2">Gender</label>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm({ ...form, gender: g })}
                        className={`flex-1 h-10 rounded-2xl text-[13px] font-bold transition-all border ${
                          form.gender === g
                            ? 'text-white border-transparent'
                            : 'bg-white/70 dark:bg-white/[0.04] border-black/[0.07] dark:border-white/[0.08] text-gray-600 dark:text-white/55 hover:bg-white dark:hover:bg-white/[0.07]'
                        }`}
                        style={form.gender === g ? { background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' } : undefined}
                      >
                        {g === 'male' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">First Name</label><input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input-field text-sm" /></div>
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Second Name</label><input type="text" value={form.second_name} onChange={e => setForm({ ...form, second_name: e.target.value })} className="input-field text-sm" placeholder="Optional" /></div>
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Middle Name</label><input type="text" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} className="input-field text-sm" placeholder="Optional" /></div>
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Last Name</label><input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Nickname</label><input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className="input-field text-sm" /></div>
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Phone</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Birthday</label><DatePicker value={form.birthday} onChange={v => setForm({ ...form, birthday: v })} placeholder="Select birthday" /></div>
                  <div><label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Official Join Date</label><DatePicker value={form.official_join_date} onChange={v => setForm({ ...form, official_join_date: v })} placeholder="Select join date" /></div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-5 h-10 rounded-full text-[13px] font-semibold text-white transition-all active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
                  >
                    <Save className="h-4 w-4" /> {loading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </PremiumCard>
            </motion.div>
          )}
        </motion.section>

        {/* ── 02 · Roles ──────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <SectionLabel
            action={
              !editingRoles ? (
                <button onClick={startEditingRoles} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingRoles(false)} className="text-[11px] font-semibold text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 transition-colors">Cancel</button>
                  <button
                    onClick={saveRoles}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
                  >
                    <Save className="h-3 w-3" /> {loading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )
            }
          >
            <span className="flex items-center gap-1.5"><Crown className="h-3 w-3" /> My Roles</span>
          </SectionLabel>

          <PremiumCard className="p-5 sm:p-6">
            {editingRoles ? (
              <div className="flex flex-wrap gap-2">
                {sortRolesLeadershipFirst(roles).map(role => {
                  const selected = selectedRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRoleSelection(role.id)}
                      className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-bold transition-all border ${
                        selected
                          ? role.is_leadership
                            ? 'bg-amber-50 dark:bg-amber-500/[0.18] border-amber-300 dark:border-amber-500/35 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-50 dark:bg-emerald-500/[0.18] border-emerald-300 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white/70 dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.07] text-gray-500 dark:text-white/45 hover:bg-white dark:hover:bg-white/[0.07]'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                      {role.is_leadership && <Crown className="h-3 w-3" />}
                      {role.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedUserRoles.length > 0
                  ? sortedUserRoles.map(ur => ur.roles && <RoleBadge key={ur.id} role={ur.roles} />)
                  : <p className="text-[13px] text-gray-400 dark:text-white/30 italic">No roles assigned yet</p>}
              </div>
            )}
          </PremiumCard>
        </motion.section>

        {/* ── 03 · My Ministry Status ─────────────── */}
        {accountabilitySummary && (
          <motion.section
            initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <SectionLabel
              action={
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/30">
                  Q{currentQuarter} {currentYear}
                </span>
              }
            >
              <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> My Ministry Status</span>
            </SectionLabel>

            <PremiumCard className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Overdue Proposals', value: accountabilitySummary.proposal_overdue_count, color: accountabilitySummary.proposal_overdue_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Late Proposal Submits', value: accountabilitySummary.proposal_submitted_late_count, color: accountabilitySummary.proposal_submitted_late_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Pending Assignments', value: accountabilitySummary.pending_assignment_count, color: accountabilitySummary.pending_assignment_count > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Offense Level', value: accountabilitySummary.offense_level, color: accountabilitySummary.offense_level > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Lates', value: accountabilitySummary.late_count, color: accountabilitySummary.late_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Absences', value: accountabilitySummary.absent_count, color: accountabilitySummary.absent_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Excused', value: accountabilitySummary.excused_count, color: accountabilitySummary.excused_count > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white' },
                  { label: 'Approved Leaves', value: accountabilitySummary.approved_leave_count, color: accountabilitySummary.approved_leave_count > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-gray-900 dark:text-white' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-200/80 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.03] px-3 py-3">
                    <p className={`text-xl font-black leading-none ${item.color}`} style={{ letterSpacing: '-0.04em' }}>{item.value}</p>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-white/40">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-white/40">
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.06] px-2.5 py-1 bg-white/70 dark:bg-white/[0.03]">
                  {accountabilitySummary.events_assigned} assigned events
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.06] px-2.5 py-1 bg-white/70 dark:bg-white/[0.03]">
                  {accountabilitySummary.present_count} present marks
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.06] px-2.5 py-1 bg-white/70 dark:bg-white/[0.03]">
                  {accountabilitySummary.pending_leave_count} pending leave requests
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/[0.06] px-2.5 py-1 bg-white/70 dark:bg-white/[0.03]">
                  {accountabilitySummary.open_discipline_count} open discipline items
                </span>
              </div>
            </PremiumCard>
          </motion.section>
        )}

        {/* ── 04 · My Discipline (non-leaders only) ─ */}
        {!isLeader && (
          <motion.section
            initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <SectionLabel
              action={openDisciplineCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-md bg-red-50 dark:bg-red-500/[0.18] text-red-600 dark:text-red-400 text-[10px] font-black border border-red-200 dark:border-red-500/25">
                  {openDisciplineCount} OPEN
                </span>
              ) : undefined}
            >
              <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> My Conduct Record</span>
            </SectionLabel>

            <PremiumCard>
              {myDisciplineRecords.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div
                    className="relative h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 3px 12px rgba(22,163,74,0.3)' }}
                  >
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Clean record</p>
                  <p className="text-[12px] text-gray-400 dark:text-white/30 mt-1">Keep up the great work!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-sky-50/60 dark:bg-sky-500/[0.06] border-b border-sky-100 dark:border-sky-500/15">
                    <Eye className="h-3.5 w-3.5 text-sky-500 mt-0.5 shrink-0" />
                    <p className="text-[12px] text-sky-700 dark:text-sky-300 leading-relaxed">
                      This is your personal record. Leadership will speak with you about any open items.
                    </p>
                  </div>
                  <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {myDisciplineRecords.map(record => {
                      const sCfg = disciplineStatusConfig[record.status] || disciplineStatusConfig.open;
                      const isExp = disciplineExpanded === record.id;
                      return (
                        <div key={record.id}>
                          <button onClick={() => setDisciplineExpanded(isExp ? null : record.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.015em' }}>{record.title}</p>
                              <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-0.5 tracking-wide">{format(parseISO(record.created_at), 'MMM d, yyyy')}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${sCfg.color}`}>
                              <sCfg.icon className="h-3 w-3" />{sCfg.label}
                            </span>
                            <div className={`flex items-center justify-center w-7 h-7 rounded-xl shrink-0 transition-all ${isExp ? 'bg-gray-100 dark:bg-white/[0.06] rotate-180' : ''}`}>
                              <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-white/35" />
                            </div>
                          </button>
                          {isExp && (
                            <div className="px-5 pb-4 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] bg-gray-50/40 dark:bg-white/[0.01]">
                              {record.notes && (
                                <>
                                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-1.5">Details</p>
                                  <p className="text-[13px] text-gray-700 dark:text-white/65 whitespace-pre-wrap leading-relaxed">{record.notes}</p>
                                </>
                              )}
                              {record.final_decision && (
                                <div className="mt-3">
                                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-1.5">Final Decision</p>
                                  <p className="text-[13px] text-gray-700 dark:text-white/65 leading-relaxed">{record.final_decision}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </PremiumCard>
          </motion.section>
        )}

        {/* ── Push Notifications ──────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <PushNotificationSetting />
        </motion.section>

      </div>
    </div>
  );
}
