import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Pencil, Save, LogOut, Bell, BellOff, X, Check, Crown,
  Camera, Loader2, Shield, ChevronDown, ChevronUp, Clock,
  MessageSquare, XCircle, CheckCircle, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DatePicker } from '../components/DatePicker';
import { PageLoader } from '../components/LoadingSpinner';
import { RoleBadge, sortRolesLeadershipFirst } from '../components/RoleBadge';
import type { DisciplineRecord } from '../types';

const disciplineStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Open', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', icon: Clock },
  verbal_warning: { label: 'Verbal Warning', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', icon: MessageSquare },
  counselling: { label: 'Counselling', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', icon: MessageSquare },
  suspension: { label: 'Suspended', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', icon: XCircle },
  resolved: { label: 'Resolved', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', icon: CheckCircle },
};

function SectionCard({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
        {icon && <span className="text-gray-400 dark:text-gray-500 shrink-0">{icon}</span>}
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Profile() {
  const { user, profile, userRoles, roles, signOut, refreshProfile, isLeader } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editingRoles, setEditingRoles] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '', second_name: '', middle_name: '', last_name: '', nickname: '', phone: '', gender: '', birthday: '',
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [myDisciplineRecords, setMyDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [disciplineExpanded, setDisciplineExpanded] = useState<string | null>(null);

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
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const checkPushStatus = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub && Notification.permission === 'granted');
        } catch { setPushEnabled(false); }
      } else { setPushEnabled(false); }
    };
    checkPushStatus();
  }, [user]);

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

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', user.id);
    setLoading(false);
    if (error) { toast('error', 'Failed to save'); return; }
    toast('success', 'Profile updated');
    setEditing(false);
    refreshProfile();
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone);

  const togglePush = async () => {
    if (!user) return;
    setPushLoading(true);
    if (!pushEnabled) {
      try {
        if (!('serviceWorker' in navigator)) { toast('error', 'Service workers not supported'); setPushLoading(false); return; }
        if (!('PushManager' in window)) {
          isIos() && !isStandalone() ? toast('error', 'On iOS, add to Home Screen first.') : toast('error', 'Push not supported in this browser');
          setPushLoading(false); return;
        }
        if (!('Notification' in window)) { toast('error', 'Notifications unavailable'); setPushLoading(false); return; }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { toast('error', 'Permission denied. Enable in settings.'); setPushLoading(false); return; }
        const reg = await navigator.serviceWorker.ready;
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) { toast('error', 'Push not configured'); setPushLoading(false); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
        const subJson = sub.toJSON();
        await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: subJson.endpoint || '', p256dh: subJson.keys?.p256dh || '', auth_key: subJson.keys?.auth || '' }, { onConflict: 'user_id,endpoint' });
        setPushEnabled(true);
        toast('success', 'Push notifications enabled');
      } catch (err) {
        toast('error', err instanceof Error ? err.message : 'Failed to enable');
      }
    } else {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await sub.unsubscribe(); await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', sub.endpoint); }
        setPushEnabled(false);
        toast('info', 'Push notifications disabled');
      } catch { toast('error', 'Failed to disable'); }
    }
    setPushLoading(false);
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

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-7 pb-6 space-y-4">

        {/* ── Identity Hero ─────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] animate-fade-in" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)' }} />
          <div className="px-5 pb-5 pt-0 -mt-8">
            <div className="flex items-end justify-between gap-3">
              <div className="relative group shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.first_name} className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white dark:ring-[#1a1a1c]" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-2xl font-black ring-4 ring-white dark:ring-[#1a1a1c]" style={{ letterSpacing: '-0.02em' }}>
                    {profile.first_name[0]}{profile.last_name?.[0] || ''}
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {avatarUploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
                </label>
              </div>
              <div className="flex items-center gap-2 mb-1 shrink-0">
                <button onClick={() => setEditing(!editing)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ring-1 ${editing ? 'bg-gray-100 dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-300' : 'bg-white dark:bg-[#232325] ring-black/[0.07] dark:ring-white/[0.08] text-gray-700 dark:text-gray-300 hover:ring-black/[0.1]'}`}>
                  {editing ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
                </button>
                <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all">
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            </div>
            <div className="mt-3">
              <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
                {profile.first_name} {profile.last_name}
                {profile.nickname && <span className="text-gray-400 dark:text-gray-500 font-normal text-base"> "{profile.nickname}"</span>}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{profile.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {sortedUserRoles.map(ur => ur.roles && <RoleBadge key={ur.id} role={ur.roles} />)}
                {sortedUserRoles.length === 0 && <span className="text-xs text-gray-400">No roles assigned</span>}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Member since {format(parseISO(profile.created_at), 'MMMM yyyy')}</p>
            </div>
          </div>

          {editing && (
            <div className="border-t border-black/[0.04] dark:border-white/[0.05] px-5 py-5 space-y-4 bg-gray-50/50 dark:bg-white/[0.01]">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Gender</label>
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setForm({ ...form, gender: g })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ring-1 ${form.gender === g ? 'bg-brand-600 ring-brand-600 text-white' : 'bg-white dark:bg-[#232325] ring-black/[0.07] dark:ring-white/[0.08] text-gray-600 dark:text-gray-400 hover:ring-brand-400'}`}>
                      {g === 'male' ? 'Brother' : 'Sister'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">First Name</label><input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Second Name</label><input type="text" value={form.second_name} onChange={e => setForm({ ...form, second_name: e.target.value })} className="input-field text-sm" placeholder="Optional" /></div>
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Middle Name</label><input type="text" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} className="input-field text-sm" placeholder="Optional" /></div>
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last Name</label><input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="input-field text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nickname</label><input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Birthday</label><DatePicker value={form.birthday} onChange={v => setForm({ ...form, birthday: v })} placeholder="Select birthday" /></div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleSave} disabled={loading} className="btn-primary text-sm">
                  <Save className="h-4 w-4" /> {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <div className="border-t border-black/[0.04] dark:border-white/[0.05] px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50/40 dark:bg-white/[0.01]">
              {[
                { label: 'Gender', value: profile.gender === 'male' ? 'Brother' : profile.gender === 'female' ? 'Sister' : '--' },
                { label: 'Phone', value: profile.phone || '--' },
                { label: 'Birthday', value: profile.birthday ? format(parseISO(profile.birthday), 'MMMM d') : '--' },
                { label: 'Member Since', value: format(parseISO(profile.created_at), 'MMMM yyyy') },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── My Roles ─────────────────────────────── */}
        <SectionCard
          title="My Roles"
          icon={<Crown className="h-4 w-4" />}
          action={
            !editingRoles ? (
              <button onClick={startEditingRoles} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingRoles(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
                <button onClick={saveRoles} disabled={loading} className="btn-primary text-xs py-1 px-2.5">
                  <Save className="h-3 w-3" /> {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )
          }
        >
          <div className="p-5">
            {editingRoles ? (
              <div className="flex flex-wrap gap-2">
                {sortRolesLeadershipFirst(roles).map(role => (
                  <button key={role.id} type="button" onClick={() => toggleRoleSelection(role.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ring-1 ${
                      selectedRoleIds.includes(role.id)
                        ? role.is_leadership
                          ? 'bg-amber-50 dark:bg-amber-900/20 ring-amber-300 dark:ring-amber-700 text-amber-700 dark:text-amber-300'
                          : 'bg-brand-50 dark:bg-brand-900/20 ring-brand-300 dark:ring-brand-700 text-brand-700 dark:text-brand-300'
                        : 'bg-white dark:bg-[#232325] ring-black/[0.06] dark:ring-white/[0.07] text-gray-500 dark:text-gray-400 hover:ring-black/[0.1]'
                    }`}
                  >
                    {selectedRoleIds.includes(role.id) && <Check className="h-3 w-3" />}
                    {role.is_leadership && <Crown className="h-3 w-3" />}
                    {role.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedUserRoles.length > 0
                  ? sortedUserRoles.map(ur => ur.roles && <RoleBadge key={ur.id} role={ur.roles} />)
                  : <p className="text-sm text-gray-400">No roles assigned yet</p>}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── My Discipline (non-leaders only) ─────── */}
        {!isLeader && (
          <SectionCard
            title="My Discipline Record"
            icon={<Shield className="h-4 w-4" />}
            action={openDisciplineCount > 0 ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                {openDisciplineCount} open
              </span>
            ) : undefined}
          >
            {myDisciplineRecords.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Clean record</p>
                <p className="text-xs text-gray-400 mt-0.5">Keep up the great work!</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2.5 px-5 py-3 bg-blue-50/60 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
                  <Eye className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">This is your personal record. Leadership will speak with you about any open items.</p>
                </div>
                <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                  {myDisciplineRecords.map(record => {
                    const sCfg = disciplineStatusConfig[record.status] || disciplineStatusConfig.open;
                    const isExp = disciplineExpanded === record.id;
                    return (
                      <div key={record.id}>
                        <button onClick={() => setDisciplineExpanded(isExp ? null : record.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{record.title}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{format(parseISO(record.created_at), 'MMM d, yyyy')}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl font-semibold shrink-0 ${sCfg.color}`}>
                            <sCfg.icon className="h-3 w-3" />{sCfg.label}
                          </span>
                          {isExp ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                        </button>
                        {isExp && (
                          <div className="px-5 pb-4 pt-2 bg-gray-50/50 dark:bg-white/[0.01] border-t border-black/[0.03] dark:border-white/[0.04]">
                            {record.notes && (
                              <>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Details</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{record.notes}</p>
                              </>
                            )}
                            {record.final_decision && (
                              <div className="mt-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Final Decision</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{record.final_decision}</p>
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
          </SectionCard>
        )}

        {/* ── Push Notifications ───────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-4 px-5 py-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${pushEnabled ? 'bg-brand-50 dark:bg-brand-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {pushEnabled ? <Bell className="h-5 w-5 text-brand-600 dark:text-brand-400" /> : <BellOff className="h-5 w-5 text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pushEnabled
                  ? 'Enabled — you will receive push notifications'
                  : !('PushManager' in window) && isIos() && !isStandalone()
                    ? 'Add to Home Screen to enable'
                    : 'Tap Enable to receive notifications'}
              </p>
            </div>
            <button onClick={togglePush} disabled={pushLoading}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ring-1 ${pushEnabled ? 'bg-gray-100 dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200' : 'bg-brand-600 ring-brand-600 text-white hover:bg-brand-700'}`}>
              {pushLoading ? 'Processing...' : pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
