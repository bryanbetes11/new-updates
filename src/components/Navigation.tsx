import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ListChecks, LogOut, ChevronLeft, ChevronRight, Music2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import {
  MOBILE_NAV_STYLE_CHANGE_EVENT,
  fetchMobileNavStylePreference,
  getStoredMobileNavStyle,
  type MobileNavStyle,
} from '../lib/mobileNavPreference';
import {
  HomeIcon, CalendarIcon, NewsIcon, MoreIcon,
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
const SetsNavIcon: NavIcon = ({ className, style }) => <ListChecks className={className} style={style} />;

const mobileNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/messages', label: 'Chat', icon: MessageIcon, badgeKey: 'messages', badgeColor: 'red' },
  { path: '/more', label: 'More', icon: MoreIcon, badgeKey: 'pendingLeave', badgeColor: 'amber' },
];

const sidebarMainItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/library', label: 'Library', icon: SongsNavIcon },
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
}

export function Navigation({ hideMobile, hideMobileAll, collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLeader, isOrgAdmin, isPlatformOwner, canApproveLeave, canManageDiscipline, profile, signOut } = useAuth();
  const unread = useUnreadCounts();

  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);

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
    if (!profile?.id) return;

    let cancelled = false;
    fetchMobileNavStylePreference(profile.id).then((style) => {
      if (!cancelled && style) setMobileNavStyle(style);
    });

    return () => { cancelled = true; };
  }, [profile?.id]);


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

  const sidebarWidth = collapsed ? 72 : 256;

  const handleNav = (path: string) => {
    navigate(path);
    onMobileOpenChange(false);
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
            : 'text-gray-500 hover:text-gray-950 dark:text-white/52 dark:hover:text-white'
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
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-white/30">Team Management</p>
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
              <span className="max-w-[7rem] truncate text-[12px] font-black text-gray-800 dark:text-white/78">
                {displayName || fullName || 'Profile'}
              </span>
            </button>
            <button
              onClick={signOut}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-all hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-500 dark:text-white/35 dark:hover:bg-red-500/10 dark:hover:text-red-300"
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
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.08)_52%,rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.15),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025)_52%,rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/38 to-transparent dark:from-black/18" />
        <div className="relative flex items-center justify-between w-full h-14 pb-0">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-[22%] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <Music2 className="text-emerald-400" style={{ width: '14px', height: '14px' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">ServeSync</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <button
            onClick={() => navigate('/profile')}
            className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <Avatar
              src={profile?.avatar_url}
              firstName={profile?.first_name || '?'}
              lastName={profile?.last_name}
              size="sm"
              className="!h-5 !w-5 !text-[9px] ring-1 ring-black/10 dark:ring-white/10"
            />
          </button>
        </div>
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => onMobileOpenChange(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 bottom-0 z-40 w-[280px] flex flex-col lg:hidden"
            style={{
              background: 'var(--sidebar-bg)',
              WebkitBackdropFilter: 'blur(24px)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid var(--sidebar-border)',
            }}
          >
            {/* Mobile sidebar header */}
            <div className="h-14 flex items-center gap-2.5 px-4 shrink-0">
              <div
                className="h-8 w-8 rounded-[22%] flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Music2 className="text-emerald-400" style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">ServeSync</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Team Management</p>
              </div>
            </div>

            {/* Mobile nav items */}
            <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Main</p>
              {sidebarMainItems.map(item => renderNavItem(item, false))}

              {sidebarManagementItems.length > 0 && (
                <>
                  <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Management</p>
                  {sidebarManagementItems.map(item => renderNavItem(item, false))}
                </>
              )}
            </div>

            {/* Mobile footer */}
            <div className="shrink-0 px-2 pt-2 pb-2 space-y-1.5">
              <button
                onClick={() => handleNav('/profile')}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
              >
                <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight">{displayName || fullName}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-px">{profile?.email}</p>
                </div>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.aside>
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
          className={`fixed bottom-0 left-0 right-0 z-50 overflow-hidden lg:hidden ${useDockedMobileNav ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            paddingBottom: useDockedMobileNav ? '0px' : 'max(0px, calc(env(safe-area-inset-bottom) - 6px))',
            paddingTop: useDockedMobileNav ? '0px' : '6px',
            background: useDockedMobileNav ? 'color-mix(in srgb, var(--sidebar-bg) 96%, transparent)' : undefined,
            WebkitBackdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            backdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            borderTop: useDockedMobileNav ? '1px solid var(--sidebar-border)' : undefined,
            boxShadow: useDockedMobileNav ? '0 -18px 42px -34px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
          }}
        >
          <div className={`relative flex ${useDockedMobileNav ? 'justify-stretch px-0' : 'justify-center px-8'}`}>
            <nav
              className={`pointer-events-auto relative flex ${useDockedMobileNav ? 'w-full items-start overflow-visible px-2 pt-2' : 'w-full max-w-[480px] items-center overflow-hidden bg-white p-1.5 rounded-full dark:bg-[#151517]'}`}
              style={{
                height: useDockedMobileNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined,
                background: useDockedMobileNav ? 'transparent' : undefined,
                WebkitBackdropFilter: useDockedMobileNav ? undefined : 'none',
                backdropFilter: useDockedMobileNav ? undefined : 'none',
                border: useDockedMobileNav ? undefined : '1px solid var(--nav-border)',
                boxShadow: useDockedMobileNav
                  ? 'none'
                  : '0 18px 42px -14px rgba(0,0,0,0.24), 0 2px 10px -4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.72)',
                paddingBottom: useDockedMobileNav ? 'env(safe-area-inset-bottom)' : undefined,
              }}
            >
              {!useDockedMobileNav && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.55),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.30),rgba(255,255,255,0.06))] dark:bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]" />
                  <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/20" />
                </>
              )}

              {mobileNavItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const badge = getBadgeCount(item);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative flex flex-1 items-center justify-center min-w-[44px] ${useDockedMobileNav ? 'h-[56px]' : 'h-12'}`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
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
                        className={`transition-colors duration-200 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-black/50 dark:text-white/55'}`}
                      />
                      <MobileBadge count={badge} color={item.badgeColor} />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
