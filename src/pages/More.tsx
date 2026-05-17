import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Activity, Users, Bell, LogOut, Shield, BookOpen, Video, Calendar, ChevronRight, ListChecks, RefreshCw, Plus, Trash2, Eye, EyeOff, UserPlus, Sparkles, Layers3, CheckCircle2, ArrowLeftRight, AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { APP_UPDATE_VERSION, APP_VERSION_LABEL } from '../lib/appUpdate';
import { getInstalledAppVersion } from '../lib/serviceWorkerUpdate';
import {
  fetchMobileNavStylePreference,
  getDefaultMobileNavStyle,
  getStoredMobileNavStyle,
  saveMobileNavStylePreference,
  type MobileNavStyle,
} from '../lib/mobileNavPreference';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

interface MoreMenuItem {
  icon: LucideIcon;
  label: string;
  desc: string;
  path: string | null;
  show: boolean;
  action: (() => void) | null;
  badge: number;
  color: string;
  badgeVariant?: 'red' | 'amber';
}

export function More() {
  const { user, profile, isLeader, isOrgAdmin, isPlatformOwner, canApproveLeave, canManageDiscipline, signOut, savedAccounts, addSavedAccount, switchAccount, forgetSavedAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const unread = useUnreadCounts();
  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);
  const [savingNavStyle, setSavingNavStyle] = useState(false);
  const [installedAppVersion, setInstalledAppVersion] = useState<string | null>(getInstalledAppVersion);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccountEmail, setAddAccountEmail] = useState('');
  const [addAccountPassword, setAddAccountPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [switchingAccountMeta, setSwitchingAccountMeta] = useState<{ id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    fetchMobileNavStylePreference(user.id).then((style) => {
      if (!cancelled && style) setMobileNavStyle(style);
    });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    setInstalledAppVersion(getInstalledAppVersion());
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleMobileNavStyleChange = async (style: MobileNavStyle) => {
    if (!user?.id || style === mobileNavStyle) return;

    setSavingNavStyle(true);
    try {
      await saveMobileNavStylePreference(user.id, style);
      setMobileNavStyle(style);
      toast('success', `Navigation style set to ${style === 'floating' ? 'Floating' : 'Docked'}`);
    } catch {
      toast('error', 'Failed to save navigation style');
    } finally {
      setSavingNavStyle(false);
    }
  };

  const handleSwitchAccount = async (targetUserId: string) => {
    if (targetUserId === user?.id) return;

    const targetAccount = savedAccounts.find(account => account.userId === targetUserId);
    if (!targetAccount) {
      toast('error', 'Saved account not found');
      return;
    }

    setSwitchingAccountId(targetUserId);
    setSwitchingAccountMeta({
      id: targetAccount.userId,
      name: targetAccount.displayName,
      email: targetAccount.email,
    });
    const { error } = await switchAccount(targetUserId);

    if (error) {
      setSwitchingAccountId(null);
      setSwitchingAccountMeta(null);
      toast('error', error.message);
      return;
    }

    toast('success', 'Account switched');
    window.setTimeout(() => {
      setSwitchingAccountId(null);
      setSwitchingAccountMeta(null);
      navigate('/dashboard');
    }, 1500);
  };

  const handleAddAnotherAccount = async () => {
    setAddAccountEmail('');
    setAddAccountPassword('');
    setShowAddPassword(false);
    setShowAddAccountModal(true);
  };

  const handleSaveAnotherAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAccountEmail.trim() || !addAccountPassword) return;

    setAddAccountLoading(true);
    const { error } = await addSavedAccount(addAccountEmail, addAccountPassword);
    setAddAccountLoading(false);

    if (error) {
      toast('error', error.message);
      return;
    }

    setShowAddAccountModal(false);
    setAddAccountEmail('');
    setAddAccountPassword('');
    setShowAddPassword(false);
    toast('success', 'Account saved on this device');
  };

  const menuItems: MoreMenuItem[] = [
    { icon: Activity,    label: 'Activity Log',         desc: 'Church activity',       path: '/activity-log',       show: isPlatformOwner,         action: null,                              badge: 0,                    color: '#0ea5e9' },
    { icon: BookOpen,    label: 'Songs',               desc: 'Song library and chord charts', path: '/songs',       show: true,                    action: null,                              badge: 0,                    color: '#16a34a' },
    { icon: Video,       label: 'Videos',              desc: 'Training and reference videos', path: '/videos',      show: true,                    action: null,                              badge: 0,                    color: '#0ea5e9' },
    { icon: ListChecks,  label: 'Sets',                desc: 'Past event sets', path: '/sets',                       show: true,                    action: null,                              badge: 0,                    color: '#10b981' },
    { icon: Calendar,    label: 'Request Leave',        desc: 'Submit unavailability',  path: '/request-leave',      show: true,                    action: null,                              badge: 0,                    color: '#f59e0b' },
    { icon: Bell,        label: 'Notifications',        desc: 'View all notifications', path: '/notifications',      show: true,                    action: null,                              badge: 0,                    color: '#ec4899' },
  ].filter(item => item.show);

  const leadershipItems: MoreMenuItem[] = [
    { icon: ListChecks, label: 'Approve Setlist', desc: 'Review submitted setlists', path: '/leadership/setlists', show: isLeader, action: null, badge: unread.pendingSetlists, color: '#16a34a', badgeVariant: 'red' },
    { icon: Calendar, label: 'Approve Leave', desc: 'Review leave requests', path: '/leadership/leave', show: !!canApproveLeave, action: null, badge: unread.pendingLeave, color: '#f59e0b', badgeVariant: 'red' },
    { icon: ArrowLeftRight, label: 'Approve Swaps', desc: 'Review swap requests', path: '/leadership/swaps', show: isLeader, action: null, badge: unread.pendingSwaps, color: '#0ea5e9', badgeVariant: 'red' },
    { icon: AlertTriangle, label: 'Conduct', desc: 'Discipline and records', path: '/leadership/discipline', show: isLeader || !!canManageDiscipline, action: null, badge: 0, color: '#f97316' },
    { icon: Users, label: 'Team', desc: 'Manage team members', path: '/leadership/team', show: isLeader || isOrgAdmin, action: null, badge: 0, color: '#8b5cf6' },
  ].filter(item => item.show);

  const displayName = profile?.nickname || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const pwaVersionLabel = installedAppVersion ? `v${installedAppVersion}` : 'Unavailable';
  const versionMatches = installedAppVersion === null || installedAppVersion === APP_UPDATE_VERSION;

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-lg mx-auto px-1 sm:px-2 pt-6 sm:pt-8 space-y-4 sm:space-y-5">

        {/* ── Profile Hero Card ─────────────────────────── */}
        <motion.button
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate('/profile')}
          className="relative w-full rounded-3xl p-4 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] active:scale-[0.99] transition-all duration-150 group"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar
                src={profile?.avatar_url}
                firstName={profile?.first_name || '?'}
                lastName={profile?.last_name}
                size="md"
                className="rounded-2xl ring-2 ring-black/[0.06] dark:ring-white/[0.08]"
              />
              {isLeader && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center bg-emerald-500 ring-2 ring-white dark:ring-[#0d0d0f]">
                  <Shield className="h-2 w-2 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">
                {isLeader ? 'Leader' : 'Member'}
              </p>
              <h2 className="text-[15px] font-black text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {displayName}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-white/40 truncate font-mono">{profile?.email}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/40 transition-colors" />
              <button
                onClick={e => { e.stopPropagation(); handleSignOut(); }}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/[0.1] border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/[0.16] active:scale-95 transition-all"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.button>

        {/* ── Menu Grid 3×N ────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-2"
        >
          {menuItems.map((item, index) => (
            <motion.button
              key={item.path || index}
              variants={itemVariants}
              onClick={() => item.action ? item.action() : navigate(item.path!)}
              className="relative group flex flex-col items-center gap-2 px-2 py-4 rounded-2xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.1] active:scale-[0.96] transition-all duration-150"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -8px rgba(15,23,42,0.08)' }}
            >
              <div
                className="relative h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${item.color}18`, border: `1px solid ${item.color}28` }}
              >
                <item.icon className="h-[18px] w-[18px]" style={{ color: item.color }} />
                {item.badge > 0 && (
                  <span className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                    item.badgeVariant === 'red'
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-400 dark:bg-amber-400/90 text-amber-950'
                  }`}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-gray-700 dark:text-white/75 text-center leading-tight" style={{ letterSpacing: '-0.01em' }}>
                {item.label}
              </p>
            </motion.button>
          ))}
        </motion.div>

        {leadershipItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
            className="relative rounded-3xl p-5 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />
            <div className="space-y-3.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">Leadership</p>
                <h3 className="text-[16px] font-black text-gray-900 dark:text-white mt-1" style={{ letterSpacing: '-0.025em' }}>Open each leadership page directly.</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {leadershipItems.map((item) => (
                  <button
                    key={item.path || item.label}
                    onClick={() => item.action ? item.action() : navigate(item.path!)}
                    className="relative group flex items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.06] hover:bg-gray-100/90 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.1] active:scale-[0.98] transition-all duration-150"
                  >
                    <div
                      className="relative h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: `${item.color}18`, border: `1px solid ${item.color}28` }}
                    >
                      <item.icon className="h-[18px] w-[18px]" style={{ color: item.color }} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-gray-900 dark:text-white leading-tight">{item.label}</span>
                      <span className="mt-1 block text-[10px] font-semibold text-gray-500 dark:text-white/40 leading-snug">{item.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="relative rounded-3xl p-5 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="space-y-3.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">Mobile Navigation</p>
              <h3 className="text-[16px] font-black text-gray-900 dark:text-white mt-1" style={{ letterSpacing: '-0.025em' }}>Choose your mobile nav look.</h3>
              <p className="text-[12px] text-gray-500 dark:text-white/40 mt-1.5 leading-snug">
                Floating works like iOS. Docked sits flush at the bottom like Android.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'floating', label: 'Floating', hint: 'iOS-style pill' },
                { id: 'docked', label: 'Docked', hint: 'Attached bottom bar' },
              ] as const).map((option) => {
                const active = mobileNavStyle === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleMobileNavStyleChange(option.id)}
                    disabled={savingNavStyle}
                    className={`rounded-3xl border px-4 py-4 text-left transition-all ${active
                      ? 'border-emerald-400/50 bg-emerald-50 dark:bg-emerald-500/[0.12] shadow-[0_8px_24px_-16px_rgba(16,185,129,0.35)]'
                      : 'border-gray-200/80 dark:border-white/[0.06] bg-gray-50/70 dark:bg-white/[0.03] hover:bg-gray-100/80 dark:hover:bg-white/[0.05]'
                    } ${savingNavStyle ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white">{option.label}</p>
                        <p className="text-[11px] text-gray-500 dark:text-white/40 mt-1">{option.hint}</p>
                      </div>
                      {active && (
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-gray-500 dark:text-white/38">
              Current default: {getDefaultMobileNavStyle() === 'floating' ? 'Floating' : 'Docked'}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="relative rounded-3xl p-5 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="space-y-3.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">Account Switcher</p>
              <h3 className="text-[16px] font-black text-gray-900 dark:text-white mt-1" style={{ letterSpacing: '-0.025em' }}>Jump between saved accounts.</h3>
              <p className="text-[12px] text-gray-500 dark:text-white/40 mt-1.5 leading-snug">
                Sign into each account on this device once. After that, you can switch here without typing the password again.
              </p>
            </div>

            <div className="space-y-2">
              {savedAccounts.map((account) => {
                const isCurrent = account.userId === user?.id;
                const isSwitching = switchingAccountId === account.userId;

                return (
                  <div
                    key={account.userId}
                    className="flex items-center gap-3 rounded-2xl border border-gray-200/80 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.03] px-3 py-3"
                  >
                    <Avatar
                      src={account.avatarUrl}
                      firstName={account.displayName || account.email || '?'}
                      size="sm"
                      className="rounded-xl"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-gray-900 dark:text-white">{account.displayName}</p>
                      <p className="truncate text-[11px] font-mono text-gray-500 dark:text-white/40">{account.email}</p>
                    </div>

                    {isCurrent ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        Current
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={isSwitching}
                        className="shrink-0 inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/[0.12] dark:text-emerald-300 dark:hover:bg-emerald-500/[0.18]"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
                        Switch
                      </button>
                    )}

                    <button
                      onClick={() => forgetSavedAccount(account.userId)}
                      className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:text-red-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/30 dark:hover:text-red-400"
                      title="Forget saved account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleAddAnotherAccount}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-[12px] font-bold text-gray-700 transition-all hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/75 dark:hover:bg-white/[0.05]"
            >
              <Plus className="h-4 w-4" />
              Save another account on this device
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="relative rounded-3xl p-5 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">App Version</p>
              <h3 className="mt-1 text-[16px] font-black text-gray-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
                {APP_VERSION_LABEL}
              </h3>
              <p className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-white/40">
                Installed PWA version: {pwaVersionLabel}
              </p>
            </div>

            <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
              versionMatches
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/[0.12] dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/[0.12] dark:text-amber-300'
            }`}
            >
              {versionMatches ? 'PWA is up to date' : 'Update required'}
            </div>
          </div>
        </motion.div>

      </div>

      <Modal
        open={showAddAccountModal}
        onClose={() => { if (!addAccountLoading) setShowAddAccountModal(false); }}
        title="Save Account"
        size="md"
        closeOnBackdrop={!addAccountLoading}
        bodyClassName="px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-[24px] font-black tracking-[-0.03em] text-gray-900 dark:text-white">Add another login without leaving More.</h3>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-gray-500 dark:text-white/45">
              Enter the second account once. It will be saved on this device so you can switch back here anytime.
            </p>
          </div>

          <form onSubmit={handleSaveAnotherAccount} className="space-y-4">
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-emerald-900 dark:text-emerald-200">Your current account stays active.</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/75 dark:text-emerald-200/65">
                    This only stores the other account on this device. It does not log you out of the one you are using now.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-white/35">
                Email address
              </label>
              <input
                type="email"
                value={addAccountEmail}
                onChange={e => setAddAccountEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px] text-gray-900 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-white/35">
                Password
              </label>
              <div className="relative">
                <input
                  type={showAddPassword ? 'text' : 'password'}
                  value={addAccountPassword}
                  onChange={e => setAddAccountPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 text-[14px] text-gray-900 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                  placeholder="Enter the account password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-gray-400 transition-colors hover:text-gray-600 dark:text-white/30 dark:hover:text-white/55"
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={addAccountLoading || !addAccountEmail.trim() || !addAccountPassword}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[13px] font-black text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.55)] transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {addAccountLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save account on this device
                </>
              )}
            </button>
          </form>
        </div>
      </Modal>

      <AnimatePresence>
        {switchingAccountMeta && (
          <motion.div
            key={switchingAccountMeta.id}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-white px-6 text-center dark:bg-[#0c0f0d]"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 1.01 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative w-full max-w-sm">
              <motion.div
                aria-hidden="true"
                className="absolute left-1/2 top-6 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
                animate={{ scale: [0.86, 1.16, 0.98], opacity: [0.18, 0.5, 0.26] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border border-emerald-500/15"
                  animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.36, 0.7, 0.36] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-4 rounded-full border border-dashed border-emerald-500/20 dark:border-emerald-300/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute -left-2 top-[3.7rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/15 dark:bg-white/[0.08] dark:text-emerald-200"
                  animate={{ y: [0, -8, 0], opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers3 className="h-4 w-4" />
                </motion.div>
                <motion.div
                  aria-hidden="true"
                  className="absolute -right-2 top-[3.7rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/15 dark:bg-white/[0.08] dark:text-emerald-200"
                  animate={{ y: [0, 8, 0], opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
                <motion.div
                  className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-600/30"
                  animate={{ y: [0, -7, 0], rotate: [0, -1.5, 1.5, 0], borderRadius: ['2rem', '2.35rem', '2rem'] }}
                  transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_42%,rgba(255,255,255,0.1))]"
                    animate={{ opacity: [0.28, 0.72, 0.36] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <RefreshCw className="relative h-9 w-9" />
                </motion.div>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
                Switching Account
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-gray-950 dark:text-white">
                Moving into {switchingAccountMeta.name}.
              </h2>
              <p className="mx-auto mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-gray-500 dark:text-white/50">
                Loading your dashboard, permissions, and live data for
                <span className="block">{switchingAccountMeta.email}.</span>
              </p>

              <div className="mt-6 grid gap-2">
                {[
                  { label: 'Updating session', detail: 'Swapping secure auth tokens', icon: RefreshCw },
                  { label: 'Loading profile', detail: switchingAccountMeta.name, icon: UserPlus },
                  { label: 'Refreshing workspace', detail: 'Roles, org, and realtime state', icon: Layers3 },
                ].map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <motion.div
                      key={step.label}
                      className="flex items-center gap-3 rounded-2xl border border-emerald-500/10 bg-white/70 px-3 py-2 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: [0.68, 1, 0.78], y: 0 }}
                      transition={{
                        opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.42 },
                        y: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 },
                      }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-emerald-400/10 dark:text-emerald-200">
                        <StepIcon className={`h-3.5 w-3.5 ${step.label === 'Updating session' ? 'animate-spin' : ''}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-black text-gray-900 dark:text-white">{step.label}</span>
                        <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-white/45">{step.detail}</span>
                      </span>
                      <motion.span
                        className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.75)]"
                        animate={{ scale: [0.7, 1.25, 0.7], opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.32 }}
                      />
                    </motion.div>
                  );
                })}
              </div>

              <div className="relative mt-6 h-4 overflow-hidden rounded-full bg-gray-200/80 p-1 dark:bg-white/10">
                <motion.div
                  className="relative h-full w-full origin-left overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.35, ease: 'linear' }}
                >
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-20 rounded-full bg-white/45 blur-sm"
                    initial={{ x: '-120%' }}
                    animate={{ x: ['-120%', '620%'] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </div>
              <p className="mt-3 text-[11px] font-bold text-emerald-700/70 dark:text-emerald-200/55">
                Preparing everything before the workspace opens...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
