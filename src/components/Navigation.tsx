import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  ListChecks,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Music2,
  Plus,
  RefreshCw,
  Shield,
  Settings,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { PushNotificationSetting } from './PushNotificationSetting';
import {
  MOBILE_NAV_STYLE_CHANGE_EVENT,
  fetchMobileNavStylePreference,
  getDefaultMobileNavStyle,
  getStoredMobileNavStyle,
  saveMobileNavStylePreference,
  type MobileNavStyle,
} from '../lib/mobileNavPreference';
import {
  HomeIcon, CalendarIcon, NewsIcon,
  LeaveIcon, ShieldNavIcon, MessageIcon,
} from './NavIcons';

type NavIcon = React.ComponentType<{ active?: boolean; className?: string; style?: React.CSSProperties }>;

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
  badgeKey?: 'announcements' | 'events' | 'notifications' | 'pendingLeave' | 'messages';
  badgeColor?: 'red' | 'blue' | 'amber';
  exact?: boolean;
}

const SongsNavIcon: NavIcon = ({ className, style }) => <BookOpen className={className} style={style} />;
const VideosNavIcon: NavIcon = ({ className, style }) => <Video className={className} style={style} />;
const SetsNavIcon: NavIcon = ({ className, style }) => <ListChecks className={className} style={style} />;

const mobileNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/messages', label: 'Chat', icon: MessageIcon, badgeKey: 'messages', badgeColor: 'red' },
];

const sidebarMainItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/songs', label: 'Songs', icon: SongsNavIcon },
  { path: '/videos', label: 'Videos', icon: VideosNavIcon },
  { path: '/sets', label: 'Sets', icon: SetsNavIcon },
  { path: '/messages', label: 'Chat', icon: MessageIcon, badgeKey: 'messages', badgeColor: 'red' },
];

function MobileBadge({ count, color }: { count: number; color?: 'red' | 'blue' | 'amber' }) {
  if (count <= 0) return null;
  const bg = color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full ${bg} text-white text-[9px] font-bold leading-none shadow-sm`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SidebarBadge({ count, color }: { count: number; color?: 'red' | 'blue' | 'amber' }) {
  if (count <= 0) return null;
  const bg = color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full ${bg} text-white text-[10px] font-bold leading-none`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg pointer-events-none"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NavigationProps {
  hideMobile?: boolean;
  hideMobileAll?: boolean;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
  mobileChromeHidden?: boolean;
}

