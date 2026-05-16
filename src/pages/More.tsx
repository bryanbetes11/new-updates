import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Activity, Users, Bell, LogOut, Shield, Library, Calendar, ClipboardCheck, ChevronRight, ListChecks,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';
import { AttendanceGuideModal } from '../components/AttendanceGuideModal';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
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
  const { user, profile, isLeader, isOrgAdmin, isPlatformOwner, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const unread = useUnreadCounts();
  const [showRequestLeave, setShowRequestLeave] = useState(false);
  const [showAttendanceGuide, setShowAttendanceGuide] = useState(false);
  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);
  const [savingNavStyle, setSavingNavStyle] = useState(false);
  const [installedAppVersion, setInstalledAppVersion] = useState<string | null>(getInstalledAppVersion);

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

  const menuItems: MoreMenuItem[] = [
    { icon: Activity,    label: 'Activity Log',         desc: 'Church activity',       path: '/activity-log',       show: isPlatformOwner,         action: null,                              badge: 0,                    color: '#0ea5e9' },
    { icon: Library,     label: 'Library',             desc: 'Songs, chord charts, and videos', path: '/library',    show: true,                    action: null,                              badge: 0,                    color: '#16a34a' },
    { icon: ListChecks,  label: 'Sets',                desc: 'Past event sets', path: '/sets',                       show: true,                    action: null,                              badge: 0,                    color: '#10b981' },
    { icon: Calendar,    label: 'Request Leave',        desc: 'Submit unavailability',  path: null,                  show: true,                    action: () => setShowRequestLeave(true),    badge: 0,                    color: '#f59e0b' },
    { icon: ClipboardCheck, label: 'Attendance Guide',  desc: 'How tracking works',     path: null,                  show: true,                    action: () => setShowAttendanceGuide(true), badge: 0,                    color: '#0ea5e9' },
    { icon: Bell,        label: 'Notifications',        desc: 'View all notifications', path: '/notifications',      show: true,                    action: null,                              badge: 0,                    color: '#ec4899' },
    { icon: Users,       label: 'Leadership',           desc: isOrgAdmin && !isLeader ? 'Church admin tools' : 'Team management tools', path: isOrgAdmin && !isLeader ? '/leadership/church' : '/leadership/overview', show: isLeader || isOrgAdmin, action: null, badge: unread.pendingLeave, color: '#f97316' },
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
                  <span className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ring-1 ring-white dark:ring-[#0d0d0f] ${
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

      <AttendanceGuideModal open={showAttendanceGuide} onClose={() => setShowAttendanceGuide(false)} />
      <LeaveRequestModal open={showRequestLeave} onClose={() => setShowRequestLeave(false)} />
    </div>
  );
}
