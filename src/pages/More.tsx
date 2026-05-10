import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  User, Users, Bell, LogOut, Shield, Library, Calendar, ClipboardCheck, ChevronRight, LockKeyhole,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';
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

  const menuItems = [
    { icon: LockKeyhole, label: 'Platform Management', desc: 'Owner dashboard', path: '/platform', show: isPlatformOwner, action: null, badge: 0, color: '#0f172a', glow: 'rgba(15,23,42,0.24)' },
    { icon: Library, label: 'Library', desc: 'Browse songs and setlists', path: '/library', show: true, action: null, badge: 0, color: '#16a34a', glow: 'rgba(22,163,74,0.3)' },
    { icon: Calendar, label: 'Request Leave', desc: 'Submit unavailability', path: null, show: true, action: () => setShowRequestLeave(true), badge: 0, color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
    { icon: ClipboardCheck, label: 'Attendance Guide', desc: 'How tracking works', path: null, show: true, action: () => setShowAttendanceGuide(true), badge: 0, color: '#0ea5e9', glow: 'rgba(14,165,233,0.3)' },
    { icon: User, label: 'Profile', desc: 'Edit your info & avatar', path: '/profile', show: true, action: null, badge: 0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
    { icon: Bell, label: 'Notifications', desc: 'View all notifications', path: '/notifications', show: true, action: null, badge: 0, color: '#ec4899', glow: 'rgba(236,72,153,0.3)' },
    { icon: Users, label: 'Leadership', desc: isOrgAdmin && !isLeader ? 'Church admin tools' : 'Team management tools', path: isOrgAdmin && !isLeader ? '/leadership/church' : '/leadership/overview', show: isLeader || isOrgAdmin, action: null, badge: unread.pendingLeave, color: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  ].filter(item => item.show);

  const displayName = profile?.nickname || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const pwaVersionLabel = installedAppVersion ? `v${installedAppVersion}` : 'Unavailable';
  const versionMatches = installedAppVersion === null || installedAppVersion === APP_UPDATE_VERSION;

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-lg mx-auto px-1 sm:px-2 pt-6 sm:pt-8 space-y-4 sm:space-y-5">

        {/* ── Profile Hero Card ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl p-5 bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          {/* Subtle top highlight */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar
                src={profile?.avatar_url}
                firstName={profile?.first_name || '?'}
                lastName={profile?.last_name}
                size="lg"
                className="rounded-2xl ring-2 ring-black/[0.06] dark:ring-white/[0.08]"
              />
              {isLeader && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center bg-emerald-500 ring-2 ring-white dark:ring-[#0d0d0f]">
                  <Shield className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-white/35 mb-0.5">
                {isLeader ? 'Leader' : 'Member'}
              </p>
              <h2 className="text-[18px] font-black text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.025em' }}>
                {displayName}
              </h2>
              <p className="text-[12px] text-gray-500 dark:text-white/40 truncate mt-0.5 font-mono">{profile?.email}</p>
            </div>

            <div className="flex flex-col items-center gap-2.5 shrink-0">
              <div className="hidden lg:block"><ThemeToggle /></div>
              <button
                onClick={handleSignOut}
                className="h-9 w-9 rounded-2xl flex items-center justify-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/[0.1] border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/[0.16] active:scale-95 transition-all"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Menu Grid ────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3"
        >
          {menuItems.map((item, index) => (
            <motion.button
              key={item.path || index}
              variants={itemVariants}
              onClick={() => item.action ? item.action() : navigate(item.path!)}
              className="relative group p-4 text-left rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-200 hover:-translate-y-px active:scale-[0.97] overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -8px rgba(15,23,42,0.08)' }}
            >
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />

              <div className="flex flex-col gap-3">
                <div className="relative flex items-center justify-center h-11 w-11 rounded-2xl shrink-0"
                  style={{ background: `linear-gradient(145deg, ${item.color}22, ${item.color}11)`, border: `1px solid ${item.color}30` }}
                >
                  <item.icon className="h-5 w-5" style={{ color: item.color }} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-black leading-none shadow-sm">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>{item.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-white/40 leading-snug mt-0.5">{item.desc}</p>
                </div>
              </div>

              <ChevronRight className="absolute right-3.5 bottom-4 h-3.5 w-3.5 text-gray-300 dark:text-white/20 transition-transform group-hover:translate-x-0.5" />
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