export function Navigation({ hideMobile, hideMobileAll, collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange, mobileChromeHidden = false }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isLeader,
    isOrgAdmin,
    isPlatformOwner,
    canApproveLeave,
    canManageDiscipline,
    profile,
    signOut,
    savedAccounts,
    addSavedAccount,
    switchAccount,
    forgetSavedAccount,
  } = useAuth();
  const { toast } = useToast();
  const unread = useUnreadCounts();

  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);
  const [savingNavStyle, setSavingNavStyle] = useState(false);
  const [drawerPanel, setDrawerPanel] = useState<'menu' | 'settings'>('menu');
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [switchingAccountMeta, setSwitchingAccountMeta] = useState<{ id: string; name: string; email: string } | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccountEmail, setAddAccountEmail] = useState('');
  const [addAccountPassword, setAddAccountPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const mobileMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSettingsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuScrollTopRef = useRef(0);
  const mobileSettingsScrollTopRef = useRef(0);

  const isActive = useCallback((item: NavItem) => {
    if (item.path === '/more') {
      return ['/more', '/profile', '/notifications'].some(p => location.pathname.startsWith(p));
    }
    if (item.path === '/leadership/overview' || item.path === '/leadership/church') {
      return location.pathname.startsWith('/leadership');
    }
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }, [location.pathname]);


  useEffect(() => {
    const handleStyleChange = () => setMobileNavStyle(getStoredMobileNavStyle());
    window.addEventListener(MOBILE_NAV_STYLE_CHANGE_EVENT, handleStyleChange as EventListener);
    window.addEventListener('storage', handleStyleChange);
    return () => {
      window.removeEventListener(MOBILE_NAV_STYLE_CHANGE_EVENT, handleStyleChange as EventListener);
      window.removeEventListener('storage', handleStyleChange);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    fetchMobileNavStylePreference(user.id).then((style) => {
      if (!cancelled && style) setMobileNavStyle(style);
    });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!mobileOpen) setDrawerPanel('menu');
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const target = drawerPanel === 'settings' ? mobileSettingsScrollRef.current : mobileMenuScrollRef.current;
    const savedTop = drawerPanel === 'settings' ? mobileSettingsScrollTopRef.current : mobileMenuScrollTopRef.current;

    if (!target) return;

    window.requestAnimationFrame(() => {
      if (target) target.scrollTop = savedTop;
    });
  }, [drawerPanel, mobileOpen]);


  const getBadgeCount = (item: NavItem) => {
    if (!item.badgeKey) return 0;
    if (item.badgeKey === 'announcements') return unread.announcements || 0;
    if (item.badgeKey === 'events') return unread.events || 0;
    if (item.badgeKey === 'pendingLeave') return unread.pendingLeave || 0;
    if (item.badgeKey === 'messages') return unread.messages || 0;
    return 0;
  };

  const sidebarManagementItems: NavItem[] = [
    { path: '/request-leave', label: 'Leave', icon: LeaveIcon },
    ...(isLeader || isOrgAdmin || canApproveLeave || canManageDiscipline
      ? [{ path: isOrgAdmin && !isLeader ? '/leadership/church' : '/leadership/overview', label: isOrgAdmin && !isLeader ? 'Church' : 'Leader', icon: ShieldNavIcon, badgeKey: 'pendingLeave' as const, badgeColor: 'red' as const }]
      : []),
    ...(isPlatformOwner
      ? [{ path: '/platform', label: 'Platform', icon: ShieldNavIcon }]
      : []),
  ];
  const desktopTabItems = [...sidebarMainItems, ...sidebarManagementItems];

  const displayName = profile?.nickname || profile?.first_name || '';
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const useDockedMobileNav = mobileNavStyle === 'docked';
  const hideMobileChrome = mobileChromeHidden && !mobileOpen;
  const hideDockedMobileNav = useDockedMobileNav && hideMobileChrome;
  const mobileMenuTranslateX = mobileOpen ? 'translateX(min(82vw, 340px))' : 'translateX(0)';
  const mobileNavTransform = `${mobileMenuTranslateX} ${hideDockedMobileNav ? 'translateY(calc(100% + 10px))' : 'translateY(0)'}`;
  const mobileHeaderTransform = mobileMenuTranslateX;

  const sidebarWidth = collapsed ? 72 : 256;

  const handleNav = (path: string) => {
    navigate(path);
    onMobileOpenChange(false);
  };

  const handleMobileNavStyleChange = async (style: MobileNavStyle) => {
    if (!user?.id || style === mobileNavStyle || savingNavStyle) return;

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
    if (targetUserId === user?.id || switchingAccountId) return;

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

    onMobileOpenChange(false);
    toast('success', 'Account switched');
    window.setTimeout(() => {
      setSwitchingAccountId(null);
      setSwitchingAccountMeta(null);
      navigate('/dashboard');
    }, 1500);
  };

  const handleForgetSavedAccount = (accountUserId: string) => {
    forgetSavedAccount(accountUserId);
    toast('info', 'Saved account removed from this device');
  };

  const handleAddAnotherAccount = () => {
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

  const baseProfileMenuItems: Array<{
    icon: LucideIcon;
    label: string;
    desc: string;
    path?: string;
    show: boolean;
    badge?: number;
    color: string;
    action?: () => void;
    keepDrawerOpen?: boolean;
  }> = [
    { icon: User, label: 'Profile', desc: 'Account and personal settings', path: '/profile', show: true, color: '#10b981' },
    { icon: Activity, label: 'Activity Log', desc: 'Church activity', path: '/activity-log', show: isPlatformOwner, color: '#0ea5e9' },
    { icon: BookOpen, label: 'Songs', desc: 'Song library and chord charts', path: '/songs', show: true, color: '#16a34a' },
    { icon: Video, label: 'Videos', desc: 'Training and reference videos', path: '/videos', show: true, color: '#0ea5e9' },
    { icon: ListChecks, label: 'Sets', desc: 'Past event sets', path: '/sets', show: true, color: '#10b981' },
    { icon: Calendar, label: 'Request Leave', desc: 'Submit unavailability', path: '/request-leave', show: true, color: '#f59e0b' },
  ];

  const leadershipMenuItems: typeof baseProfileMenuItems = [
    { icon: ListChecks, label: 'Approve Setlist', desc: 'Review submitted setlists', path: '/leadership/setlists', show: isLeader, badge: unread.pendingSetlists, color: '#16a34a' },
    { icon: Calendar, label: 'Approve Leave', desc: 'Review leave requests', path: '/leadership/leave', show: !!canApproveLeave, badge: unread.pendingLeave, color: '#f59e0b' },
    { icon: ArrowLeftRight, label: 'Approve Swaps', desc: 'Review swap requests', path: '/leadership/swaps', show: isLeader, badge: unread.pendingSwaps, color: '#0ea5e9' },
    { icon: AlertTriangle, label: 'Conduct', desc: 'Discipline and records', path: '/leadership/discipline', show: isLeader || !!canManageDiscipline, color: '#f97316' },
    { icon: Users, label: 'Team', desc: 'Manage team members', path: '/leadership/team', show: isLeader || isOrgAdmin, color: '#8b5cf6' },
  ].filter(item => item.show);

  const settingsMenuItem: typeof baseProfileMenuItems[number] = {
    icon: Settings,
    label: 'Settings',
    desc: 'Navigation, accounts, notifications',
    show: true,
    color: '#94a3b8',
    action: () => setDrawerPanel('settings'),
    keepDrawerOpen: true,
  };

  const primaryMenuItems = [
    ...baseProfileMenuItems.filter(item => item.show),
    settingsMenuItem,
  ];

  const openProfileMenuAction = (item: typeof primaryMenuItems[number]) => {
    if (item.action) {
      if (!item.keepDrawerOpen) onMobileOpenChange(false);
      item.action();
      return;
    }
    if (item.path) handleNav(item.path);
  };

  const renderNavItem = (item: NavItem, isCollapsed: boolean) => {
    const active = isActive(item);
    const Icon = item.icon;
    const badge = getBadgeCount(item);

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} label={item.label}>
          <button
            onClick={() => handleNav(item.path)}
            className={`relative flex h-9 w-full items-center justify-center rounded-xl transition-all duration-150 ${
              active
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {active && (
              <motion.div
                layoutId="activeNavBg"
                className="absolute inset-0 rounded-xl bg-brand-600/10 dark:bg-brand-400/10"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <div className="relative">
              <Icon active={active} className="h-[17px] w-[17px] shrink-0" style={{ width: '17px', height: '17px' }} />
              {badge > 0 && (
                <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full text-white text-[8px] font-bold leading-none ${item.badgeColor === 'blue' ? 'bg-blue-500' : item.badgeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
          </button>
        </Tooltip>
      );
    }

    return (
      <button
        key={item.path}
        onClick={() => handleNav(item.path)}
        className={`relative group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
          active
            ? 'text-gray-900 dark:text-white font-semibold'
            : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-black/[0.035] dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100'
        }`}
      >
        {active && (
          <motion.div
            layoutId="activeNavBg"
            className="absolute inset-0 rounded-xl border border-emerald-500/20 dark:border-emerald-400/20"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.04) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(16,185,129,0.06)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}
        {active && (
          <span
            className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-emerald-500 dark:bg-emerald-400"
            style={{ boxShadow: '0 0 6px rgba(16,185,129,0.6)' }}
          />
        )}
        <Icon
          active={active}
          className={`relative shrink-0 h-[17px] w-[17px] transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
          style={{ width: '17px', height: '17px', strokeWidth: 2 }}
        />
        <span className="relative flex-1 text-left truncate" style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
        {badge > 0 && <SidebarBadge count={badge} color={item.badgeColor} />}
      </button>
    );
  };

  const renderDesktopTab = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;
    const badge = getBadgeCount(item);

    return (
      <button
        key={item.path}
        onClick={() => handleNav(item.path)}
        className={`group relative flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-all duration-300 ${
          active
            ? 'text-gray-950 dark:text-white'
            : 'text-gray-500 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white'
        }`}
      >
        {active && (
          <motion.div
            layoutId="desktopTabActive"
            className="absolute inset-0 rounded-full border border-white/70 bg-gray-100/95 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-1px_0_rgba(15,23,42,0.08)] dark:border-white/[0.12] dark:bg-white/[0.14] dark:shadow-[0_16px_38px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.22)]"
            transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
          />
        )}
        <span className="absolute inset-0 rounded-full bg-white/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:bg-white/[0.055]" />
        <Icon
          active={active}
          className={`relative h-[17px] w-[17px] shrink-0 transition-all duration-300 ${
            active ? 'scale-110 text-gray-900 dark:text-white' : 'group-hover:scale-110'
          }`}
          style={{ width: '17px', height: '17px', strokeWidth: 2 }}
        />
        <span className="relative whitespace-nowrap tracking-[-0.01em]">{item.label}</span>
        {badge > 0 && (
          <span className={`relative flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none text-white shadow-sm ${
            item.badgeColor === 'blue' ? 'bg-blue-500' : item.badgeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'
          }`}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
    );
  };

  const renderMobileSettingsPanel = () => (
    <>
      <div className="border-b border-black/[0.06] px-4 pb-4 dark:border-white/[0.08]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.35rem)' }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerPanel('menu')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Back to menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-black leading-tight text-gray-900 dark:text-white">Settings</p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-300">Navigation, accounts, notifications</p>
          </div>
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={mobileSettingsScrollRef}
        data-mobile-menu-scroll
        onScroll={(event) => { mobileSettingsScrollTopRef.current = event.currentTarget.scrollTop; }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-action-pan-y px-3 py-3"
      >
        <div className="space-y-4">
          <section className="rounded-[1.55rem] border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Navigation Look</p>
              <h3 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-gray-900 dark:text-white">Choose bottom nav style.</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'floating', label: 'Floating', hint: 'iOS pill' },
                { id: 'docked', label: 'Docked', hint: 'Bottom bar' },
              ] as const).map(option => {
                const active = mobileNavStyle === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleMobileNavStyleChange(option.id)}
                    disabled={savingNavStyle}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? 'border-emerald-400/45 bg-emerald-400/[0.13] text-emerald-950 dark:text-white shadow-[0_0_30px_-20px_rgba(16,185,129,0.75)]'
                        : 'border-black/[0.08] bg-white/70 text-gray-700 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>
                        <span className="block text-[12px] font-black">{option.label}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-gray-500 dark:text-gray-400">{option.hint}</span>
                      </span>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.12)]" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              Default on this device: {getDefaultMobileNavStyle() === 'floating' ? 'Floating' : 'Docked'}
            </p>
          </section>

          <section className="rounded-[1.55rem] border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Account Switcher</p>
                <h3 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-gray-900 dark:text-white">Saved on this device.</h3>
              </div>
              <button
                type="button"
                onClick={handleAddAnotherAccount}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_10px_22px_-12px_rgba(16,185,129,0.8)]"
                aria-label="Add account"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {savedAccounts.map(account => {
                const isCurrent = account.userId === user?.id;
                const isSwitching = switchingAccountId === account.userId;
                return (
                  <div
                    key={account.userId}
                    className="flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white/72 px-2.5 py-2.5 dark:border-white/[0.07] dark:bg-black/10"
                  >
                    <Avatar
                      src={account.avatarUrl}
                      firstName={account.displayName || account.email || '?'}
                      size="sm"
                      className="!h-9 !w-9 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-gray-900 dark:text-white">{account.displayName || 'Saved account'}</p>
                      <p className="truncate text-[10px] font-mono font-semibold text-gray-500 dark:text-gray-400">{account.email}</p>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-400/[0.13] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-200">
                        Current
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={isSwitching}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-emerald-400/[0.13] px-2.5 text-[10px] font-black text-emerald-800 transition-colors hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-200"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleForgetSavedAccount(account.userId)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-300"
                      aria-label="Forget saved account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddAnotherAccount}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white/70 text-[12px] font-black text-gray-700 transition-colors hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-gray-100 dark:hover:bg-white/[0.075]"
            >
              <Plus className="h-4 w-4" />
              Save another login
            </button>
          </section>

          <section>
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Device Alerts</p>
            <PushNotificationSetting surface="drawer" />
          </section>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop premium tab bar ── */}
      <motion.header
        initial={{ opacity: 0, y: -18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 right-0 top-0 z-[100] hidden px-5 pt-4 lg:block"
      >
        <div className="pointer-events-none absolute inset-x-8 top-2 -z-10 h-24 rounded-[2rem] bg-emerald-300/10 blur-2xl dark:bg-emerald-950/18" />
        <div
          className="relative mx-auto flex h-[4.6rem] max-w-[118rem] items-center gap-4 overflow-hidden rounded-[1.7rem] border border-white/40 px-4 backdrop-blur-[55px] backdrop-saturate-[1.9] dark:border-white/[0.10]"
          style={{
            background: 'color-mix(in srgb, var(--sidebar-bg) 90%, transparent)',
            boxShadow: [
              '0 14px 34px -30px rgba(0,0,0,0.55)',
              '0 8px 32px rgba(0,0,0,0.08)',
              'inset 0 1px 0 rgba(255,255,255,0.42)',
              'inset 0 -1px 0 rgba(255,255,255,0.08)',
              'inset 0 0 46px 20px rgba(255,255,255,0.16)',
            ].join(', '),
            WebkitBackdropFilter: 'blur(55px) saturate(190%) contrast(108%)',
            backdropFilter: 'blur(55px) saturate(190%) contrast(108%)',
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-gradient-to-b from-white/80 via-transparent to-white/30" />
          <div className="pointer-events-none absolute inset-0 bg-white/28 dark:bg-black/20" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.44),rgba(255,255,255,0.18)_52%,rgba(255,255,255,0.08))] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035)_52%,rgba(255,255,255,0.015))]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/52 to-transparent dark:from-black/24" />
          <div className="pointer-events-none absolute right-24 top-0 h-full w-28 skew-x-[-18deg] bg-white/[0.09] blur-sm dark:bg-white/[0.035]" />
          <button
            onClick={() => handleNav('/dashboard')}
            className="group relative flex min-w-[13.5rem] items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            <div
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] overflow-hidden"
              style={{ background: 'linear-gradient(145deg, #111c15 0%, #06100b 100%)', boxShadow: '0 14px 28px -18px rgba(0,0,0,0.85)' }}
            >
              <div className="absolute inset-0 bg-emerald-400/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <Music2 className="relative text-emerald-300" style={{ width: '18px', height: '18px' }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black leading-tight tracking-[-0.035em] text-gray-950 dark:text-white">ServeSync</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-400">Team Management</p>
            </div>
          </button>

          <nav className="relative flex min-w-0 flex-1 items-center justify-center">
            <div
              className="relative flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/35 p-1.5 backdrop-blur-[50px] dark:border-white/[0.10] scrollbar-none"
              style={{
                background: 'color-mix(in srgb, var(--nav-bg) 84%, transparent)',
                boxShadow: '0 18px 42px -28px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(255,255,255,0.08), inset 0 -12px 26px rgba(255,255,255,0.035)',
                WebkitBackdropFilter: 'blur(50px) saturate(200%) contrast(108%)',
                backdropFilter: 'blur(50px) saturate(200%) contrast(108%)',
              }}
            >
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
              {desktopTabItems.map(renderDesktopTab)}
            </div>
          </nav>

          <div className="relative flex min-w-[13.5rem] items-center justify-end gap-1.5">
            <ThemeToggle />
            <NotificationBell />
            <button
              onClick={() => navigate('/profile')}
              className="group ml-1 flex items-center gap-2 rounded-full border border-black/[0.05] bg-white/70 py-1.5 pl-1.5 pr-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.045] dark:hover:bg-white/[0.075]"
            >
              <Avatar
                src={profile?.avatar_url}
                firstName={profile?.first_name || '?'}
                lastName={profile?.last_name}
                size="sm"
                className="ring-1 ring-black/10 dark:ring-white/10"
              />
              <span className="max-w-[7rem] truncate text-[12px] font-black text-gray-800 dark:text-gray-100">
                {displayName || fullName || 'Profile'}
              </span>
            </button>
            <button
              onClick={signOut}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-all hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Mobile top bar ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-30 flex items-end justify-between overflow-hidden px-4 lg:hidden ${hideMobileAll ? 'hidden' : ''}`}
        style={{
          background: 'color-mix(in srgb, var(--sidebar-bg) 78%, transparent)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%) contrast(108%)',
          backdropFilter: 'blur(30px) saturate(190%) contrast(108%)',
          borderBottom: '1px solid var(--sidebar-border)',
          boxShadow: '0 14px 34px -30px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.06)',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          transform: mobileHeaderTransform,
          filter: mobileOpen ? 'blur(1.25px) brightness(0.78)' : 'blur(0px) brightness(1)',
          transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.08)_52%,rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.15),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025)_52%,rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/38 to-transparent dark:from-black/18" />
        <div className="relative flex h-14 w-full items-center justify-between gap-2 pb-0">
          <button
            onClick={() => {
              setDrawerPanel('menu');
              onMobileOpenChange(true);
            }}
            className="flex min-w-0 items-center gap-2 rounded-2xl px-1.5 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            aria-label="Open account menu"
          >
            <Avatar
              src={profile?.avatar_url}
              firstName={profile?.first_name || '?'}
              lastName={profile?.last_name}
              size="sm"
              className="!h-8 !w-8 !text-[11px] ring-1 ring-black/10 dark:ring-white/10"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black leading-tight text-gray-900 dark:text-white">
                {displayName || fullName || 'Profile'}
              </p>
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-400">
                Menu
              </p>
            </div>
          </button>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.button
              type="button"
              onClick={() => {
                setDrawerPanel('menu');
                onMobileOpenChange(true);
              }}
              className="pointer-events-auto px-1 py-1 text-center"
              aria-label="Open menu to see moved tabs"
              whileTap={{ scale: 0.97 }}
            >
              <span className="relative flex items-center justify-center gap-1">
                <motion.span
                  className="relative mr-0.5 flex h-4 w-5 items-center justify-center"
                  animate={{ x: [0, -6, 0] }}
                  transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.span
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ArrowLeft className="h-4 w-4 text-emerald-700 dark:text-emerald-200" strokeWidth={2.6} />
                  </motion.span>
                </motion.span>
                <motion.span
                  className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300"
                  animate={{ opacity: [0.7, 1, 0.7], y: [0, -1.5, 0], x: [0, -1.5, 0] }}
                  transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                >
                  More tabs here
                </motion.span>
              </span>
            </motion.button>
          </div>

          <div className="relative z-20 flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && !hideMobileAll && (
          <>
            <motion.button
              aria-label="Close account menu"
              className="fixed inset-0 z-[45] bg-black/42 backdrop-blur-[2px] backdrop-saturate-75 touch-action-none lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => onMobileOpenChange(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[70] w-[min(82vw,340px)] overflow-hidden touch-action-none bg-[#fbfaf6] text-gray-900 shadow-[24px_0_70px_-44px_rgba(15,23,42,0.24)] dark:bg-[#191919] dark:text-white dark:shadow-[24px_0_70px_-44px_rgba(0,0,0,0.8)] lg:hidden"
              style={{ overscrollBehaviorY: 'none' }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex h-full min-h-0 flex-col">
                {drawerPanel === 'settings' ? (
                  renderMobileSettingsPanel()
                ) : (
                  <>
                    <div className="border-b border-black/[0.06] px-5 pb-5 dark:border-white/[0.08]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.6rem)' }}>
                      <div className="flex items-center gap-4">
                        <Avatar
                          src={profile?.avatar_url}
                          firstName={profile?.first_name || '?'}
                          lastName={profile?.last_name}
                          size="md"
                          className="!h-16 !w-16 !text-2xl rounded-full ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[21px] font-black leading-tight text-gray-900 dark:text-white">{displayName || fullName || 'Profile'}</p>
                          <button
                            onClick={() => handleNav('/profile')}
                            className="mt-1 text-left text-[14px] font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                          >
                            View profile
                          </button>
                        </div>
                        <button
                          onClick={() => onMobileOpenChange(false)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          aria-label="Close menu"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={mobileMenuScrollRef}
                      data-mobile-menu-scroll
                      onScroll={(event) => { mobileMenuScrollTopRef.current = event.currentTarget.scrollTop; }}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-action-pan-y px-3 py-3"
                    >
                      {primaryMenuItems.filter(item => item.label !== 'Profile').map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path || item.label}
                            onClick={() => openProfileMenuAction(item)}
                            className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.055]"
                          >
                            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-gray-900 dark:text-white">
                              <Icon className="h-5 w-5" />
                              {!!item.badge && item.badge > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                                  {item.badge > 9 ? '9+' : item.badge}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] font-bold text-gray-900 dark:text-white">{item.label}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-300">{item.desc}</span>
                            </span>
                            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400 transition-colors group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200" />
                          </button>
                        );
                      })}

                      {leadershipMenuItems.length > 0 && (
                        <div className="pt-3">
                          <div className="px-3 pb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-400">Leadership</p>
                          </div>
                          {leadershipMenuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.path || item.label}
                                onClick={() => openProfileMenuAction(item)}
                                className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.055]"
                              >
                                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-gray-900 dark:text-white">
                                  <Icon className="h-5 w-5" />
                                  {!!item.badge && item.badge > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                                      {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[16px] font-bold text-gray-900 dark:text-white">{item.label}</span>
                                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-300">{item.desc}</span>
                                </span>
                                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400 transition-colors group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-black/[0.06] px-3 pb-3 pt-3 dark:border-white/[0.08]">
                      <button
                        onClick={() => {
                          onMobileOpenChange(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left text-red-500 transition-colors hover:bg-red-500/10 dark:text-red-400"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                          <LogOut className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1 text-[16px] font-bold">Sign out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Legacy desktop sidebar, replaced by desktop tab bar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden fixed left-0 top-0 h-screen z-40 flex-col p-3"
        style={{ overflow: 'visible' }}
      >
        {/* Inner card */}
        <div
          className="flex flex-col h-full rounded-2xl overflow-hidden"
          style={{
            background: 'var(--sidebar-bg)',
            WebkitBackdropFilter: 'blur(24px)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--sidebar-border)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.1), 0 4px 16px -4px rgba(0,0,0,0.06)',
          }}
        >
          {/* Brand header */}
          <div
            className={`h-[58px] flex shrink-0 ${collapsed ? 'flex-col items-center justify-center gap-1.5 py-3 px-2' : 'flex-row items-center gap-2.5 px-3.5'}`}
          >
            <div
              className="shrink-0 rounded-[22%] flex items-center justify-center"
              style={{
                width: '22px',
                height: '22px',
                background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              <Music2 className="text-emerald-400" style={{ width: '12px', height: '12px' }} />
            </div>

            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight truncate">ServeSync</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-px truncate">Team Management</p>
              </motion.div>
            )}

            {!collapsed && (
              <button
                onClick={() => onCollapsedChange(true)}
                className="ml-auto h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {collapsed && (
              <button
                onClick={() => onCollapsedChange(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Main nav */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
            {!collapsed && (
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Main</p>
            )}
            {collapsed && <div className="pt-1" />}

            {sidebarMainItems.map(item => renderNavItem(item, collapsed))}

            {sidebarManagementItems.length > 0 && (
              <>
                {!collapsed && (
                  <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Management</p>
                )}
                {collapsed && <div className="h-3" />}
                {sidebarManagementItems.map(item => renderNavItem(item, collapsed))}
              </>
            )}
          </div>

          {/* Footer / user profile */}
          <div className="shrink-0 px-2 pt-2 pb-2 space-y-1.5">
            {!collapsed ? (
              <>
                <div className="flex items-center gap-1 px-1 pb-0.5">
                  <ThemeToggle />
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
                  <NotificationBell />
                </div>

                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors group"
                >
                  <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.02em' }}>
                      {displayName || fullName}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-px">{profile?.email}</p>
                  </div>
                </button>

                <button
                  onClick={signOut}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Tooltip label="Theme">
                  <div className="flex justify-center w-full">
                    <ThemeToggle />
                  </div>
                </Tooltip>
                <Tooltip label="Notifications">
                  <div className="flex justify-center w-full">
                    <NotificationBell />
                  </div>
                </Tooltip>
                <Tooltip label={displayName || fullName || 'Profile'}>
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex h-9 w-full items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                  </button>
                </Tooltip>
                <Tooltip label="Sign out">
                  <button
                    onClick={signOut}
                    className="flex h-9 w-full items-center justify-center rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Mobile bottom nav ── */}
      {!hideMobile && !hideMobileAll && (
        <div
          data-mobile-nav="true"
          className={`fixed bottom-0 left-0 right-0 overflow-hidden lg:hidden ${mobileOpen ? 'z-30' : 'z-50'} ${useDockedMobileNav ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            paddingBottom: useDockedMobileNav ? '0px' : 'max(0px, calc(env(safe-area-inset-bottom) - 6px))',
            paddingTop: useDockedMobileNav ? '0px' : '6px',
            background: useDockedMobileNav ? 'color-mix(in srgb, var(--sidebar-bg) 96%, transparent)' : undefined,
            WebkitBackdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            backdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            borderTop: useDockedMobileNav ? '1px solid var(--sidebar-border)' : undefined,
            boxShadow: useDockedMobileNav ? '0 -18px 42px -34px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
            transform: mobileNavTransform,
            filter: mobileOpen ? 'blur(1.25px) brightness(0.78)' : 'blur(0px) brightness(1)',
            opacity: hideDockedMobileNav ? 0 : 1,
            pointerEvents: hideMobileChrome ? 'none' : undefined,
            transition: 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform, opacity',
          }}
        >
          <motion.div
            initial={false}
            animate={{
              y: hideMobileChrome ? 128 : 0,
              scale: hideMobileChrome ? 0.92 : 1,
              opacity: hideMobileChrome ? 0 : 1,
            }}
            transition={{
              y: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
            }}
            style={{ transformOrigin: 'center bottom', willChange: 'transform, opacity' }}
            className={`relative flex ${useDockedMobileNav ? 'justify-stretch px-0' : 'justify-center px-8'}`}
          >
            <nav
              className={`pointer-events-auto relative flex ${useDockedMobileNav ? 'w-full items-start overflow-visible px-2 pt-2' : 'w-full max-w-[480px] items-center overflow-hidden bg-white/95 p-1.5 rounded-full dark:bg-[#17171a]'}`}
              style={{
                height: useDockedMobileNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined,
                background: useDockedMobileNav ? 'transparent' : undefined,
                WebkitBackdropFilter: useDockedMobileNav ? undefined : 'none',
                backdropFilter: useDockedMobileNav ? undefined : 'none',
                border: useDockedMobileNav ? undefined : '1px solid var(--nav-border)',
                boxShadow: useDockedMobileNav
                  ? 'none'
                  : '0 14px 30px -18px rgba(0,0,0,0.22), 0 2px 8px -5px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.28)',
                paddingBottom: useDockedMobileNav ? 'env(safe-area-inset-bottom)' : undefined,
              }}
            >
              {!useDockedMobileNav && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))]" />
                  <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/38 to-transparent dark:via-white/10" />
                </>
              )}

              {mobileNavItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const badge = getBadgeCount(item);
                const navItemColor = active ? 'var(--mobile-nav-active-color)' : 'var(--mobile-nav-inactive-color)';
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    data-mobile-nav-item="true"
                    data-active={active ? 'true' : 'false'}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex flex-1 min-w-[44px] flex-col items-center justify-center gap-0.5 ${useDockedMobileNav ? 'h-[56px] pt-1' : 'h-12'}`}
                    style={{ WebkitTapHighlightColor: 'transparent', color: navItemColor }}
                  >
                    {active && !useDockedMobileNav && (
                      <motion.div
                        layoutId="mobileNavIndicator"
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background: 'var(--nav-indicator)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                      />
                    )}
                    <div className="relative">
                      <Icon
                        active={active}
                        className="transition-colors duration-200"
                      />
                      <MobileBadge count={badge} color={item.badgeColor} />
                    </div>
                    <span
                      className={`relative max-w-[4.25rem] truncate font-black leading-none transition-colors ${
                        useDockedMobileNav ? 'text-[10px]' : 'text-[9px]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </motion.div>
        </div>
      )}

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
            <h3 className="text-[24px] font-black tracking-[-0.03em] text-gray-900 dark:text-white">
              Add another login to Settings.
            </h3>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-gray-500 dark:text-gray-300">
              Enter the second account once. It will be saved on this device so you can switch from the avatar menu anytime.
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
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/75 dark:text-emerald-200/75">
                    This only stores the other account on this device. It does not log you out of the one you are using now.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
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
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-white"
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
            className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-[#0c0f0d] px-6 text-center text-white"
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
              <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border border-emerald-500/15"
                  animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.36, 0.7, 0.36] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-4 rounded-full border border-dashed border-emerald-300/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute -left-2 top-[3.3rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/15 bg-white/[0.08] text-emerald-200"
                  animate={{ y: [0, -8, 0], opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers3 className="h-4 w-4" />
                </motion.div>
                <motion.div
                  aria-hidden="true"
                  className="absolute -right-2 top-[3.3rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/15 bg-white/[0.08] text-emerald-200"
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

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                Switching Account
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
                Moving into {switchingAccountMeta.name}.
              </h2>
              <p className="mx-auto mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-white/70">
                Loading profile, roles, and live data for
                <span className="block">{switchingAccountMeta.email}.</span>
              </p>

              <div className="relative mt-6 h-4 overflow-hidden rounded-full bg-white/10 p-1">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
